"""
Module 5: Local Edge Cache & Audit Logger
RemindTrack MVP - Independent, offline-resilient, tamper-evident SQLite audit logger.
"""

from .models import AuditEvent, AuditEventType, IntegrityCheckResult
from .interfaces import IAuditLogger, IReadOnlyModuleAdapter
from .service import AuditService
from .repository import AuditRepository
from .database import AuditDatabase
from .exceptions import (
    AuditLoggerError,
    AuditIntegrityError,
    DatabaseConnectionError,
    InvalidEventError,
    HumanInTheLoopViolationError,
)

__all__ = [
    "AuditEvent",
    "AuditEventType",
    "IntegrityCheckResult",
    "IAuditLogger",
    "IReadOnlyModuleAdapter",
    "AuditService",
    "AuditRepository",
    "AuditDatabase",
    "AuditLoggerError",
    "AuditIntegrityError",
    "DatabaseConnectionError",
    "InvalidEventError",
    "HumanInTheLoopViolationError",
]
