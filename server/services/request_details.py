"""The extra event details on a booking request (what 25Live's request form asks for).

25Live's form has ~11 sections; CampusReserve asks the leader for a handful and
infers the rest (primary organization, requestor/scheduler, event title = name).
This module owns the data side of that:

  - the 13 yes/no "Event Questions" and their exact 25Live wording,
  - cleaning/validating what the form sends,
  - turning the description into the HTML 25Live's editor expects.

The 25Live *field mapping* itself (which of our fields goes in which 25Live box)
lives with the rest of the adapter code in live25_sync.py.
"""

from __future__ import annotations

import html
from dataclasses import dataclass, field

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.organization_and_venue import Organization
from services.permissions import as_uuid

# 25Live's own default for nearly every club event.
DEFAULT_EVENT_TYPE = "Student - Program"

MAX_CO_HOSTS = 5

# key -> the question exactly as 25Live words it. Order = order on 25Live's form.
EVENT_QUESTIONS: dict[str, str] = {
    "selling": "Are you selling anything at this event?",
    "food": "Are you serving any food at this event?",
    "av": "Do you require A/V for this event?",
    "special_setup": "Do you require a special setup?",
    "art_crafts": "Will any art/crafting activities occur at this event?",
    "minors": "Will there be any minors from off-campus (16 and under) present at this event?",
    "guest_speaker": "Will there be a guest speaker?",
    "photographer": "Will there be a photo/videographer?",
    "live_performance": "Will there be any live performance during this event?",
    "dj": "Will you be using a DJ?",
    "electrical": "Will you need electrical access?",
    "photo_booth": "Would you like a Photo Booth for your event?",
    "special_lighting": "Would you like any special lighting for your event?",
}


# Short names, for notes and the details sheet (the long wording above is 25Live's own).
QUESTION_NAMES: dict[str, str] = {
    "selling": "Selling", "food": "Food", "av": "A/V", "special_setup": "Special setup",
    "art_crafts": "Art/crafts", "minors": "Minors", "guest_speaker": "Guest speaker",
    "photographer": "Photo/video", "live_performance": "Live performance", "dj": "DJ",
    "electrical": "Electrical", "photo_booth": "Photo booth", "special_lighting": "Special lighting",
}


def yes_names(answers: dict[str, bool] | None) -> list[str]:
    """Short names of every question answered Yes, in form order."""
    answers = answers or {}
    return [name for key, name in QUESTION_NAMES.items() if answers.get(key)]


@dataclass
class EventDetails:
    """Everything beyond the basics (room, time, name, headcount) on a request."""

    event_type: str = DEFAULT_EVENT_TYPE
    description: str | None = None
    # Empty = never answered (e.g. requests made before these questions existed).
    # Otherwise it holds all 13 keys, True/False.
    event_questions: dict[str, bool] = field(default_factory=dict)
    co_hosts: list[Organization] = field(default_factory=list)
    program_advisor: str | None = None
    policy_agreed: bool = False


def clean_text(value: str | None) -> str | None:
    """Trimmed text, or None if it's empty/blank."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def check_question_keys(answers: dict[str, bool]) -> dict[str, bool]:
    """Raise ValueError for a key that isn't one of the 13 questions (use in validators)."""
    unknown = sorted(set(answers) - set(EVENT_QUESTIONS))
    if unknown:
        raise ValueError(f"Unknown event question(s): {', '.join(unknown)}")
    return answers


def normalize_questions(answers: dict[str, bool] | None) -> dict[str, bool]:
    """All 13 questions in form order, False unless answered yes."""
    answers = answers or {}
    return {key: bool(answers.get(key, False)) for key in EVENT_QUESTIONS}


def yes_answers(answers: dict[str, bool] | None) -> list[str]:
    """25Live's wording of every question answered Yes, in form order."""
    answers = answers or {}
    return [text for key, text in EVENT_QUESTIONS.items() if answers.get(key)]


def description_html(text: str | None) -> str | None:
    """Plain text -> the HTML 25Live's description editor holds: one <p> per line."""
    text = clean_text(text)
    if text is None:
        return None
    paragraphs = [p.strip() for p in text.splitlines() if p.strip()]
    return "".join(f"<p>{html.escape(p)}</p>" for p in paragraphs)


def resolve_co_hosts(db: Session, ids: list[str] | None, primary_org_id) -> list[Organization]:
    """The co-hosting organizations for these ids (de-duplicated, in the order given).

    422 if one doesn't exist. The primary organization is quietly dropped, since
    it can't co-host with itself."""
    primary = as_uuid(primary_org_id, "organization")
    seen, wanted = set(), []
    for raw in ids or []:
        org_id = as_uuid(raw, "co-hosting organization")
        if org_id != primary and org_id not in seen:
            seen.add(org_id)
            wanted.append(org_id)
    if len(wanted) > MAX_CO_HOSTS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"You can add at most {MAX_CO_HOSTS} co-hosting organizations.")
    if not wanted:
        return []
    found = {o.id: o for o in db.query(Organization).filter(Organization.id.in_(wanted)).all()}
    missing = [i for i in wanted if i not in found]
    if missing:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="One of the co-hosting organizations doesn't exist.")
    return [found[i] for i in wanted]
