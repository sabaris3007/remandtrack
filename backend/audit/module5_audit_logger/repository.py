"""
Repository layer for Module 5: Local Edge Cache & Audit Logger.
"""

import json
import sqlite3
from typing import List, Optional, Dict, Any
from .models import AuditEvent
from .database import AuditDatabase
from .exceptions import DatabaseConnectionError, InvalidEventError


class AuditRepository:
    """
    Data access object for persisting and retrieving audit records from SQLite.
    """

    def __init__(self, database: AuditDatabase):
        self.db = database

    def _row_to_event(self, row: sqlite3.Row) -> AuditEvent:
        """Converts an SQLite row into an AuditEvent domain model."""
        try:
            metadata = json.loads(row["metadata"]) if row["metadata"] else {}
        except Exception:
            metadata = {"raw": row["metadata"]}

        return AuditEvent(
            event_id=row["event_id"],
            event_type=row["event_type"],
            case_id=row["case_id"],
            timestamp=row["timestamp"],
            source=row["source"],
            status=row["status"],
            metadata=metadata,
            previous_event_hash=row["previous_event_hash"],
            event_hash=row["event_hash"],
            sequence_num=row["sequence_num"]
        )

    def insert_event(self, event: AuditEvent) -> AuditEvent:
        """
        Inserts a new audit record into SQLite within an atomic transaction.
        Returns the event with the generated sequence_num.
        """
        insert_sql = """
        INSERT INTO audit_events (
            event_id, event_type, case_id, timestamp, source, status,
            metadata, previous_event_hash, event_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        meta_json = json.dumps(event.metadata, sort_keys=True, separators=(',', ':'))

        try:
            with self.db.connection() as conn:
                cursor = conn.execute(
                    insert_sql,
                    (
                        event.event_id,
                        event.event_type,
                        event.case_id,
                        event.timestamp,
                        event.source,
                        event.status,
                        meta_json,
                        event.previous_event_hash,
                        event.event_hash
                    )
                )
                seq = cursor.lastrowid
                conn.commit()

            return AuditEvent(
                event_id=event.event_id,
                event_type=event.event_type,
                case_id=event.case_id,
                timestamp=event.timestamp,
                source=event.source,
                status=event.status,
                metadata=event.metadata,
                previous_event_hash=event.previous_event_hash,
                event_hash=event.event_hash,
                sequence_num=seq
            )
        except sqlite3.IntegrityError as e:
            raise InvalidEventError(f"Audit event with ID '{event.event_id}' already exists: {e}") from e
        except sqlite3.Error as e:
            raise DatabaseConnectionError(f"Database error during event insertion: {e}") from e

    def get_event_by_id(self, event_id: str) -> Optional[AuditEvent]:
        """Retrieves a single audit record by unique event_id."""
        query = "SELECT * FROM audit_events WHERE event_id = ?"
        with self.db.connection() as conn:
            row = conn.execute(query, (event_id,)).fetchone()
            if row:
                return self._row_to_event(row)
        return None

    def get_events_by_case_id(self, case_id: str) -> List[AuditEvent]:
        """Retrieves all audit events for a specific case ID in chronological order."""
        query = "SELECT * FROM audit_events WHERE case_id = ? ORDER BY sequence_num ASC"
        with self.db.connection() as conn:
            rows = conn.execute(query, (case_id,)).fetchall()
            return [self._row_to_event(r) for r in rows]

    def get_events_by_type(self, event_type: str) -> List[AuditEvent]:
        """Retrieves all audit events matching a specific event_type in chronological order."""
        query = "SELECT * FROM audit_events WHERE event_type = ? ORDER BY sequence_num ASC"
        with self.db.connection() as conn:
            rows = conn.execute(query, (event_type,)).fetchall()
            return [self._row_to_event(r) for r in rows]

    def get_all_events(self, limit: Optional[int] = None, offset: int = 0) -> List[AuditEvent]:
        """Retrieves audit records in chronological sequence order."""
        if limit is not None:
            query = "SELECT * FROM audit_events ORDER BY sequence_num ASC LIMIT ? OFFSET ?"
            params = (limit, offset)
        else:
            query = "SELECT * FROM audit_events ORDER BY sequence_num ASC"
            params = ()

        with self.db.connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_event(r) for r in rows]

    def get_latest_event(self) -> Optional[AuditEvent]:
        """Retrieves the most recently recorded audit event in the chain."""
        query = "SELECT * FROM audit_events ORDER BY sequence_num DESC LIMIT 1"
        with self.db.connection() as conn:
            row = conn.execute(query).fetchone()
            if row:
                return self._row_to_event(row)
        return None

    def count_events(self) -> int:
        """Returns total number of logged events."""
        query = "SELECT COUNT(*) as total FROM audit_events"
        with self.db.connection() as conn:
            row = conn.execute(query).fetchone()
            return row["total"] if row else 0

    def corrupt_event_for_tamper_testing(self, event_id: str, new_status: Optional[str] = None, new_metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Direct raw mutation utility strictly for testing/verifying tamper detection.
        Modifies stored payload without updating hash to simulate unauthorized tampering.
        """
        clauses = []
        params = []
        if new_status is not None:
            clauses.append("status = ?")
            params.append(new_status)
        if new_metadata is not None:
            clauses.append("metadata = ?")
            params.append(json.dumps(new_metadata, sort_keys=True, separators=(',', ':')))

        if not clauses:
            return False

        params.append(event_id)
        sql = f"UPDATE audit_events SET {', '.join(clauses)} WHERE event_id = ?"
        with self.db.connection() as conn:
            cursor = conn.execute(sql, params)
            conn.commit()
            return cursor.rowcount > 0
