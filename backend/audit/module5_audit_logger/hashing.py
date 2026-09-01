"""
Cryptographic hashing and tamper-evident SHA-256 chain utilities for Module 5.
"""

import hashlib
import json
from typing import Dict, Any

# Genesis hash used as previous_event_hash for the very first event in the chain
GENESIS_HASH = "0" * 64


def canonical_metadata_json(metadata: Dict[str, Any]) -> str:
    """
    Serializes metadata dict into a deterministic, canonical JSON string.
    Keys are sorted and delimiters have no superfluous whitespace.
    """
    if metadata is None:
        return "{}"
    return json.dumps(metadata, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def compute_event_hash(
    event_id: str,
    event_type: str,
    case_id: str,
    timestamp: str,
    source: str,
    status: str,
    metadata: Dict[str, Any],
    previous_event_hash: str
) -> str:
    """
    Computes a deterministic SHA-256 hash of an audit event including its previous hash.

    The hash envelope format:
    SHA256(event_id|event_type|case_id|timestamp|source|status|canonical_metadata|previous_hash)
    """
    meta_str = canonical_metadata_json(metadata)
    prev_hash_str = previous_event_hash if previous_event_hash else GENESIS_HASH

    payload = (
        f"{event_id}|"
        f"{event_type}|"
        f"{case_id}|"
        f"{timestamp}|"
        f"{source}|"
        f"{status}|"
        f"{meta_str}|"
        f"{prev_hash_str}"
    )

    return hashlib.sha256(payload.encode('utf-8')).hexdigest()
