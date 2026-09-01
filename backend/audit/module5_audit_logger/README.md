# Module 5: Local Edge Cache & Audit Logger

## 1. Purpose
**Module 5: Local Edge Cache & Audit Logger** is a lightweight, offline-resilient, tamper-evident audit logging subsystem designed specifically for the **RemindTrack MVP**.

In judicial undertrial reminder systems (such as statutory undertrial review tracking under Section 436A CrPC / Bharatiya Nagarik Suraksha Sanhita), courts and district legal service authorities (DLSA) require deterministic record-keeping that functions reliably in low-connectivity or air-gapped courtroom edge environments. Module 5 provides persistent local event recording with cryptographic tamper-evidence without relying on external cloud infrastructure or government APIs.

> **Human-in-the-Loop Judicial Boundary**: Module 5 strictly serves as an audit logger for human reminder and review events. It does **not** make bail decisions, compute judicial rulings, or issue release orders.

---

## 2. Responsibilities
- **Local Persistence**: Stores audit records in a dedicated local SQLite database file.
- **Event Logging**: Records lifecycle events for undertrial reminders:
  1. `ALERT_GENERATED`
  2. `REVIEW_STARTED`
  3. `REVIEW_COMPLETED`
  4. `MEMO_GENERATED`
  5. `MEMO_DISPATCHED`
- **Tamper-Evident SHA-256 Hash Chain**: Links every record cryptographically to its predecessor, enabling instant detection of historical record mutation or deletion.
- **Offline Resilience**: Operates 100% locally with zero internet, API, or cloud dependencies.
- **Strict Isolation**: Functions independently from Modules 1–4 with no shared mutable state, schema collisions, or invasive dependencies.

---

## 3. Directory Structure
```text
module5_audit_logger/
├── __init__.py          # Module public exports
├── README.md            # Module specification and documentation
├── models.py            # AuditEvent domain models and enums
├── interfaces.py        # IAuditLogger and IReadOnlyModuleAdapter abstractions
├── service.py           # AuditService implementation & validation
├── repository.py        # SQLite DAO and data access operations
├── database.py          # SQLite connection manager & DDL schema
├── hashing.py           # Deterministic SHA-256 computation & canonicalization
├── exceptions.py        # Dedicated custom exceptions
├── data/                # Dedicated storage directory
│   └── audit.db         # Module-exclusive SQLite database
└── tests/               # Comprehensive unit and integration test suite
    ├── __init__.py
    ├── test_database.py
    ├── test_hashing.py
    ├── test_repository.py
    ├── test_service.py
    ├── test_integration.py
    └── test_isolation.py
```

---

## 4. Database Location & Schema
The SQLite database defaults to `module5_audit_logger/data/audit.db`. Custom storage paths or `:memory:` configurations can be injected via `AuditDatabase(db_path=...)`.

### Schema Definition:
```sql
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
```

---

## 5. Event Types
Only the 5 MVP event types are accepted:

| Event Type | Description | Sample Metadata |
|---|---|---|
| `ALERT_GENERATED` | Undertrial statutory limit reminder triggered | `{"undertrial_days": 185, "limit_days": 180}` |
| `REVIEW_STARTED` | Judicial officer / clerk begins review | `{"reviewer_id": "JUDGE_04", "court": 2}` |
| `REVIEW_COMPLETED` | Judicial officer completes evaluation | `{"outcome": "MEMO_RECOMMENDED"}` |
| `MEMO_GENERATED` | Formal legal review reminder memo rendered | `{"template": "SEC_436A_FORM_V1"}` |
| `MEMO_DISPATCHED` | Reminder memo sent to DLSA/Jail Superintendent | `{"destination": "DLSA_CENTRAL"}` |

---

## 6. Public Interface (`IAuditLogger`)

```python
from module5_audit_logger import AuditService

service = AuditService()

# 1. Log an event
event = service.log_alert_generated(
    case_id="CNR-DLHC01-004521-2026",
    metadata={"statutory_section": "436A", "threshold_exceeded": True}
)

# 2. Query events
case_history = service.get_events_by_case("CNR-DLHC01-004521-2026")
alert_events = service.get_events_by_type("ALERT_GENERATED")
all_records = service.get_all_events()

# 3. Verify cryptographic integrity
result = service.verify_integrity()
if result.is_valid:
    print(f"Chain intact: {result.total_events} events verified.")
else:
    print(f"Tamper detected in event {result.tampered_event_id}: {result.error_message}")
```

---

## 7. Tamper-Evident SHA-256 Hash Chain
Each audit event contains:
- `previous_event_hash`: SHA-256 hash of the immediately preceding event (or 64 zeros `0000...0000` for the genesis event).
- `event_hash`: SHA-256 of the canonical event representation:
  ```text
  SHA256(event_id | event_type | case_id | timestamp | source | status | canonical_metadata_json | previous_event_hash)
  ```

### Verification Algorithm:
1. Sequentially iterates through all events in `sequence_num` order.
2. Checks that `event[i].previous_event_hash == event[i-1].event_hash`.
3. Re-computes the SHA-256 hash from event fields and ensures equality with stored `event_hash`.
4. Flags exact event index, ID, and reason if any field or chain link was modified.

---

## 8. Offline Behavior
- No external HTTP requests, sockets, cloud endpoints, or external database drivers.
- All transactions write directly to local disk using SQLite with WAL (Write-Ahead Logging) mode.
- Survives process crashes and machine reboots with guaranteed persistence.

---

## 9. Isolation Guarantees
- **Zero Files Changed Outside Module 5**: Contains all code, schemas, databases, and tests within `module5_audit_logger/`.
- **Zero Shared Mutable State**: Does not import internal state or mutate databases from Modules 1–4.
- **Read-Only Adapter**: External systems provide data via `ReadOnlyModuleAdapter` or standard parameters.
- **Standalone Execution**: Fully functional even when Modules 1–4 are completely absent.

---

## 10. Running the Tests
Run the standalone test suite using Python's built-in `unittest`:

```bash
python3 -m unittest discover -s module5_audit_logger/tests -p "test_*.py" -v
```
