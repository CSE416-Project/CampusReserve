"""Pushing approved bookings to 25Live (FR-11).

Two interchangeable providers, picked by the LIVE25_SYNC_MODE setting:

  manual (default)  We only have read access to 25Live. Approving a request
                    leaves it "not_synced" and produces step-by-step details
                    for an admin to enter in 25Live by hand; the admin then
                    records the 25Live reference with
                    POST /admin/requests/{id}/sync/confirm, which marks it
                    "synced".

  api               For when SBU grants write access. Approving a request
                    creates the booking in 25Live automatically and stores
                    the reference ("synced"), or marks it "failed" so an
                    admin can retry from GET /admin/sync.

Until a request is "synced", our availability checks treat it as booked, so
the room can't be double-booked through CampusReserve in the meantime.

API mode settings:
    LIVE25_WRITE_URL     endpoint that creates an event
    LIVE25_CANCEL_URL    endpoint that cancels one; "{ref}" is replaced
    LIVE25_USERNAME / LIVE25_PASSWORD   the service account
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

import httpx

from models.room import SyncStatus
from services.request_details import DEFAULT_EVENT_TYPE, description_html, yes_answers

logger = logging.getLogger(__name__)

LIVE25_PRO_URL = "https://25live.collegenet.com/pro/stonybrook"


@dataclass
class SyncResult:
    status: SyncStatus
    external_ref: str | None = None
    message: str = ""
    instructions: dict = field(default_factory=dict)


def booking_details(*, event_name: str, organization: str, space_id: str | None,
                    room_name: str, start, end, setup_start, cleanup_end,
                    attendance: int | None, request_id: str,
                    event_type: str | None = None, description: str | None = None,
                    event_questions: dict | None = None, co_hosts=(),
                    program_advisor: str | None = None, requester_name: str | None = None,
                    requester_email: str | None = None) -> dict:
    """Everything needed to create the booking in 25Live, in one place.

    This is the field mapping between our request and 25Live's request form:
      event_name          -> "Event Name" AND "Event Title" (25Live wants them identical)
      event_type          -> "Event Type"
      organization        -> "Primary Organization for this Event"
      co_hosts            -> "Additional Organization(s) for this Event"
      attendance          -> "Expected Head Count"
      description_html    -> "Event Description (HTML-Enabled)"
      event/setup/cleanup -> "Event Date and Time" + "Additional time"
      space_id            -> "Event Locations"
      event_questions_yes -> "Event Questions" (answer Yes to these, No to the rest)
      requester_*         -> "Requestor" and "Scheduler" contact roles
      program_advisor     -> "Program Advisor" contact role
    """
    def t(x):
        return x.strftime("%a %b %-d, %Y %-I:%M %p") if x else None

    return {
        "event_name": event_name,
        "event_title": event_name,
        "event_type": event_type or DEFAULT_EVENT_TYPE,
        "organization": organization,
        "co_hosts": [getattr(o, "name", str(o)) for o in co_hosts],
        "room": room_name,
        "space_id": space_id,
        "event_start": t(start),
        "event_end": t(end),
        "setup_start": t(setup_start),
        "cleanup_end": t(cleanup_end),
        "expected_attendance": attendance,
        "description": description,
        "description_html": description_html(description),
        # {} means the requester was never asked (an older request).
        "event_questions": dict(event_questions or {}),
        "event_questions_yes": yes_answers(event_questions),
        "requester_name": requester_name,
        "requester_email": requester_email,
        "program_advisor": program_advisor,
        "campusreserve_request_id": request_id,
    }


def manual_steps(details: dict, *, cancel: bool = False) -> list[str]:
    """What an admin does in 25Live by hand."""
    where = f"{details['room']}" + (f" (25Live location {details['space_id']})"
                                    if details.get("space_id") else "")
    if cancel:
        return [
            f"Open 25Live: {LIVE25_PRO_URL}",
            f"Find the event \"{details['event_name']}\" in {where} on {details['event_start']}.",
            "Cancel the event in 25Live.",
        ]
    steps = [
        f"Open 25Live: {LIVE25_PRO_URL}",
        "Create a new event.",
        f"Event Name and Event Title (the same text in both): {details['event_name']}",
        f"Event Type: {details.get('event_type') or DEFAULT_EVENT_TYPE}",
        f"Primary Organization: {details['organization']}",
    ]
    if details.get("co_hosts"):
        steps.append(f"Additional Organization(s): {', '.join(details['co_hosts'])}")
    if details.get("expected_attendance"):
        steps.append(f"Expected Head Count: {details['expected_attendance']}")
    if details.get("description"):
        steps.append(f"Event Description: {details['description']}")
    steps.append(f"Event Date and Time: {details['event_start']} to {details['event_end']}")
    if details.get("setup_start") or details.get("cleanup_end"):
        steps.append(f"Additional time: reserve the room from "
                     f"{details['setup_start'] or details['event_start']} "
                     f"to {details['cleanup_end'] or details['event_end']} (setup/cleanup).")
    steps.append(f"Event Locations: {where}")
    if details.get("event_questions"):  # {} = the requester was never asked
        yes = details.get("event_questions_yes") or []
        if yes:
            listed = "; ".join(f'"{q}"' for q in yes)
            steps.append(f"Event Questions: answer Yes to {listed}, and No to all the others.")
        else:
            steps.append("Event Questions: answer No to every question.")
    contacts = []
    if details.get("requester_name"):
        who = details["requester_name"] + (f" ({details['requester_email']})"
                                           if details.get("requester_email") else "")
        contacts.append(f"Requestor and Scheduler: {who}")
    if details.get("program_advisor"):
        contacts.append(f"Program Advisor: {details['program_advisor']}")
    if contacts:
        steps.append("Contact Roles: " + "  |  ".join(contacts))
    steps.append("Tick \"I agree to adhere to all building policies\" "
                 "(the requester agreed to them in CampusReserve).")
    steps.append("Save it, then copy the 25Live event reference/ID and record it in "
                 f"CampusReserve (POST /admin/requests/{details['campusreserve_request_id']}"
                 "/sync/confirm).")
    return steps


class ManualSync:
    mode = "manual"

    async def push(self, details: dict) -> SyncResult:
        return SyncResult(
            status=SyncStatus.NOT_SYNCED,
            message="Enter this booking in 25Live, then record its 25Live reference.",
            instructions={"details": details, "steps": manual_steps(details)},
        )

    async def cancel(self, details: dict, external_ref: str | None) -> SyncResult:
        if not external_ref:
            return SyncResult(status=SyncStatus.NOT_SYNCED, message="Never entered in 25Live.")
        return SyncResult(
            status=SyncStatus.NOT_SYNCED,
            message=f"Cancel 25Live event {external_ref} by hand.",
            instructions={"details": details,
                          "steps": manual_steps(details, cancel=True)},
        )


class ApiSync:
    """Creates/cancels bookings through a 25Live write API.

    CHECK BEFORE USING: written without access to SBU's 25Live write API, so
    the request format below is a placeholder. When you get write access,
    find the real endpoint and payload (25Live's web services docs, or the
    request the 25Live web app sends when you save an event) and adjust
    `_payload` and `_extract_ref` to match. Everything else (statuses,
    retries, notifications) already works.
    """

    mode = "api"

    def __init__(self):
        self.write_url = os.getenv("LIVE25_WRITE_URL")
        self.cancel_url = os.getenv("LIVE25_CANCEL_URL")
        self.auth = (os.getenv("LIVE25_USERNAME", ""), os.getenv("LIVE25_PASSWORD", ""))

    def _payload(self, details: dict) -> dict:
        return {
            "event_name": details["event_name"],
            "organization": details["organization"],
            "space_id": details["space_id"],
            "start": details["setup_start"] or details["event_start"],
            "end": details["cleanup_end"] or details["event_end"],
            "event_start": details["event_start"],
            "event_end": details["event_end"],
            "head_count": details["expected_attendance"],
            "event_title": details["event_title"],
            "event_type": details["event_type"],
            "additional_organizations": details["co_hosts"],
            "description_html": details["description_html"],
            "event_questions": details["event_questions"],
            "requester_email": details["requester_email"],
            "program_advisor": details["program_advisor"],
        }

    def _extract_ref(self, response_json) -> str | None:
        for key in ("event_id", "eventId", "id", "reservation_id"):
            if isinstance(response_json, dict) and response_json.get(key):
                return str(response_json[key])
        return None

    async def push(self, details: dict) -> SyncResult:
        if not self.write_url:
            return SyncResult(SyncStatus.FAILED, message="LIVE25_WRITE_URL isn't set.")
        if not details.get("space_id"):
            return SyncResult(SyncStatus.FAILED,
                              message="This room has no 25Live location (Room.external_ref).")
        try:
            async with httpx.AsyncClient(timeout=30, auth=self.auth) as client:
                r = await client.post(self.write_url, json=self._payload(details))
                r.raise_for_status()
                ref = self._extract_ref(r.json())
        except (httpx.HTTPError, ValueError) as e:
            logger.warning("25Live push failed for %s: %s",
                           details["campusreserve_request_id"], e)
            return SyncResult(SyncStatus.FAILED, message=f"25Live rejected the booking: {e}")
        if not ref:
            return SyncResult(SyncStatus.FAILED,
                              message="25Live accepted the booking but returned no reference.")
        return SyncResult(SyncStatus.SYNCED, external_ref=ref, message="Created in 25Live.")

    async def cancel(self, details: dict, external_ref: str | None) -> SyncResult:
        if not external_ref:
            return SyncResult(SyncStatus.NOT_SYNCED, message="Never created in 25Live.")
        if not self.cancel_url:
            return SyncResult(SyncStatus.FAILED, message="LIVE25_CANCEL_URL isn't set.")
        try:
            async with httpx.AsyncClient(timeout=30, auth=self.auth) as client:
                r = await client.delete(self.cancel_url.replace("{ref}", external_ref))
                r.raise_for_status()
        except httpx.HTTPError as e:
            return SyncResult(SyncStatus.FAILED, external_ref=external_ref,
                              message=f"Couldn't cancel in 25Live: {e}")
        return SyncResult(SyncStatus.NOT_SYNCED, external_ref=external_ref,
                          message="Cancelled in 25Live.")


def get_provider() -> ManualSync | ApiSync:
    return ApiSync() if os.getenv("LIVE25_SYNC_MODE", "manual").lower() == "api" else ManualSync()
