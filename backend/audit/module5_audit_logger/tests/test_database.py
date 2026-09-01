"""
Tests for SQLite database initialization, schema configuration, and local persistence.
"""

import os
import tempfile
import unittest
import sqlite3
from module5_audit_logger.database import AuditDatabase
from module5_audit_logger.exceptions import DatabaseConnectionError


class TestDatabase(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test_audit.db")

    def tearDown(self):
        import gc
        gc.collect()
        self.temp_dir.cleanup()

    def test_database_creation_and_auto_schema_initialization(self):
        """Verify database file and required schema tables are created automatically."""
        self.assertFalse(os.path.exists(self.db_path))
        db = AuditDatabase(self.db_path)
        self.assertTrue(os.path.exists(self.db_path))

        with db.connection() as conn:
            # Check table exists
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_events';"
            )
            table = cursor.fetchone()
            self.assertIsNotNone(table)
            self.assertEqual(table["name"], "audit_events")

            # Check indexes exist
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_audit_%';"
            )
            indexes = [row["name"] for row in cursor.fetchall()]
            self.assertIn("idx_audit_case_id", indexes)
            self.assertIn("idx_audit_event_type", indexes)
            self.assertIn("idx_audit_timestamp", indexes)
            self.assertIn("idx_audit_event_id", indexes)

    def test_in_memory_database_support(self):
        """Verify in-memory SQLite support for lightweight isolated tests."""
        db = AuditDatabase(":memory:")
        with db.connection() as conn:
            cursor = conn.execute("SELECT count(*) as cnt FROM audit_events;")
            row = cursor.fetchone()
            self.assertEqual(row["cnt"], 0)

    def test_reinitialization_idempotency(self):
        """Verify initializing schema multiple times does not corrupt existing data."""
        db1 = AuditDatabase(self.db_path)
        with db1.connection() as conn:
            conn.execute(
                "INSERT INTO audit_events (event_id, event_type, case_id, timestamp, source, status, metadata, previous_event_hash, event_hash) "
                "VALUES ('e1', 'ALERT_GENERATED', 'C100', '2026-08-29T10:00:00Z', 'src', 'SUCCESS', '{}', '0'*64, 'hash1')"
            )
            conn.commit()

        # Open again using a new AuditDatabase instance on same path
        db2 = AuditDatabase(self.db_path)
        with db2.connection() as conn:
            cursor = conn.execute("SELECT count(*) as cnt FROM audit_events;")
            self.assertEqual(cursor.fetchone()["cnt"], 1)


if __name__ == "__main__":
    unittest.main()
