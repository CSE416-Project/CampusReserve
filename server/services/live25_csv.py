"""CSV export for 25Live's Data Import Tool.

While we only have read access to 25Live, an admin downloads the approved
bookings as a CSV and uploads it in 25Live (More menu -> Data Import Tool ->
Import Events CSV). The file follows CollegeNET's "CSV Event Import Formatting
Guidelines" (the events.csv service):

  * every column of the template, in the template's order, header row included
  * dates YYYY-MM-DD, times HH:MM:SS in 24-hour time, UTF-8 without a BOM
  * one row per event; a booking is a single occurrence, so it uses ADHOC_DATES
  * EVENT_ID becomes the 25Live "alien UID" with a "CSV-" prefix. We use the
    request's id, so uploading the same booking twice overwrites the 25Live
    event instead of creating a duplicate (unless someone edited it in 25Live)

Which bookings are already exported is tracked on the request itself
(Request.exported_at / export_batch_id), so each download only holds new ones.

Settings (environment variables), because these must match 25Live exactly:
    LIVE25_EVENT_TYPE            fallback only; each request's own event type (chosen on the booking form) is used
    LIVE25_PRIMARY_ORGANIZATION  default: the requesting club's name
    LIVE25_QUESTION_ATTRIBUTES   optional JSON mapping our event questions to the
                                 25Live custom-attribute names that hold them, e.g.
                                 {"food": "Serving Food", "minors": "Minors Present"}.
                                 Off by default: the template can't have extra columns, and
                                 a name 25Live doesn't know may be dropped. Without it, the
                                 answers go in INTERNAL_NOTES (and the details sheet).
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import os
import uuid
from dataclasses import dataclass, field

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from models.room import Request, RequestStatus, SyncStatus
from services.request_details import QUESTION_NAMES, EVENT_QUESTIONS, yes_names
from services.room_merge import campus_now

# Template columns, in order. Don't rename or reorder: 25Live rejects the file.
HEADERS = [
    "EVENT_ID", "EVENT_NAME", "EVENT_TITLE", "DESCRIPTION", "INTERNAL_NOTES", "EVENT_TYPE",
    "PRIMARY_ORGANIZATION", "REG_HEADCOUNT", "EXP_HEADCOUNT", "CATEGORIES", "INSTRUCTOR",
    "SCHEDULER", "REQUESTOR", "PROFILE_ID", "PROFILE_NAME", "FIRST_OCCURRENCE_DATE",
    "PRE_EVENT_TIME", "START_TIME", "END_TIME", "POST_EVENT_TIME", "REPEATING_RULE",
    "ADHOC_DATES", "LOCATIONS", "BOUND_PROFILE_ID", "RELATED_EVENT_ID", "CUSTOM_ATTRIBUTES",
]

# 25Live says a single occurrence is an "ad hoc" date. If the first test upload
# complains about dates, set this to False to use FIRST_OCCURRENCE_DATE instead.
USE_ADHOC_DATE = True

EVENT_NAME_LIMIT = 40    # 25Live's limit for EVENT_NAME
EVENT_TITLE_LIMIT = 120  # ...and EVENT_TITLE
CANCEL_WINDOW_DAYS = 14  # how long a cancelled-after-export booking stays on the to-do list


def event_type(req: Request | None = None) -> str:
    """The request's own event type (chosen on the booking form). LIVE25_EVENT_TYPE is only the fallback
    for a request that has none, and 25Live's usual student type is the last resort."""
    return (req.event_type if req is not None and req.event_type else None) or os.getenv("LIVE25_EVENT_TYPE") or "Student - Program"


def primary_organization_override() -> str | None:
    return os.getenv("LIVE25_PRIMARY_ORGANIZATION") or None


def question_attributes() -> dict[str, str]:
    """{our question key: 25Live attribute name}, from LIVE25_QUESTION_ATTRIBUTES (empty if unset/invalid)."""
    raw = os.getenv("LIVE25_QUESTION_ATTRIBUTES", "").strip()
    try:
        data = json.loads(raw) if raw else {}
    except ValueError:
        return {}
    return {k: str(v) for k, v in data.items() if k in EVENT_QUESTIONS and v} if isinstance(data, dict) else {}


