"""
Tests for repository data access layer and SQLite queries.
"""

import unittest
from module5_audit_logger.database import AuditDatabase
from module5_audit_logger.repository import AuditRepository
from module5_audit_logger.models import AuditEvent, AuditEventType
from module5_audit_logger.hashing import GENESIS_HASH, compute_event_hash


class TestRepository(unittest.TestCase):

    def setUp(self):
        self.db = AuditDatabase(":memory:")
        self.repo = AuditRepository(self.db)

    def test_insert_and_retrieve_by_id(self):
        """Test inserting an audit event and retrieving it by event_id."""
        evt = AuditEvent(
            event_id="evt-101",
            event_type=AuditEventType.ALERT_GENERATED.value,
            case_id="CASE-9001",
            timestamp="2026-08-29T10:00:00Z",
            source="remindtrack.alert_engine",
            status="SUCCESS",
            metadata={"urgency": "HIGH"},
            previous_event_hash=GENESIS_HASH,
            event_hash="abc123hash"
        )
        saved = self.repo.insert_event(evt)
        self.assertEqual(saved.sequence_num, 1)

        retrieved = self.repo.get_event_by_id("evt-101")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.event_id, "evt-101")
        self.assertEqual(retrieved.case_id, "CASE-9001")
        self.assertEqual(retrieved.metadata["urgency"], "HIGH")

    def test_get_events_by_case_id(self):
        """Test retrieving all events filtered by case_id in sequence order."""
        for i in range(3):
            self.repo.insert_event(AuditEvent(
                event_id=f"evt-c1-{i}",
                event_type=AuditEventType.REVIEW_STARTED.value,
                case_id="CASE-A",
                timestamp=f"2026-08-29T10:0{i}:00Z",
                source="remindtrack.review",
                status="SUCCESS",
                metadata={"step": i},
                previous_event_hash=GENESIS_HASH,
                event_hash=f"hash-a-{i}"
            ))

        self.repo.insert_event(AuditEvent(
            event_id="evt-c2-0",
            event_type=AuditEventType.REVIEW_STARTED.value,
            case_id="CASE-B",
            timestamp="2026-08-29T10:05:00Z",
            source="remindtrack.review",
            status="SUCCESS",
            metadata={},
            previous_event_hash=GENESIS_HASH,
            event_hash="hash-b-0"
        ))

        case_a_events = self.repo.get_events_by_case_id("CASE-A")
        self.assertEqual(len(case_a_events), 3)
        self.assertEqual([e.event_id for e in case_a_events], ["evt-c1-0", "evt-c1-1", "evt-c1-2"])

    def test_get_events_by_type(self):
        """Test filtering events by event_type."""
        self.repo.insert_event(AuditEvent(
            event_id="evt-alert",
            event_type=AuditEventType.ALERT_GENERATED.value,
            case_id="CASE-1",
            timestamp="2026-08-29T10:00:00Z",
            source="remindtrack.alert",
            status="SUCCESS",
            metadata={},
            previous_event_hash=GENESIS_HASH,
            event_hash="h1"
        ))
        self.repo.insert_event(AuditEvent(
            event_id="evt-memo",
            event_type=AuditEventType.MEMO_DISPATCHED.value,
            case_id="CASE-1",
            timestamp="2026-08-29T10:01:00Z",
            source="remindtrack.memo",
            status="SUCCESS",
            metadata={},
            previous_event_hash="h1",
            event_hash="h2"
        ))

        alerts = self.repo.get_events_by_type(AuditEventType.ALERT_GENERATED.value)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].event_id, "evt-alert")

        memos = self.repo.get_events_by_type(AuditEventType.MEMO_DISPATCHED.value)
        self.assertEqual(len(memos), 1)
        self.assertEqual(memos[0].event_id, "evt-memo")


if __name__ == "__main__":
    unittest.main()
