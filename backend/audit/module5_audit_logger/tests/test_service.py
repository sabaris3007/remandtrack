"""
Tests for service layer business rules, supported event types, and human-in-the-loop protection.
"""

import unittest
from module5_audit_logger.database import AuditDatabase
from module5_audit_logger.repository import AuditRepository
from module5_audit_logger.service import AuditService
from module5_audit_logger.models import AuditEventType
from module5_audit_logger.exceptions import (
    InvalidEventError,
    HumanInTheLoopViolationError,
)


class TestService(unittest.TestCase):

    def setUp(self):
        self.db = AuditDatabase(":memory:")
        self.repo = AuditRepository(self.db)
        self.service = AuditService(repository=self.repo)

    def test_log_all_five_mvp_event_types(self):
        """Verify that all 5 required MVP event types are logged accurately."""
        e1 = self.service.log_alert_generated(
            case_id="CNR-DL01-001234-2026",
            source="remindtrack.alert_engine",
            metadata={"undertrial_days": 185, "statutory_limit_days": 180}
        )
        self.assertEqual(e1.event_type, AuditEventType.ALERT_GENERATED.value)
        self.assertEqual(e1.sequence_num, 1)

        e2 = self.service.log_review_started(
            case_id="CNR-DL01-001234-2026",
            source="remindtrack.judicial_review",
            metadata={"judge_code": "JUDGE_04", "court_hall": 4}
        )
        self.assertEqual(e2.event_type, AuditEventType.REVIEW_STARTED.value)
        self.assertEqual(e2.previous_event_hash, e1.event_hash)

        e3 = self.service.log_review_completed(
            case_id="CNR-DL01-001234-2026",
            source="remindtrack.judicial_review",
            metadata={"outcome": "MEMO_RECOMMENDED", "notes": "Eligible for Sec 436A review"}
        )
        self.assertEqual(e3.event_type, AuditEventType.REVIEW_COMPLETED.value)
        self.assertEqual(e3.previous_event_hash, e2.event_hash)

        e4 = self.service.log_memo_generated(
            case_id="CNR-DL01-001234-2026",
            source="remindtrack.memo_generator",
            metadata={"template_id": "FORM_436A_REMINDER_V1"}
        )
        self.assertEqual(e4.event_type, AuditEventType.MEMO_GENERATED.value)
        self.assertEqual(e4.previous_event_hash, e3.event_hash)

        e5 = self.service.log_memo_dispatched(
            case_id="CNR-DL01-001234-2026",
            source="remindtrack.memo_dispatcher",
            metadata={"destination": "DLSA_CENTRAL_OFFICE", "channel": "LOCAL_QUEUE"}
        )
        self.assertEqual(e5.event_type, AuditEventType.MEMO_DISPATCHED.value)
        self.assertEqual(e5.previous_event_hash, e4.event_hash)

        all_events = self.service.get_all_events()
        self.assertEqual(len(all_events), 5)

    def test_unsupported_event_type_rejected(self):
        """Reject invalid event types outside MVP scope."""
        with self.assertRaises(InvalidEventError):
            self.service.log_event(
                event_type="UNAUTHORIZED_ACTION",
                case_id="C1",
                source="test"
            )

    def test_human_in_the_loop_boundary_enforced(self):
        """
        Ensure Module 5 strictly rejects any attempt to trigger automated bail/release orders.
        """
        # Attempt 1: action_intent = AUTO_RELEASE
        with self.assertRaises(HumanInTheLoopViolationError):
            self.service.log_event(
                event_type=AuditEventType.REVIEW_COMPLETED.value,
                case_id="C1",
                source="unauthorized_subsystem",
                metadata={"action_intent": "AUTO_RELEASE"}
            )

        # Attempt 2: automatic_release = True flag
        with self.assertRaises(HumanInTheLoopViolationError):
            self.service.log_event(
                event_type=AuditEventType.REVIEW_COMPLETED.value,
                case_id="C1",
                source="unauthorized_subsystem",
                metadata={"automatic_release": True}
            )


if __name__ == "__main__":
    unittest.main()
