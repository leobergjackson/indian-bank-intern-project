"""SQLAlchemy ORM models for the Banking Alert Management System."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC timestamp (stored consistently as UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AlertRule(Base):
    """A configurable rule that defines when an alert should fire."""

    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), nullable=False)        # Fraud/Compliance/Risk/Performance
    severity: Mapped[str] = mapped_column(String(10), nullable=False)        # Critical/High/Medium/Low
    metric: Mapped[str] = mapped_column(String(40), nullable=False)          # transaction_amount, etc.
    operator: Mapped[str] = mapped_column(String(3), nullable=False)         # >, >=, <, <=, ==, !=
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    time_window_seconds: Mapped[int] = mapped_column(Integer, default=0)     # for rate-based metrics
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    alerts: Mapped[list["Alert"]] = relationship(back_populates="rule")


class Alert(Base):
    """A triggered alert event produced when a rule's threshold is breached."""

    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("alert_rules.id"), nullable=True)
    rule_name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(15), default="Active")        # Active/Acknowledged/Resolved
    metric: Mapped[str] = mapped_column(String(40), nullable=False)
    threshold_value: Mapped[float] = mapped_column(Float, default=0.0)
    actual_value: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(80), default="")             # account / IP / system source
    message: Mapped[str] = mapped_column(Text, default="")
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    acknowledged_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(80), nullable=True)

    rule: Mapped["AlertRule"] = relationship(back_populates="alerts")
    tasks: Mapped[list["AlertTask"]] = relationship(back_populates="alert", cascade="all, delete-orphan")


class AlertTask(Base):
    """A sub-task or checklist item attached to an alert."""

    __tablename__ = "alert_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_id: Mapped[int] = mapped_column(ForeignKey("alerts.id"), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    alert: Mapped["Alert"] = relationship(back_populates="tasks")


class Transaction(Base):
    """A monitored transaction/event. The simulator and API write these."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    txn_type: Mapped[str] = mapped_column(String(20), default="transfer")    # transfer/withdrawal/deposit/login
    location: Mapped[str] = mapped_column(String(60), default="")
    ip_address: Mapped[str] = mapped_column(String(45), default="")
    status: Mapped[str] = mapped_column(String(20), default="success")       # success/failed (logins)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class SystemLog(Base):
    """Application/system log entries shown in the admin panel."""

    __tablename__ = "system_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    level: Mapped[str] = mapped_column(String(10), default="INFO")           # INFO/WARNING/ERROR
    category: Mapped[str] = mapped_column(String(30), default="system")
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
