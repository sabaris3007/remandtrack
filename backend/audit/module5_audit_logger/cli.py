"""
CLI helper for Module 5 to support programmatic execution from web wrappers.
"""

import sys
import json
import argparse
from module5_audit_logger.database import AuditDatabase
from module5_audit_logger.repository import AuditRepository
from module5_audit_logger.service import AuditService
from module5_audit_logger.models import AuditEventType


def get_service() -> AuditService:
    db = AuditDatabase()
    repo = AuditRepository(db)
    return AuditService(repository=repo)


def cmd_list(args):
    service = get_service()
    events = service.get_all_events()
    out = [e.to_dict() for e in events]
    print(json.dumps(out))


def cmd_log(args):
    service = get_service()
    meta = json.loads(args.metadata) if args.metadata else {}
    event = service.log_event(
        event_type=args.event_type,
        case_id=args.case_id,
        source=args.source,
        status=args.status,
        metadata=meta
    )
    print(json.dumps(event.to_dict()))


def cmd_verify(args):
    service = get_service()
    res = service.verify_integrity()
    print(json.dumps(res.to_dict()))


def cmd_tamper(args):
    db = AuditDatabase()
    repo = AuditRepository(db)
    meta = json.loads(args.metadata) if args.metadata else None
    success = repo.corrupt_event_for_tamper_testing(
        event_id=args.event_id,
        new_status=args.status,
        new_metadata=meta
    )
    print(json.dumps({"tampered": success, "event_id": args.event_id}))


def cmd_reset(args):
    db = AuditDatabase()
    with db.get_connection() as conn:
        conn.execute("DELETE FROM audit_events;")
        conn.commit()

    service = get_service()
    # Seed 4 standard MVP lifecycle events
    e1 = service.log_alert_generated(
        case_id="CNR-DLHC01-008742-2026",
        source="remindtrack.alert_engine",
        metadata={
            "undertrial_days": 182,
            "statutory_limit_days": 180,
            "statute_section": "CrPC 436A / BNSS 479",
            "urgency": "HIGH"
        }
    )
    e2 = service.log_review_started(
        case_id="CNR-DLHC01-008742-2026",
        source="remindtrack.judicial_review",
        metadata={
            "judicial_officer": "Additional Sessions Judge (Court 04)",
            "scheduled_time": "2026-08-29T10:15:00Z"
        }
    )
    e3 = service.log_review_completed(
        case_id="CNR-DLHC01-008742-2026",
        source="remindtrack.judicial_review",
        metadata={
            "review_outcome": "ISSUE_REMINDER_MEMO",
            "statutory_eligibility": "ELIGIBLE_HALF_TERM_REVIEW",
            "notes": "Verified custody certificate against chargesheet."
        }
    )
    e4 = service.log_memo_generated(
        case_id="CNR-DLHC01-008742-2026",
        source="remindtrack.memo_generator",
        metadata={
            "memo_id": "MEMO-436A-2026-0891",
            "recipient_authority": "Secretary DLSA / Superintendent Central Jail No. 4"
        }
    )
    e5 = service.log_memo_dispatched(
        case_id="CNR-DLHC01-008742-2026",
        source="remindtrack.memo_dispatcher",
        metadata={
            "dispatch_channel": "LOCAL_DISTRICT_LEGAL_SERVICES_GATEWAY",
            "dispatch_reference": "DISP-2026-DLSA-9904",
            "dispatch_status": "DELIVERED_TO_LOCAL_SPOOL"
        }
    )
    print(json.dumps({"status": "reset_and_seeded", "events_created": 5}))


def main():
    parser = argparse.ArgumentParser(description="RemindTrack Module 5 CLI")
    subparsers = parser.add_subparsers(dest="command")

    # list
    subparsers.add_parser("list")

    # log
    log_parser = subparsers.add_parser("log")
    log_parser.add_argument("--event-type", required=True)
    log_parser.add_argument("--case-id", required=True)
    log_parser.add_argument("--source", default="remindtrack.manual")
    log_parser.add_argument("--status", default="SUCCESS")
    log_parser.add_argument("--metadata", default="{}")

    # verify
    subparsers.add_parser("verify")

    # tamper
    tamper_parser = subparsers.add_parser("tamper")
    tamper_parser.add_argument("--event-id", required=True)
    tamper_parser.add_argument("--status", default=None)
    tamper_parser.add_argument("--metadata", default=None)

    # reset
    subparsers.add_parser("reset")

    args = parser.parse_args()
    if args.command == "list":
        cmd_list(args)
    elif args.command == "log":
        cmd_log(args)
    elif args.command == "verify":
        cmd_verify(args)
    elif args.command == "tamper":
        cmd_tamper(args)
    elif args.command == "reset":
        cmd_reset(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
