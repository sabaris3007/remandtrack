"""
Service layer implementing IAuditLogger with tamper-evident SHA-256 chain verification.
"""

import threading
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from .models import AuditEvent, AuditEventType, IntegrityCheckResult
from .interfaces import IAuditLogger, IReadOnlyModuleAdapter
from .repository import AuditRepository
from .database import AuditDatabase
from .hashing import compute_event_hash, GENESIS_HASH
from .exceptions import (
    InvalidEventError,
    HumanInTheLoopViolationError,
)

FORBIDDEN_AUTOMATED_ACTIONS = {
    "AUTO_RELEASE",
    "AUTOMATIC_BAIL",
    "AUTOMATED_DISCHARGE",
    "DIRECT_RELEASE_ORDER",
    "AUTO_JUDICIAL_DECISION",
}


class AuditService(IAuditLogger):
    """
    Core service for Module 5. Handles event logging, hash chaining,
    querying, and tamper-evident integrity verification.
    """

    def __init__(self, repository: Optional[AuditRepository] = None, database: Optional[AuditDatabase] = None):
        if repository is not None:
            self.repo = repository
        else:
            db = database or AuditDatabase()
            self.repo = AuditRepository(db)

        self._lock = threading.Lock()

    def _validate_event_scope(self, event_type: str, metadata: Dict[str, Any]) -> None:
        """
        Enforces that event types belong to supported MVP scope and does not violate
        the human-in-the-loop judicial review boundary.
        """
        if not AuditEventType.has_value(event_type):
            raise InvalidEventError(
                f"Unsupported event_type '{event_type}'. "
                f"Supported types: {[e.value for e in AuditEventType]}"
            )

        # Check for prohibited automated release/judicial decisions
        action_intent = str(metadata.get("action_intent", "")).upper()
        if action_intent in FORBIDDEN_AUTOMATED_ACTIONS:
            raise HumanInTheLoopViolationError(
                f"Violation of Human-in-the-Loop boundary: Automated action '{action_intent}' is prohibited. "
                "Module 5 only records human review and reminder notifications, never automatic judicial orders."
            )

        if "automatic_release" in metadata and metadata["automatic_release"] is True:
            raise HumanInTheLoopViolationError(
                "Violation of Human-in-the-Loop boundary: Automated release flag is forbidden."
            )

    def log_event(
        self,
        event_type: str,
        case_id: str,
        source: str,
        status: str = "SUCCESS",
        metadata: Optional[Dict[str, Any]] = None,
        custom_event_id: Optional[str] = None,
        custom_timestamp: Optional[str] = None
    ) -> AuditEvent:
        """
        Atomically computes the tamper-evident hash chaining and stores the audit event in SQLite.
        """
        if not case_id or not str(case_id).strip():
            raise InvalidEventError("case_id is required and cannot be empty.")
        if not source or not str(source).strip():
            raise InvalidEventError("source is required and cannot be empty.")

        meta = metadata if metadata is not None else {}
        self._validate_event_scope(event_type, meta)

        event_id = custom_event_id or f"evt_{uuid.uuid4().hex[:12]}"
        timestamp = custom_timestamp or datetime.now(timezone.utc).isoformat()

        with self._lock:
            latest_event = self.repo.get_latest_event()
            previous_hash = latest_event.event_hash if latest_event else GENESIS_HASH

            event_hash = compute_event_hash(
                event_id=event_id,
                event_type=event_type,
                case_id=case_id,
                timestamp=timestamp,
                source=source,
                status=status,
                metadata=meta,
                previous_event_hash=previous_hash
            )

            raw_event = AuditEvent(
                event_id=event_id,
                event_type=event_type,
                case_id=case_id,
                timestamp=timestamp,
                source=source,
                status=status,
                metadata=meta,
                previous_event_hash=previous_hash,
                event_hash=event_hash
            )

            persisted_event = self.repo.insert_event(raw_event)
            return persisted_event

    def log_alert_generated(
        self,
        case_id: str,
        source: str = "remindtrack.alert_engine",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records an ALERT_GENERATED event (e.g. UT-Undertrial threshold exceeded)."""
        return self.log_event(
            event_type=AuditEventType.ALERT_GENERATED.value,
            case_id=case_id,
            source=source,
            status="SUCCESS",
            metadata=metadata
        )

    def log_review_started(
        self,
        case_id: str,
        source: str = "remindtrack.judicial_review",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a REVIEW_STARTED event when a judicial reviewer opens a flagged case."""
        return self.log_event(
            event_type=AuditEventType.REVIEW_STARTED.value,
            case_id=case_id,
            source=source,
            status="SUCCESS",
            metadata=metadata
        )

    def log_review_completed(
        self,
        case_id: str,
        source: str = "remindtrack.judicial_review",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a REVIEW_COMPLETED event when the human reviewer finishes evaluation."""
        return self.log_event(
            event_type=AuditEventType.REVIEW_COMPLETED.value,
            case_id=case_id,
            source=source,
            status="SUCCESS",
            metadata=metadata
        )

    def log_memo_generated(
        self,
        case_id: str,
        source: str = "remindtrack.memo_generator",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a MEMO_GENERATED event with structured reminder memo contents."""
        return self.log_event(
            event_type=AuditEventType.MEMO_GENERATED.value,
            case_id=case_id,
            source=source,
            status="SUCCESS",
            metadata=metadata
        )

    def log_memo_dispatched(
        self,
        case_id: str,
        source: str = "remindtrack.memo_dispatcher",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a MEMO_DISPATCHED event after routing memo to designated review authority."""
        return self.log_event(
            event_type=AuditEventType.MEMO_DISPATCHED.value,
            case_id=case_id,
            source=source,
            status="SUCCESS",
            metadata=metadata
        )

    def get_event(self, event_id: str) -> Optional[AuditEvent]:
        """Retrieves a single event by ID."""
        return self.repo.get_event_by_id(event_id)

    def get_events_by_case(self, case_id: str) -> List[AuditEvent]:
        """Retrieves all events for a specific case in sequence order."""
        return self.repo.get_events_by_case_id(case_id)

    def get_events_by_type(self, event_type: str) -> List[AuditEvent]:
        """Retrieves all events of a specific type in sequence order."""
        return self.repo.get_events_by_type(event_type)

    def get_all_events(self, limit: Optional[int] = None) -> List[AuditEvent]:
        """Retrieves all logged audit events in sequence order."""
        return self.repo.get_all_events(limit=limit)

    def verify_integrity(self) -> IntegrityCheckResult:
        """
        Validates the entire SHA-256 tamper-evident hash chain from the initial genesis
        event through every sequential record.

        Verifies:
        1. Linkage: Each event's `previous_event_hash` equals the preceding event's `event_hash`.
        2. Content: Recalculated hash matches stored `event_hash`.
        """
        events = self.repo.get_all_events()
        total = len(events)
        if total == 0:
            return IntegrityCheckResult(
                is_valid=True,
                total_events=0,
                verified_events=0,
                error_message=None
            )

        expected_prev_hash = GENESIS_HASH

        for idx, event in enumerate(events):
            # 1. Verify chain continuity
            if event.previous_event_hash != expected_prev_hash:
                return IntegrityCheckResult(
                    is_valid=False,
                    total_events=total,
                    verified_events=idx,
                    tampered_event_id=event.event_id,
                    tampered_index=idx,
                    expected_hash=expected_prev_hash,
                    actual_hash=event.previous_event_hash,
                    error_message=(
                        f"Hash chain linkage broken at event '{event.event_id}' (index {idx}). "
                        f"Expected previous_hash '{expected_prev_hash[:12]}...', got '{event.previous_event_hash[:12]}...'."
                    )
                )

            # 2. Recalculate event hash from raw fields
            recomputed = compute_event_hash(
                event_id=event.event_id,
                event_type=event.event_type,
                case_id=event.case_id,
                timestamp=event.timestamp,
                source=event.source,
                status=event.status,
                metadata=event.metadata,
                previous_event_hash=event.previous_event_hash
            )

            if recomputed != event.event_hash:
                return IntegrityCheckResult(
                    is_valid=False,
                    total_events=total,
                    verified_events=idx,
                    tampered_event_id=event.event_id,
                    tampered_index=idx,
                    expected_hash=recomputed,
                    actual_hash=event.event_hash,
                    error_message=(
                        f"Tamper detected in event '{event.event_id}' payload (index {idx}). "
                        f"Calculated SHA-256 '{recomputed[:12]}...' does not match stored hash '{event.event_hash[:12]}...'."
                    )
                )

            expected_prev_hash = event.event_hash

        return IntegrityCheckResult(
            is_valid=True,
            total_events=total,
            verified_events=total,
            error_message=None
        )


class ReadOnlyModuleAdapter(IReadOnlyModuleAdapter):
    """
    Standard read-only adapter that safely ingests external signals from
    Modules 1-4 without writing to, modifying, or coupling to their internal states.
    """

    def __init__(self, audit_service: IAuditLogger):
        self.audit_service = audit_service

    def consume_external_signal(self, payload: Dict[str, Any]) -> AuditEvent:
        """
        Ingests an external read-only event payload and records it in Module 5's SQLite ledger.
        """
        event_type = payload.get("event_type", AuditEventType.ALERT_GENERATED.value)
        case_id = payload.get("case_id", "CASE_UNKNOWN")
        source = payload.get("source", "external_module_adapter")
        status = payload.get("status", "SUCCESS")
        metadata = payload.get("metadata", {})

        return self.audit_service.log_event(
            event_type=event_type,
            case_id=case_id,
            source=source,
            status=status,
            metadata=metadata
        )
