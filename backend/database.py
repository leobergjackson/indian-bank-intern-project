"""Database setup: engine, session factory, and Base.

Uses SQLite by default (configurable via DATABASE_URL in the project .env).
The SQLite file lives in /database so it sits alongside schema.sql.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Project root = parent of /backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from the project-root .env (if present).
load_dotenv(BASE_DIR / ".env")

# Resolve the database URL. A relative sqlite path is interpreted relative to
# the project root so the app behaves the same regardless of CWD.
_raw_url = os.getenv("DATABASE_URL", "sqlite:///./database/banking_alerts.db")
if os.getenv("VERCEL") == "1":
    import shutil
    db_path = "/tmp/banking_alerts.db"
    source = BASE_DIR / "database" / "banking_alerts.db"
    if not os.path.exists(db_path) and source.exists():
        shutil.copy2(source, db_path)
    DATABASE_URL = f"sqlite:///{db_path}"
elif _raw_url.startswith("sqlite:///") and "./" in _raw_url:
    rel = _raw_url.replace("sqlite:///", "", 1)
    abs_path = (BASE_DIR / rel.lstrip("./")).resolve()
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{abs_path}"
else:
    DATABASE_URL = _raw_url

# check_same_thread=False is required because the simulator background task and
# request handlers may touch the session from different threads.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables. Imports models so they register with Base."""
    from . import models  # noqa: F401  (ensures models are imported)

    Base.metadata.create_all(bind=engine)
