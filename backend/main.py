"""FastAPI application entry point.

Run from the project root:
    uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import services
from .database import SessionLocal, init_db
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    services.set_event_loop(asyncio.get_running_loop())
    db = SessionLocal()
    try:
        services.seed_default_rules(db)
        services.log_event(db, "INFO", "system", "Banking Alert Management System started.")
    finally:
        db.close()
    if os.getenv("SIMULATOR_ENABLED", "true").lower() == "true":
        services.start_simulator()
    yield
    # Shutdown
    services.stop_simulator()


app = FastAPI(
    title="Banking Alert Management System",
    description="Monitors banking metrics/thresholds and raises alerts when limits are breached.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — open for local development (frontend dev server on a different port).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["meta"])
def root():
    return {
        "name": "Banking Alert Management System API",
        "status": "ok",
        "docs": "/docs",
        "websocket": "/ws/alerts",
    }


@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    """Live channel: pushes alert / transaction events to the dashboard."""
    await services.manager.connect(websocket)
    db = SessionLocal()
    try:
        await websocket.send_json({"type": "stats", "data": services.compute_stats(db)})
    finally:
        db.close()
    try:
        while True:
            # We don't need inbound messages; this keeps the socket open and
            # lets us detect disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        services.manager.disconnect(websocket)
    except Exception:
        services.manager.disconnect(websocket)
