"""Vercel serverless entry point for the FastAPI backend.

Vercel runs each request in a short-lived, stateless function. That means:
  * the always-on transaction simulator (a background loop) cannot run, and
  * the WebSocket endpoint (/ws/alerts) is not available.

So here we disable the simulator and ensure the database is created, default
rules are seeded, and a sample dataset exists on every cold start — because
serverless adapters may not run FastAPI's lifespan startup events. The frontend
falls back to polling for live updates when WebSockets aren't available.

Vercel detects the module-level `app` (an ASGI application) and serves it.
"""
import os

# No background simulator on serverless — seed sample data instead (below).
os.environ.setdefault("SIMULATOR_ENABLED", "false")

from backend.main import app  # noqa: E402  (ASGI app exported for Vercel)
from backend import services  # noqa: E402

# Lifespan events are not guaranteed to run under Vercel's serverless adapter,
# so initialise + seed explicitly at import time. Idempotent and best-effort.
try:
    services.bootstrap(generate_sample=True)
except Exception as exc:  # pragma: no cover - never block the function from starting
    print(f"[bootstrap] warning: {exc}")

__all__ = ["app"]
