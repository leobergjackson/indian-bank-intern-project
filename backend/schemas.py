"""Pydantic schemas (request/response models) and shared enums."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class Severity(str, Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Category(str, Enum):
    FRAUD = "Fraud"
    COMPLIANCE = "Compliance"
    RISK = "Risk"
    PERFORMANCE = "Performance"


class AlertStatus(str, Enum):
    ACTIVE = "Active"
    ACKNOWLEDGED = "Acknowledged"
    RESOLVED = "Resolved"


class Metric(str, Enum):
    TRANSACTION_AMOUNT = "transaction_amount"
    FUND_TRANSFER_AMOUNT = "fund_transfer_amount"
    TRANSACTION_COUNT = "transaction_count"        # rate-based (uses time_window_seconds)
    FAILED_LOGIN_COUNT = "failed_login_count"      # rate-based
    LOGIN_LOCATION = "login_location"              # unusual-location flag


class Operator(str, Enum):
    GT = ">"
    GTE = ">="
    LT = "<"
    LTE = "<="
    EQ = "=="
    NEQ = "!="


class TxnType(str, Enum):
    TRANSFER = "transfer"
    WITHDRAWAL = "withdrawal"
    DEPOSIT = "deposit"
    LOGIN = "login"


# --------------------------------------------------------------------------- #
# Serialization helper — emit UTC datetimes with a trailing "Z"
# --------------------------------------------------------------------------- #
def _iso_utc(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------- #
# Alert rules
# --------------------------------------------------------------------------- #
class AlertRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    category: Category
    severity: Severity
    metric: Metric
    operator: Operator = Operator.GT
    threshold_value: float = 0.0
    time_window_seconds: int = 0
    enabled: bool = True


class AlertRuleCreate(AlertRuleBase):
    pass


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = None
    category: Optional[Category] = None
    severity: Optional[Severity] = None
    metric: Optional[Metric] = None
    operator: Optional[Operator] = None
    threshold_value: Optional[float] = None
    time_window_seconds: Optional[int] = None
    enabled: Optional[bool] = None


class AlertRuleOut(AlertRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime

    @field_serializer("created_at", "updated_at")
    def _ser_dt(self, dt: datetime, _info):
        return _iso_utc(dt)


# --------------------------------------------------------------------------- #
# Alerts
# --------------------------------------------------------------------------- #
class AlertTaskBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    is_completed: bool = False


class AlertTaskCreate(AlertTaskBase):
    pass


class AlertTaskUpdate(BaseModel):
    is_completed: bool


class AlertTaskOut(AlertTaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alert_id: int
    created_at: datetime

    @field_serializer("created_at", when_used="always")
    def _ser_dt(self, dt: datetime, _info):
        return _iso_utc(dt)


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rule_id: Optional[int]
    rule_name: str
    category: str
    severity: str
    status: str
    metric: str
    threshold_value: float
    actual_value: float
    source: str
    message: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    tasks: list[AlertTaskOut] = []

    @field_serializer(
        "triggered_at", "acknowledged_at", "resolved_at", when_used="always"
    )
    def _ser_dt(self, dt: Optional[datetime], _info):
        return _iso_utc(dt)


class AlertStatusUpdate(BaseModel):
    status: AlertStatus
    actor: str = "operator"


# --------------------------------------------------------------------------- #
# Transactions
# --------------------------------------------------------------------------- #
class TransactionCreate(BaseModel):
    account_id: str = Field(..., min_length=1, max_length=40)
    amount: float = 0.0
    txn_type: TxnType = TxnType.TRANSFER
    location: str = ""
    ip_address: str = ""
    status: str = "success"


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: str
    amount: float
    txn_type: str
    location: str
    ip_address: str
    status: str
    created_at: datetime

    @field_serializer("created_at")
    def _ser_dt(self, dt: datetime, _info):
        return _iso_utc(dt)


# --------------------------------------------------------------------------- #
# System logs
# --------------------------------------------------------------------------- #
class SystemLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level: str
    category: str
    message: str
    created_at: datetime

    @field_serializer("created_at")
    def _ser_dt(self, dt: datetime, _info):
        return _iso_utc(dt)


# --------------------------------------------------------------------------- #
# Stats / metrics
# --------------------------------------------------------------------------- #
class StatsOut(BaseModel):
    total_alerts: int
    active: int
    acknowledged: int
    resolved: int
    by_severity: dict[str, int]
    by_category: dict[str, int]
    rules_total: int
    rules_enabled: int
    transactions_total: int
    alerts_last_24h: int
    simulator_running: bool
