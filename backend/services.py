"""Business logic: threshold engine, alert creation, WebSocket fan-out,
notifications, the transaction simulator, and stats.
"""
from __future__ import annotations

import asyncio
import os
import random
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import schemas
from .database import SessionLocal
from .models import Alert, AlertRule, SystemLog, Transaction, utcnow

# --------------------------------------------------------------------------- #
# Reference data used by the simulator and the unusual-location check
# --------------------------------------------------------------------------- #
KNOWN_LOCATIONS = {"Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Hyderabad", "Pune"}
UNUSUAL_LOCATIONS = ["Dubai", "Singapore", "London", "Lagos", "Unknown", "Moscow"]
ACCOUNTS = [f"ACC{1000 + i}" for i in range(1, 26)]
TXN_TYPES = ["transfer", "withdrawal", "deposit"]


# --------------------------------------------------------------------------- #
# WebSocket connection manager
# --------------------------------------------------------------------------- #
class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[Any] = []

    async def connect(self, websocket) -> None:
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket) -> None:
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, event: dict) -> None:
        dead = []
        for ws in list(self.active):
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

# The main event loop reference, set on startup so synchronous request handlers
# (which run in a threadpool) can schedule broadcasts safely.
MAIN_LOOP: Optional[asyncio.AbstractEventLoop] = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global MAIN_LOOP
    MAIN_LOOP = loop


def notify_clients(event: dict) -> None:
    """Schedule a broadcast onto the main loop from any thread."""
    if MAIN_LOOP and MAIN_LOOP.is_running():
        asyncio.run_coroutine_threadsafe(manager.broadcast(event), MAIN_LOOP)


