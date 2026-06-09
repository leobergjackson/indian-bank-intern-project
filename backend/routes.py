"""REST API endpoints."""
from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import schemas, services
from .database import get_db
from .models import Alert, AlertRule, SystemLog, Transaction, utcnow

router = APIRouter(prefix="/api")


# --------------------------------------------------------------------------- #
# Admin auth (simple shared-token guard)
# --------------------------------------------------------------------------- #
def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("ADMIN_TOKEN", "admin-secret-token")
    if x_admin_token != expected:
        raise HTTPException(status_code=403, detail="Admin token required for this action.")


# --------------------------------------------------------------------------- #
# Alert rules (configuration)
# --------------------------------------------------------------------------- #
@router.get("/rules", response_model=list[schemas.AlertRuleOut], tags=["rules"])
def list_rules(db: Session = Depends(get_db)):
    return db.query(AlertRule).order_by(AlertRule.id).all()


@router.post("/rules", response_model=schemas.AlertRuleOut, status_code=201, tags=["rules"])
def create_rule(payload: schemas.AlertRuleCreate, db: Session = Depends(get_db),
                _: None = Depends(require_admin)):
    rule = AlertRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    services.log_event(db, "INFO", "config", f"Alert rule created: '{rule.name}'.")
    return rule


@router.get("/rules/{rule_id}", response_model=schemas.AlertRuleOut, tags=["rules"])
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(404, "Alert rule not found.")
    return rule


@router.put("/rules/{rule_id}", response_model=schemas.AlertRuleOut, tags=["rules"])
def update_rule(rule_id: int, payload: schemas.AlertRuleUpdate, db: Session = Depends(get_db),
                _: None = Depends(require_admin)):
    rule = db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(404, "Alert rule not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    services.log_event(db, "INFO", "config", f"Alert rule updated: '{rule.name}'.")
    return rule


@router.delete("/rules/{rule_id}", status_code=204, tags=["rules"])
def delete_rule(rule_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    rule = db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(404, "Alert rule not found.")
    name = rule.name
    db.delete(rule)
    db.commit()
    services.log_event(db, "WARNING", "config", f"Alert rule deleted: '{name}'.")


# --------------------------------------------------------------------------- #
# Alerts
# --------------------------------------------------------------------------- #
@router.get("/alerts", response_model=list[schemas.AlertOut], tags=["alerts"])
def list_alerts(
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(200, le=1000),
    offset: int = 0,
):
    q = db.query(Alert)
    if status:
        q = q.filter(Alert.status == status)
    if severity:
        q = q.filter(Alert.severity == severity)
    if category:
        q = q.filter(Alert.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Alert.rule_name.ilike(like), Alert.message.ilike(like), Alert.source.ilike(like)))
    if date_from:
        q = q.filter(Alert.triggered_at >= date_from)
    if date_to:
        q = q.filter(Alert.triggered_at <= date_to)
    return q.order_by(Alert.triggered_at.desc()).offset(offset).limit(limit).all()


@router.get("/alerts/{alert_id}", response_model=schemas.AlertOut, tags=["alerts"])
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found.")
    return alert


@router.patch("/alerts/{alert_id}/status", response_model=schemas.AlertOut, tags=["alerts"])
def update_alert_status(alert_id: int, payload: schemas.AlertStatusUpdate, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found.")

    alert.status = payload.status.value
    if payload.status == schemas.AlertStatus.ACKNOWLEDGED:
        alert.acknowledged_at = utcnow()
        alert.acknowledged_by = payload.actor
    elif payload.status == schemas.AlertStatus.RESOLVED:
        alert.resolved_at = utcnow()
        alert.resolved_by = payload.actor
        if not alert.acknowledged_at:
            alert.acknowledged_at = utcnow()
            alert.acknowledged_by = payload.actor
    db.commit()
    db.refresh(alert)
    services.log_event(db, "INFO", "alert", f"Alert #{alert.id} marked {alert.status} by {payload.actor}.")
    services.notify_clients({"type": "alert_updated",
                             "data": schemas.AlertOut.model_validate(alert).model_dump(mode="json")})
    return alert


# --------------------------------------------------------------------------- #
# Transactions (monitoring source + manual trigger)
# --------------------------------------------------------------------------- #
@router.get("/transactions", response_model=list[schemas.TransactionOut], tags=["transactions"])
def list_transactions(db: Session = Depends(get_db), limit: int = Query(50, le=500)):
    return db.query(Transaction).order_by(Transaction.created_at.desc()).limit(limit).all()


@router.post("/transactions", status_code=201, tags=["transactions"])
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    """Submit a transaction/event and run it through the threshold engine.

    Handy for demoing alert triggering manually from the UI.
    """
    txn = Transaction(**payload.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    services.notify_clients({
        "type": "transaction",
        "data": schemas.TransactionOut.model_validate(txn).model_dump(mode="json"),
    })
    alerts = services.evaluate_transaction(db, txn)
    return {
        "transaction": schemas.TransactionOut.model_validate(txn).model_dump(mode="json"),
        "alerts_triggered": [schemas.AlertOut.model_validate(a).model_dump(mode="json") for a in alerts],
    }


# --------------------------------------------------------------------------- #
# Simulator controls
# --------------------------------------------------------------------------- #
@router.get("/simulator", tags=["simulator"])
def simulator_status():
    return {"running": services.simulator.running, "generated": services.simulator.generated}


@router.post("/simulator/start", tags=["simulator"])
def simulator_start(_: None = Depends(require_admin)):
    started = services.start_simulator()
    return {"running": services.simulator.running, "changed": started}


@router.post("/simulator/stop", tags=["simulator"])
def simulator_stop(_: None = Depends(require_admin)):
    stopped = services.stop_simulator()
    return {"running": services.simulator.running, "changed": stopped}


@router.post("/simulator/tick", tags=["simulator"])
def simulator_tick(db: Session = Depends(get_db)):
    """Generate a single simulated event on demand."""
    return services.generate_one(db)


# --------------------------------------------------------------------------- #
# System logs + stats (admin panel)
# --------------------------------------------------------------------------- #
@router.get("/logs", response_model=list[schemas.SystemLogOut], tags=["admin"])
def list_logs(db: Session = Depends(get_db), level: Optional[str] = None, limit: int = Query(100, le=500)):
    q = db.query(SystemLog)
    if level:
        q = q.filter(SystemLog.level == level)
    return q.order_by(SystemLog.created_at.desc()).limit(limit).all()


@router.get("/stats", response_model=schemas.StatsOut, tags=["admin"])
def stats(db: Session = Depends(get_db)):
    return services.compute_stats(db)


@router.get("/meta", tags=["admin"])
def meta():
    """Enum reference values for building forms on the frontend."""
    return {
        "severities": [s.value for s in schemas.Severity],
        "categories": [c.value for c in schemas.Category],
        "statuses": [s.value for s in schemas.AlertStatus],
        "metrics": [m.value for m in schemas.Metric],
        "operators": [o.value for o in schemas.Operator],
        "txn_types": [t.value for t in schemas.TxnType],
    }
