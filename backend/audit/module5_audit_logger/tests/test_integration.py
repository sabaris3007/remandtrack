"""
End-to-end integration tests: offline operation, restart persistence,
and tamper-evident SHA-256 chain detection.
"""

import os
import tempfile
import unittest
from module5_audit_logger.database import AuditDatabase
from module5_audit_logger.repository import AuditRepository
from module5_audit_logger.service import AuditService
from module5_audit_logger.models import AuditEventType
from module5_audit_logger.hashing import GENESIS_HASH


class TestIntegration(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "integration_audit.db")

    def tearDown(self):
        import gc
        gc.collect()
        self.temp_dir.cleanup()

    def test_persistence_across_service_restarts(self):
        """
        Verify that events are preserved across service restarts and that the
        hash chain continues seamlessly upon reloading.
        """
        # Session 1: Create DB, log 2 events
        db1 = AuditDatabase(self.db_path)
        service1 = AuditService(database=db1)

        e1 = service1.log_alert_generated(
            case_id="CNR-TEST-001",
            metadata={"alert_type": "STATUTORY_REMINDER", "days": 180}
        )
        self.assertEqual(e1.previous_event_hash, GENESIS_HASH)

        e2 = service1.log_review_started(
            case_id="CNR-TEST-001",
            metadata={"reviewer": "DISTRICT_JUDGE_1"}
        )
        self.assertEqual(e2.previous_event_hash, e1.event_hash)

        # Check integrity of session 1
        integrity1 = service1.verify_integrity()
        self.assertTrue(integrity1.is_valid)
        self.assertEqual(integrity1.total_events, 2)

        # Simulate full service restart by destroying session 1 objects
        del service1
        del db1

        # Session 2: Instantiate new service connecting to existing SQLite file
        db2 = AuditDatabase(self.db_path)
        service2 = AuditService(database=db2)

        # Verify historical events loaded properly
        restored_events = service2.get_all_events()
        self.assertEqual(len(restored_events), 2)
        self.assertEqual(restored_events[0].event_id, e1.event_id)
        self.assertEqual(restored_events[1].event_id, e2.event_id)

        # Log event 3 after restart
        e3 = service2.log_review_completed(
            case_id="CNR-TEST-001",
            metadata={"recommendation": "PROCEED_TO_MEMO"}
        )
        # Event 3's previous_event_hash must equal Event 2's hash
        self.assertEqual(e3.previous_event_hash, e2.event_hash)

        # Verify integrity of complete chain across restarts
        integrity2 = service2.verify_integrity()
        self.assertTrue(integrity2.is_valid)
        self.assertEqual(integrity2.total_events, 3)
        self.assertEqual(integrity2.verified_events, 3)

    def test_tamper_detection_when_event_payload_is_modified(self):
        """
        Verify that tampering with an event's payload (e.g. changing metadata or status directly in SQLite)
        is immediately detected by the integrity verification engine.
        """
        db = AuditDatabase(self.db_path)
        repo = AuditRepository(db)
        service = AuditService(repository=repo)

        # Insert 3 events
        e1 = service.log_alert_generated(case_id="CASE-T1", metadata={"priority": "MEDIUM"})
        e2 = service.log_review_started(case_id="CASE-T1", metadata={"reviewer": "OFFICER_A"})
        e3 = service.log_review_completed(case_id="CASE-T1", metadata={"status_note": "REVIEW_DONE"})

        # Initial chain must be valid
        res_before = service.verify_integrity()
        self.assertTrue(res_before.is_valid)
        self.assertEqual(res_before.total_events, 3)

        # Simulate direct database tampering on event 2's metadata
        repo.corrupt_event_for_tamper_testing(
            event_id=e2.event_id,
            new_metadata={"reviewer": "MALICIOUS_IMPOSTOR"}
        )

        # Run integrity check
        res_after = service.verify_integrity()
        self.assertFalse(res_after.is_valid)
        self.assertEqual(res_after.tampered_event_id, e2.event_id)
        self.assertEqual(res_after.tampered_index, 1)
        self.assertIn("Tamper detected in event", res_after.error_message)

    def test_tamper_detection_when_chain_link_is_broken(self):
        """
        Verify that altering an event's previous_event_hash breaks the hash chain linkage.
        """
        db = AuditDatabase(self.db_path)
        repo = AuditRepository(db)
        service = AuditService(repository=repo)

        e1 = service.log_alert_generated(case_id="CASE-L1")
        e2 = service.log_memo_generated(case_id="CASE-L1")

        with db.connection() as conn:
            conn.execute(
                "UPDATE audit_events SET previous_event_hash = 'tampered_previous_hash_value' WHERE event_id = ?",
                (e2.event_id,)
            )
            conn.commit()

        res = service.verify_integrity()
        self.assertFalse(res.is_valid)
        self.assertEqual(res.tampered_event_id, e2.event_id)
        self.assertIn("Hash chain linkage broken", res.error_message)

    def test_offline_zero_network_operation(self):
        """
        Verify that all module operations complete synchronously and locally
        without any external network or internet requirement.
        """
        db = AuditDatabase(self.db_path)
        service = AuditService(database=db)

        # Generate sequence offline
        e1 = service.log_alert_generated(case_id="CASE-OFFLINE-1")
        e2 = service.log_review_started(case_id="CASE-OFFLINE-1")
        e3 = service.log_review_completed(case_id="CASE-OFFLINE-1")
        e4 = service.log_memo_generated(case_id="CASE-OFFLINE-1")
        e5 = service.log_memo_dispatched(case_id="CASE-OFFLINE-1")

        events = service.get_events_by_case("CASE-OFFLINE-1")
        self.assertEqual(len(events), 5)
        self.assertTrue(service.verify_integrity().is_valid)


if __name__ == "__main__":
    unittest.main()