def _custom_attributes(req: Request) -> str:
    """'Name:Yes|Name:No' for the mapped questions (25Live's name:value format); blank if never asked."""
    mapping, answers = question_attributes(), req.event_questions or {}
    if not mapping or not answers:
        return ""
    return "|".join(f"{' '.join(_clean(name).replace(':', ' ').split())}:{'Yes' if answers.get(k) else 'No'}"
                    for k, name in mapping.items())


def alien_uid(req: Request) -> str:
    """The id 25Live shows for an imported event."""
    return f"CSV-{req.id}"


@dataclass
class ExportRow:
    request: Request
    values: list[str]
    problems: list[str] = field(default_factory=list)  # can't be exported until fixed
    warnings: list[str] = field(default_factory=list)  # exported, but check these in 25Live


def _clean(text, limit: int | None = None) -> str:
    """One line, no '|' (25Live's separator for multiple values)."""
    out = " ".join(str(text or "").replace("|", "/").split())
    return out[:limit].rstrip() if limit else out


def _minutes(before: dt.datetime | None, after: dt.datetime) -> str:
    if before is None or before >= after:
        return ""
    return str(int((after - before).total_seconds() // 60))


def make_row(req: Request) -> ExportRow:
    problems: list[str] = []
    warnings: list[str] = []
    start, end = req.start_time, req.end_time

    if end - start >= dt.timedelta(hours=24):
        problems.append("Longer than 24 hours: 25Live's CSV import can't take it. "
                        "Enter this one in 25Live by hand.")

    room = req.room
    if room is not None and room.external_ref:
        location = str(room.external_ref)
    else:
        location = room.name if room is not None else ""
        if not location:
            problems.append("No room.")
        else:
            warnings.append(f"{location} has no 25Live ID, so its name is used: it must match "
                            "the 25Live location name exactly.")

    org_name = req.organization.name if req.organization is not None else ""
    attendance = str(req.expected_attendance) if (req.expected_attendance or 0) > 0 else ""

    who = ""
    if req.requester is not None:
        who = f" Requested by: {req.requester.name} <{req.requester.email}>."
    co_hosts = [o.name for o in req.co_hosts]
    extra = ""
    if co_hosts:
        extra += f" Co-hosting clubs: {', '.join(co_hosts)}."
    if req.program_advisor:
        extra += f" Program advisor: {req.program_advisor}."
    answers = req.event_questions or {}
    yes = yes_names(answers)
    if answers:  # {} = never asked (a request made before these questions existed)
        extra += f" Event questions, Yes: {', '.join(yes)}." if yes else " Event questions: all No."
    notes = _clean(f"CampusReserve request {req.id}. Organization: {org_name}.{who}{extra}")

    # The template has no column for these, so tell the admin what to add in 25Live.
    if co_hosts or req.program_advisor:
        warnings.append("Co-hosting clubs and the program advisor have no column in 25Live's template: "
                        "they're in INTERNAL_NOTES. Add them in 25Live after uploading.")
    if yes and not question_attributes():
        warnings.append(f"Answered Yes to {', '.join(yes)}: listed in INTERNAL_NOTES. "
                        "Answer these event questions in 25Live after uploading.")

    date = start.date().isoformat()
    values = {
        "EVENT_ID": str(req.id),
        "EVENT_NAME": _clean(req.event_name, EVENT_NAME_LIMIT),
        "EVENT_TITLE": _clean(req.event_name, EVENT_TITLE_LIMIT),
        "DESCRIPTION": _clean(req.description),
        "INTERNAL_NOTES": notes,
        "EVENT_TYPE": event_type(req),
        "PRIMARY_ORGANIZATION": _clean(primary_organization_override() or org_name),
        "EXP_HEADCOUNT": attendance,
        "PROFILE_ID": f"P-{req.id}",
        "FIRST_OCCURRENCE_DATE": "" if USE_ADHOC_DATE else date,
        "PRE_EVENT_TIME": _minutes(req.setup_start, start),
        "START_TIME": start.strftime("%H:%M:%S"),
        # If this is earlier than START_TIME, 25Live reads it as the next day.
        "END_TIME": end.strftime("%H:%M:%S"),
        "POST_EVENT_TIME": _minutes(end, req.cleanup_end) if req.cleanup_end else "",
        "ADHOC_DATES": date if USE_ADHOC_DATE else "",
        "LOCATIONS": _clean(location),
        "CUSTOM_ATTRIBUTES": _custom_attributes(req),
    }
    return ExportRow(req, [values.get(h, "") for h in HEADERS], problems, warnings)


def build_csv(rows: list[ExportRow]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(HEADERS)
    for row in rows:
        writer.writerow(row.values)
    return out.getvalue()  # sent as plain UTF-8: no byte-order mark


# ------------------------------------------------------------------ details sheet

DETAIL_HEADERS = (["REQUEST_ID", "EVENT_NAME", "ORGANIZATION", "CO_HOSTS", "ROOM", "DATE", "START_TIME",
                   "END_TIME", "SETUP_MINUTES", "CLEANUP_MINUTES", "EXPECTED_ATTENDANCE", "DESCRIPTION",
                   "REQUESTER", "REQUESTER_EMAIL", "PROGRAM_ADVISOR"]
                  + [name.upper().replace("/", "_").replace(" ", "_") for name in QUESTION_NAMES.values()])


def build_details_csv(reqs: list[Request]) -> str:
    """A companion sheet for admins (NOT for upload to 25Live): one row per request, one
    Yes/No column per event question, so it can be sorted and filtered (e.g. everyone serving
    food). A question never asked is left blank. Keeps the real import file within 25Live's template."""
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(DETAIL_HEADERS)
    for r in reqs:
        answers = r.event_questions or {}
        writer.writerow([
            str(r.id), r.event_name, r.organization.name if r.organization else "",
            "; ".join(o.name for o in r.co_hosts), r.room.name if r.room else "",
            r.start_time.date().isoformat(), r.start_time.strftime("%H:%M"), r.end_time.strftime("%H:%M"),
            _minutes(r.setup_start, r.start_time) or "0",
            (_minutes(r.end_time, r.cleanup_end) if r.cleanup_end else "") or "0",
            r.expected_attendance or "", r.description or "",
            r.requester.name if r.requester else "", r.requester.email if r.requester else "",
            r.program_advisor or "",
            *[("Yes" if answers.get(k) else "No") if answers else "" for k in QUESTION_NAMES],
        ])
    return out.getvalue()


# ------------------------------------------------------------------ database

def _base_query(db: Session):
    return db.query(Request).options(selectinload(Request.room),
                                     selectinload(Request.organization),
                                     selectinload(Request.requester))


def eligible(db: Session, *, include_past: bool = False, lock: bool = False) -> list[Request]:
    """Approved bookings not yet in a downloaded file and not already in 25Live.
    `lock` skips rows another admin is exporting right now (no double export)."""
    q = _base_query(db).filter(Request.status == RequestStatus.APPROVED,
                               Request.exported_at.is_(None),
                               Request.sync_status != SyncStatus.SYNCED)
    if not include_past:
        q = q.filter(Request.end_time >= campus_now())
    q = q.order_by(Request.start_time, Request.id)
    if lock:
        q = q.with_for_update(skip_locked=True, of=Request)
    return q.all()


def mark_exported(reqs: list[Request], now: dt.datetime) -> str:
    batch_id = str(uuid.uuid4())
    for req in reqs:
        req.exported_at = now
        req.export_batch_id = batch_id
    return batch_id


def batch_requests(db: Session, batch_id: str, *, lock: bool = False) -> list[Request]:
    q = _base_query(db).filter(Request.export_batch_id == batch_id).order_by(Request.start_time, Request.id)
    if lock:
        q = q.with_for_update(of=Request)
    return q.all()


def pending_cancellations(db: Session) -> list[Request]:
    """Bookings cancelled after they went into a downloaded file. 25Live would
    still hold the event if the file was uploaded, so an admin has to cancel it there."""
    cutoff = dt.datetime.utcnow() - dt.timedelta(days=CANCEL_WINDOW_DAYS)
    return (_base_query(db)
            .filter(Request.status == RequestStatus.CANCELLED,
                    Request.exported_at.isnot(None),
                    Request.cancel_handled_at.is_(None),
                    or_(Request.updated_at.is_(None), Request.updated_at >= cutoff))
            .order_by(Request.start_time, Request.id).all())
