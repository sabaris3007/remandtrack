"""
Tests for cryptographic hashing, deterministic canonicalization, and SHA-256 chain math.
"""

import unittest
from module5_audit_logger.hashing import compute_event_hash, canonical_metadata_json, GENESIS_HASH


class TestHashing(unittest.TestCase):

    def test_deterministic_hash_generation(self):
        """Ensure hashing is deterministic for identical payloads."""
        meta = {"risk": "HIGH", "threshold_days": 180}
        h1 = compute_event_hash(
            event_id="evt_01",
            event_type="ALERT_GENERATED",
            case_id="CASE-4421",
            timestamp="2026-08-29T12:00:00Z",
            source="remindtrack.alert_engine",
            status="SUCCESS",
            metadata=meta,
            previous_event_hash=GENESIS_HASH
        )
        h2 = compute_event_hash(
            event_id="evt_01",
            event_type="ALERT_GENERATED",
            case_id="CASE-4421",
            timestamp="2026-08-29T12:00:00Z",
            source="remindtrack.alert_engine",
            status="SUCCESS",
            metadata=meta,
            previous_event_hash=GENESIS_HASH
        )
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)  # SHA-256 hex string length

    def test_canonical_metadata_key_ordering_invariance(self):
        """Ensure key ordering in metadata dictionary produces identical SHA-256 hashes."""
        meta_order_a = {"alpha": 1, "beta": 2, "gamma": 3}
        meta_order_b = {"gamma": 3, "alpha": 1, "beta": 2}

        h_a = compute_event_hash("e1", "ALERT_GENERATED", "C1", "2026-08-29T00:00:00Z", "src", "OK", meta_order_a, GENESIS_HASH)
        h_b = compute_event_hash("e1", "ALERT_GENERATED", "C1", "2026-08-29T00:00:00Z", "src", "OK", meta_order_b, GENESIS_HASH)
        self.assertEqual(h_a, h_b)

    def test_hash_sensitivity_to_modifications(self):
        """Any subtle change in payload or previous hash must alter the resulting hash."""
        base_hash = compute_event_hash("e1", "ALERT_GENERATED", "C1", "2026-08-29T00:00:00Z", "src", "OK", {"k": 1}, GENESIS_HASH)
        modified_status_hash = compute_event_hash("e1", "ALERT_GENERATED", "C1", "2026-08-29T00:00:00Z", "src", "FAILED", {"k": 1}, GENESIS_HASH)
        modified_meta_hash = compute_event_hash("e1", "ALERT_GENERATED", "C1", "2026-08-29T00:00:00Z", "src", "OK", {"k": 2}, GENESIS_HASH)
        modified_prev_hash = compute_event_hash("e1", "ALERT_GENERATED", "C1", "2026-08-29T00:00:00Z", "src", "OK", {"k": 1}, "f" * 64)

        self.assertNotEqual(base_hash, modified_status_hash)
        self.assertNotEqual(base_hash, modified_meta_hash)
        self.assertNotEqual(base_hash, modified_prev_hash)


if __name__ == "__main__":
    unittest.main()
