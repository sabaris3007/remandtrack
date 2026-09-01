"""
Abstract interfaces for Module 5: Local Edge Cache & Audit Logger.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from .models import AuditEvent, IntegrityCheckResult


class IAuditLogger(ABC):
    """
    Standard interface for recording and retrieving audit events within RemindTrack.
    """

    @abstractmethod
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
        """Records a generic audit event adhering to supported schema."""
        pass

    @abstractmethod
    def log_alert_generated(
        self,
        case_id: str,
        source: str = "remindtrack.alert_engine",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records an ALERT_GENERATED event."""
        pass

    @abstractmethod
    def log_review_started(
        self,
        case_id: str,
        source: str = "remindtrack.judicial_review",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a REVIEW_STARTED event."""
        pass

    @abstractmethod
    def log_review_completed(
        self,
        case_id: str,
        source: str = "remindtrack.judicial_review",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a REVIEW_COMPLETED event."""
        pass

    @abstractmethod
    def log_memo_generated(
        self,
        case_id: str,
        source: str = "remindtrack.memo_generator",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a MEMO_GENERATED event."""
        pass

    @abstractmethod
    def log_memo_dispatched(
        self,
        case_id: str,
        source: str = "remindtrack.memo_dispatcher",
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """Records a MEMO_DISPATCHED event."""
        pass

    @abstractmethod
    def get_event(self, event_id: str) -> Optional[AuditEvent]:
        """Retrieves an event by its unique ID."""
        pass

    @abstractmethod
    def get_events_by_case(self, case_id: str) -> List[AuditEvent]:
        """Retrieves all events logged for a specific case."""
        pass

    @abstractmethod
    def get_events_by_type(self, event_type: str) -> List[AuditEvent]:
        """Retrieves all events of a given type."""
        pass

    @abstractmethod
    def get_all_events(self, limit: Optional[int] = None) -> List[AuditEvent]:
        """Retrieves all logged audit events in sequence order."""
        pass

    @abstractmethod
    def verify_integrity(self) -> IntegrityCheckResult:
        """Validates the entire SHA-256 hash chain and detects tampering."""
        pass


class IReadOnlyModuleAdapter(ABC):
    """
    Adapter interface to safely interface with external modules (Modules 1-4)
    without mutating external state, APIs, or databases.
    """

    @abstractmethod
    def consume_external_signal(self, payload: Dict[str, Any]) -> AuditEvent:
        """Consumes a read-only external signal and logs an audit record."""
        pass