# --------------------------------------------------------------------------- #
# Logging + notifications
# --------------------------------------------------------------------------- #
def log_event(db: Session, level: str, category: str, message: str) -> SystemLog:
    entry = SystemLog(level=level, category=category, message=message)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def send_notification(db: Session, alert: Alert) -> None:
    """Email-on-critical. Falls back to a system log entry when SMTP is off,
    so the system works out of the box."""
    if alert.severity != schemas.Severity.CRITICAL.value:
        return

    to_addr = os.getenv("ALERT_EMAIL_TO", "ops-team@bank.local")
    subject = f"[CRITICAL] {alert.rule_name}"
    body = (
        f"A critical banking alert was triggered.\n\n"
        f"Rule: {alert.rule_name}\nCategory: {alert.category}\n"
        f"Source: {alert.source}\nThreshold: {alert.threshold_value}\n"
        f"Actual: {alert.actual_value}\nTime: {alert.triggered_at} UTC\n\n"
        f"{alert.message}\n"
    )

    if os.getenv("EMAIL_ENABLED", "false").lower() == "true" and os.getenv("SMTP_HOST"):
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = os.getenv("SMTP_FROM", "alerts@bank.local")
            msg["To"] = to_addr
            with smtplib.SMTP(os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", "587"))) as s:
                s.starttls()
                if os.getenv("SMTP_USER"):
                    s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD", ""))
                s.sendmail(msg["From"], [to_addr], msg.as_string())
            log_event(db, "INFO", "notification", f"Critical alert email sent to {to_addr} for '{alert.rule_name}'.")
        except Exception as exc:  # pragma: no cover - network dependent
            log_event(db, "ERROR", "notification", f"Email send failed: {exc}")
    else:
        log_event(
            db, "INFO", "notification",
            f"[Email disabled] Would notify {to_addr}: CRITICAL '{alert.rule_name}' from {alert.source}.",
        )


# --------------------------------------------------------------------------- #
# Threshold engine
# --------------------------------------------------------------------------- #
_OPS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


def _compare(actual: float, operator: str, threshold: float) -> bool:
    return _OPS.get(operator, _OPS[">"])(actual, threshold)


def _window_start(rule: AlertRule, default: int = 600) -> datetime:
    seconds = rule.time_window_seconds or default
    return utcnow() - timedelta(seconds=seconds)


def _compute_actual(db: Session, rule: AlertRule, txn: Transaction):
    """Return (applicable, actual_value, detail) for a rule against a txn."""
    m = rule.metric

    if m == schemas.Metric.TRANSACTION_AMOUNT.value:
        if txn.txn_type == "login":
            return False, 0.0, ""
        return True, float(txn.amount), f"{txn.txn_type} of ₹{txn.amount:,.0f}"

    if m == schemas.Metric.FUND_TRANSFER_AMOUNT.value:
        if txn.txn_type != "transfer":
            return False, 0.0, ""
        return True, float(txn.amount), f"fund transfer of ₹{txn.amount:,.0f}"

    if m == schemas.Metric.TRANSACTION_COUNT.value:
        if txn.txn_type == "login":
            return False, 0.0, ""
        count = (
            db.query(func.count(Transaction.id))
            .filter(
                Transaction.account_id == txn.account_id,
                Transaction.txn_type != "login",
                Transaction.created_at >= _window_start(rule),
            )
            .scalar()
        )
        window = rule.time_window_seconds or 600
        return True, float(count), f"{count} transactions in {window // 60 or 1} min"

    if m == schemas.Metric.FAILED_LOGIN_COUNT.value:
        if not (txn.txn_type == "login" and txn.status == "failed"):
            return False, 0.0, ""
        count = (
            db.query(func.count(Transaction.id))
            .filter(
                Transaction.account_id == txn.account_id,
                Transaction.txn_type == "login",
                Transaction.status == "failed",
                Transaction.created_at >= _window_start(rule),
            )
            .scalar()
        )
        return True, float(count), f"{count} failed logins"

    if m == schemas.Metric.LOGIN_LOCATION.value:
        if txn.txn_type != "login":
            return False, 0.0, ""
        unusual = txn.location not in KNOWN_LOCATIONS
        return True, (1.0 if unusual else 0.0), f"login from {txn.location or 'Unknown'}"

    return False, 0.0, ""


def _is_rate_metric(metric: str) -> bool:
    return metric in (
        schemas.Metric.TRANSACTION_COUNT.value,
        schemas.Metric.FAILED_LOGIN_COUNT.value,
    )


def _has_recent_active_alert(db: Session, rule: AlertRule, source: str) -> bool:
    """Dedupe rate-based alerts: skip if an Active one already exists in-window."""
    since = _window_start(rule)
    existing = (
        db.query(Alert.id)
        .filter(
            Alert.rule_id == rule.id,
            Alert.source == source,
            Alert.status == schemas.AlertStatus.ACTIVE.value,
            Alert.triggered_at >= since,
        )
        .first()
    )
    return existing is not None


def evaluate_transaction(db: Session, txn: Transaction) -> list[Alert]:
    """Check a transaction against every enabled rule; create + broadcast alerts."""
    created: list[Alert] = []
    rules = db.query(AlertRule).filter(AlertRule.enabled.is_(True)).all()

    for rule in rules:
        applicable, actual, detail = _compute_actual(db, rule, txn)
        if not applicable:
            continue
        if not _compare(actual, rule.operator, rule.threshold_value):
            continue
        if _is_rate_metric(rule.metric) and _has_recent_active_alert(db, rule, txn.account_id):
            continue

        message = (
            f"{rule.name}: {detail} (threshold {rule.operator} {rule.threshold_value:g}) "
            f"on account {txn.account_id}."
        )
        alert = Alert(
            rule_id=rule.id,
            rule_name=rule.name,
            category=rule.category,
            severity=rule.severity,
            status=schemas.AlertStatus.ACTIVE.value,
            metric=rule.metric,
            threshold_value=rule.threshold_value,
            actual_value=actual,
            source=txn.account_id,
            message=message,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        created.append(alert)

        log_event(db, "WARNING", "alert", message)
        send_notification(db, alert)
        notify_clients({
            "type": "alert",
            "data": schemas.AlertOut.model_validate(alert).model_dump(mode="json"),
        })

    return created


# --------------------------------------------------------------------------- #
# Transaction simulator
# --------------------------------------------------------------------------- #
class SimulatorState:
    def __init__(self) -> None:
        self.running: bool = False
        self.task: Optional[asyncio.Task] = None
        self.generated: int = 0


simulator = SimulatorState()


def _persist_transaction(db: Session, **kwargs) -> Transaction:
    txn = Transaction(**kwargs)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    simulator.generated += 1
    notify_clients({
        "type": "transaction",
        "data": schemas.TransactionOut.model_validate(txn).model_dump(mode="json"),
    })
    return txn


def generate_one(db: Session) -> dict:
    """Generate a single (sometimes anomalous) event and evaluate it.

    Returns a summary dict of the transactions + alerts produced.
    """
    roll = random.random()
    txns: list[Transaction] = []

    if roll < 0.12:
        # Rapid-fire burst from one account (triggers transaction_count rules).
        acct = random.choice(ACCOUNTS)
        for _ in range(random.randint(6, 9)):
            txns.append(_persist_transaction(
                db, account_id=acct, amount=round(random.uniform(5_000, 200_000), 2),
                txn_type=random.choice(TXN_TYPES), location=random.choice(list(KNOWN_LOCATIONS)),
                ip_address=_random_ip(),
            ))
    elif roll < 0.22:
        # Repeated failed logins (triggers failed_login_count rules).
        acct = random.choice(ACCOUNTS)
        for _ in range(random.randint(4, 7)):
            txns.append(_persist_transaction(
                db, account_id=acct, amount=0.0, txn_type="login",
                location=random.choice(list(KNOWN_LOCATIONS)), ip_address=_random_ip(),
                status="failed",
            ))
    elif roll < 0.32:
        # Login from an unusual location.
        txns.append(_persist_transaction(
            db, account_id=random.choice(ACCOUNTS), amount=0.0, txn_type="login",
            location=random.choice(UNUSUAL_LOCATIONS), ip_address=_random_ip(), status="success",
        ))
    elif roll < 0.50:
        # High-value transaction / large fund transfer.
        txns.append(_persist_transaction(
            db, account_id=random.choice(ACCOUNTS),
            amount=round(random.uniform(5_000_000, 80_000_000), 2),
            txn_type=random.choice(["transfer", "withdrawal"]),
            location=random.choice(list(KNOWN_LOCATIONS)), ip_address=_random_ip(),
        ))
    else:
        # Ordinary low-value activity (usually no alert).
        txns.append(_persist_transaction(
            db, account_id=random.choice(ACCOUNTS),
            amount=round(random.uniform(500, 200_000), 2),
            txn_type=random.choice(TXN_TYPES),
            location=random.choice(list(KNOWN_LOCATIONS)), ip_address=_random_ip(),
        ))

    alerts: list[Alert] = []
    for txn in txns:
        alerts.extend(evaluate_transaction(db, txn))

    return {
        "transactions": [schemas.TransactionOut.model_validate(t).model_dump(mode="json") for t in txns],
        "alerts": [schemas.AlertOut.model_validate(a).model_dump(mode="json") for a in alerts],
    }


def _random_ip() -> str:
    return ".".join(str(random.randint(1, 254)) for _ in range(4))


async def _simulator_loop(interval: int) -> None:
    while simulator.running:
        db = SessionLocal()
        try:
            generate_one(db)
        except Exception as exc:  # pragma: no cover
            try:
                log_event(db, "ERROR", "simulator", f"Simulator error: {exc}")
            except Exception:
                pass
        finally:
            db.close()
        await asyncio.sleep(interval)


def start_simulator() -> bool:
    if simulator.running:
        return False
    interval = int(os.getenv("SIMULATOR_INTERVAL_SECONDS", "4"))
    simulator.running = True
    simulator.task = asyncio.create_task(_simulator_loop(interval))
    db = SessionLocal()
    try:
        log_event(db, "INFO", "simulator", f"Simulator started (interval={interval}s).")
    finally:
        db.close()
    return True


def stop_simulator() -> bool:
    if not simulator.running:
        return False
    simulator.running = False
    if simulator.task:
        simulator.task.cancel()
        simulator.task = None
    db = SessionLocal()
    try:
        log_event(db, "INFO", "simulator", "Simulator stopped.")
    finally:
        db.close()
    return True


# --------------------------------------------------------------------------- #
# Stats
# --------------------------------------------------------------------------- #
def compute_stats(db: Session) -> dict:
    total = db.query(func.count(Alert.id)).scalar() or 0
    by_status = dict(
        db.query(Alert.status, func.count(Alert.id)).group_by(Alert.status).all()
    )
    by_severity = dict(
        db.query(Alert.severity, func.count(Alert.id)).group_by(Alert.severity).all()
    )
    by_category = dict(
        db.query(Alert.category, func.count(Alert.id)).group_by(Alert.category).all()
    )
    last_24h = (
        db.query(func.count(Alert.id))
        .filter(Alert.triggered_at >= utcnow() - timedelta(hours=24))
        .scalar()
        or 0
    )
    rules_total = db.query(func.count(AlertRule.id)).scalar() or 0
    rules_enabled = db.query(func.count(AlertRule.id)).filter(AlertRule.enabled.is_(True)).scalar() or 0
    txns_total = db.query(func.count(Transaction.id)).scalar() or 0

    severities = ["Critical", "High", "Medium", "Low"]
    categories = ["Fraud", "Compliance", "Risk", "Performance"]
    return {
        "total_alerts": total,
        "active": by_status.get("Active", 0),
        "acknowledged": by_status.get("Acknowledged", 0),
        "resolved": by_status.get("Resolved", 0),
        "by_severity": {s: by_severity.get(s, 0) for s in severities},
        "by_category": {c: by_category.get(c, 0) for c in categories},
        "rules_total": rules_total,
        "rules_enabled": rules_enabled,
        "transactions_total": txns_total,
        "alerts_last_24h": last_24h,
        "simulator_running": simulator.running,
    }


# --------------------------------------------------------------------------- #
# Seeding
# --------------------------------------------------------------------------- #
DEFAULT_RULES = [
    dict(name="High-value transaction", description="Single transaction above ₹50 lakh.",
         category="Compliance", severity="High", metric="transaction_amount",
         operator=">", threshold_value=5_000_000, time_window_seconds=0),
    dict(name="Large fund transfer", description="Fund transfer above ₹1 crore.",
         category="Risk", severity="Critical", metric="fund_transfer_amount",
         operator=">", threshold_value=10_000_000, time_window_seconds=0),
    dict(name="Rapid transaction pattern", description="5+ transactions within 10 minutes.",
         category="Fraud", severity="High", metric="transaction_count",
         operator=">=", threshold_value=5, time_window_seconds=600),
    dict(name="Repeated failed logins", description="3+ failed logins within 5 minutes.",
         category="Fraud", severity="Critical", metric="failed_login_count",
         operator=">=", threshold_value=3, time_window_seconds=300),
    dict(name="Unusual login location", description="Login from an unrecognised location.",
         category="Fraud", severity="Medium", metric="login_location",
         operator=">=", threshold_value=1, time_window_seconds=0),
]


def seed_default_rules(db: Session) -> None:
    if db.query(func.count(AlertRule.id)).scalar():
        return
    for r in DEFAULT_RULES:
        db.add(AlertRule(**r))
    db.commit()
    log_event(db, "INFO", "system", f"Seeded {len(DEFAULT_RULES)} default alert rules.")
