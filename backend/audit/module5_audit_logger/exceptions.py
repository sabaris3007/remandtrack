"""
Exceptions for Module 5: Local Edge Cache & Audit Logger.
"""


class AuditLoggerError(Exception):
    """Base exception for all Module 5 audit logger errors."""
    pass


class AuditIntegrityError(AuditLoggerError):
    """Raised when the hash chain is broken or event data has been tampered with."""
    pass


class DatabaseConnectionError(AuditLoggerError):
    """Raised when SQLite database initialization or connection fails."""
    pass


class InvalidEventError(AuditLoggerError):
    """Raised when an invalid event payload or unsupported event type is provided."""
    pass


class HumanInTheLoopViolationError(AuditLoggerError):
    """
    Raised when an action violates the RemindTrack human-in-the-loop principle
    (e.g., automated release or judicial decision attempts).
    """
    pass
