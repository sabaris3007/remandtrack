from pathlib import Path
from typing import Any, Dict, Optional
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "audit"))

from module5_audit_logger import AuditService  # noqa: E402

app = FastAPI(title="RemindTrack Module 5 Audit Adapter", version="1.0.0")
DB_PATH = ROOT / "audit" / "module5_audit_logger" / "data" / "audit.db"
service = AuditService()

class AuditPayload(BaseModel):
    timestamp: Optional[str] = None
    magistrate_court: Optional[str] = None
    case_id: str
    action_type: str
    milestone: Optional[str] = None
    status: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)

ACTION_MAP = {
    "VIEW_DOCKET": "REVIEW_STARTED",
    "GENERATED_MEMO": "MEMO_GENERATED",
    "ISSUED_IO_INQUIRY": "REVIEW_STARTED",
    "INITIATED_JUDICIAL_REVIEW": "REVIEW_STARTED",
    "DLSA_REFERRAL": "MEMO_DISPATCHED",
    "IO_STATUS_UPDATE": "REVIEW_COMPLETED",
    "DLSA_BAIL_PETITION": "MEMO_DISPATCHED",
    "DISPATCHED_STATUTORY_ALERT": "ALERT_GENERATED",
}

@app.get("/healthz")
def health():
    return {"status": "ok", "module": "REMANDTRACK-Module5-Audit-Adapter", "db": str(DB_PATH)}

@app.post("/api/audit-log")
def log_event(payload: AuditPayload):
    event_type = ACTION_MAP.get(payload.action_type)
    if not event_type:
        raise HTTPException(status_code=400, detail=f"Unsupported frontend action_type: {payload.action_type}")
    metadata = dict(payload.meta)
    metadata.update({
        "frontend_action_type": payload.action_type,
        "milestone": payload.milestone,
        "magistrate_court": payload.magistrate_court,
    })
    try:
        event = service.log_event(
            event_type=event_type,
            case_id=payload.case_id,
            source="remindtrack.frontend",
            status=payload.status or "SUCCESS",
            metadata=metadata,
            custom_timestamp=payload.timestamp,
        )
        return {"success": True, "event": event.to_dict()}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@app.get("/api/audit/events")
def list_events(limit: int = 100):
    return {"events": [e.to_dict() for e in service.get_all_events(limit=max(1, min(limit, 1000)))]}

@app.get("/api/audit/verify")
def verify():
    return service.verify_integrity().to_dict()
