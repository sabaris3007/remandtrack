"""
Tests verifying Module 5 isolation, standalone independence, and read-only adapter behavior.
"""

import sys
import unittest
from module5_audit_logger.database import AuditDatabase
from module5_audit_logger.service import AuditService, ReadOnlyModuleAdapter
from module5_audit_logger.models import AuditEventType


class TestIsolation(unittest.TestCase):

    def test_standalone_independence_without_other_modules(self):
        """
        Verify that Module 5 initializes and operates with zero dependencies on Modules 1-4.
        """
        # Ensure no mock or real external modules are loaded
        for mod_name in ["module1", "module2", "module3", "module4"]:
            self.assertNotIn(mod_name, sys.modules)

        # Module 5 should initialize seamlessly
        db = AuditDatabase(":memory:")
        service = AuditService(database=db)

        event = service.log_alert_generated(
            case_id="CNR-STANDALONE-001",
            source="test_isolated_source",
            metadata={"status": "ISOLATED"}
        )
        self.assertIsNotNone(event.event_hash)
        self.assertEqual(service.verify_integrity().is_valid, True)

    def test_read_only_module_adapter_pattern(self):
        """
        Verify that external events are consumed strictly through read-only adapter pattern
        without requiring direct coupling or mutable state sharing.
        """
        db = AuditDatabase(":memory:")
        service = AuditService(database=db)
        adapter = ReadOnlyModuleAdapter(service)

        # Simulate read-only signal received from an external system
        external_signal = {
            "event_type": AuditEventType.MEMO_DISPATCHED.value,
            "case_id": "CASE-EXT-99",
            "source": "module4_memo_dispatch",
            "status": "DISPATCHED",
            "metadata": {"dispatch_method": "LOCAL_PRINT", "batch_id": "B-10"}
        }

        logged_event = adapter.consume_external_signal(external_signal)
        self.assertEqual(logged_event.case_id, "CASE-EXT-99")
        self.assertEqual(logged_event.event_type, AuditEventType.MEMO_DISPATCHED.value)

        # Verify event exists in Module 5 ledger
        fetched = service.get_event(logged_event.event_id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.metadata["batch_id"], "B-10")


if __name__ == "__main__":
    unittest.main()
