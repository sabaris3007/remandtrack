"""
Data models for Module 5: Local Edge Cache & Audit Logger.
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, Any, Optional
import json


class AuditEventType(str, Enum):
    """Supported RemindTrack MVP audit event types."""
    ALERT_GENERATED = "ALERT_GENERATED"
    REVIEW_STARTED = "REVIEW_STARTED"
    REVIEW_COMPLETED = "REVIEW_COMPLETED"
    MEMO_GENERATED = "MEMO_GENERATED"
    MEMO_DISPATCHED = "MEMO_DISPATCHED"

    @classmethod
    def has_value(cls, value: str) -> bool:
        return value in cls._value2member_map_


@dataclass(frozen=True)
class AuditEvent:
    """
    Immutable representation of an audit event stored in the local SQLite ledger.
    """
    event_id: str
    event_type: str
    case_id: str
    timestamp: str  # ISO 8601 UTC format e.g. 2026-08-29T18:30:00Z
    source: str     # Originating component e.g. 'remindtrack.alert_engine'
    status: str     # e.g. 'SUCCESS', 'LOGGED', 'DISPATCHED'
    metadata: Dict[str, Any] = field(default_factory=dict)
    previous_event_hash: str = ""
    event_hash: str = ""
    sequence_num: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert AuditEvent to dictionary."""
        d = asdict(self)
        return d

    def metadata_json(self) -> str:
        """Returns canonical JSON representation of metadata."""
        return json.dumps(self.metadata, sort_keys=True, separators=(',', ':'))


@dataclass
class IntegrityCheckResult:
    """Result returned by tamper-evident hash-chain verification."""
    is_valid: bool
    total_events: int
    verified_events: int
    tampered_event_id: Optional[str] = None
    tampered_index: Optional[int] = None
    expected_hash: Optional[str] = None
    actual_hash: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
