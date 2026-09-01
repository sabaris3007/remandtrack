"""
Database connection and schema initialization for Module 5.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, Generator
from .exceptions import DatabaseConnectionError

DEFAULT_DB_PATH = str(Path(__file__).resolve().parent / "data" / "audit.db")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS audit_events (
    sequence_num INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    case_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata TEXT NOT NULL,
    previous_event_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_audit_case_id ON audit_events (case_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_event_id ON audit_events (event_id);
"""


class AuditDatabase:
    """
    Manages the dedicated SQLite database for Module 5 Local Edge Cache & Audit Logger.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path if db_path is not None else DEFAULT_DB_PATH
        self._mem_conn: Optional[sqlite3.Connection] = None
        self._ensure_storage_directory()
        self.initialize_schema()

    def _ensure_storage_directory(self) -> None:
        """Ensures the parent directory for the SQLite database file exists."""
        if self.db_path != ":memory:":
            parent_dir = Path(self.db_path).parent
            parent_dir.mkdir(parents=True, exist_ok=True)

    def get_connection(self) -> sqlite3.Connection:
        """Returns a configured SQLite connection."""
        try:
            if self.db_path == ":memory:":
                if self._mem_conn is None:
                    conn = sqlite3.connect(":memory:", check_same_thread=False)
                    conn.row_factory = sqlite3.Row
                    conn.execute("PRAGMA foreign_keys = ON;")
                    self._mem_conn = conn
                return self._mem_conn

            conn = sqlite3.connect(self.db_path, timeout=10.0)
            conn.row_factory = sqlite3.Row
            # Enable foreign keys and synchronous safety
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA journal_mode = WAL;")
            return conn
        except sqlite3.Error as e:
            raise DatabaseConnectionError(f"Failed to connect to SQLite database at '{self.db_path}': {e}") from e

    @contextmanager
    def connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager that safely yields a connection and closes it on exit."""
        conn = self.get_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            if self.db_path != ":memory:":
                conn.close()

    def close(self) -> None:
        """Closes in-memory connection if held."""
        if self._mem_conn is not None:
            self._mem_conn.close()
            self._mem_conn = None

    def initialize_schema(self) -> None:
        """Executes the DDL schema to ensure all tables and indexes exist."""
        try:
            with self.connection() as conn:
                conn.executescript(SCHEMA_SQL)
        except sqlite3.Error as e:
            raise DatabaseConnectionError(f"Failed to initialize audit schema in '{self.db_path}': {e}") from e

