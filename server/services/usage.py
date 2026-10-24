"""Counts which features signed-in users use, for the admin analytics page.

The middleware looks at each successful API request from a logged-in user,
maps its method and path to a feature name ("room_search", "booking", ...),
and adds 1 to an in-memory counter for (user, today, feature). Every minute,
the counters are written to the usage_daily table in one short transaction,
so tracking never holds a database connection per request (Supabase's pooler
limits are tight).

Privacy: only (user id, day, feature, count) is stored -- no URLs, IP
addresses, query strings, or request bodies. Counts not yet written are lost if
the server crashes, which is fine for analytics.

Wire it up in main.py (see the bottom of this file).
"""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import re
import threading
import uuid
from collections import Counter

from jose import JWTError, jwt
from sqlalchemy.dialects.postgresql import insert

from authentication import ALGORITHM, SECRET_KEY

logger = logging.getLogger(__name__)

FLUSH_SECONDS = 60

# (HTTP method or None for any, path pattern, feature). First match wins.
FEATURES: list[tuple[str | None, re.Pattern, str]] = [
    (None,     re.compile(r"^/admin(/|$)"), "admin"),
    ("POST",   re.compile(r"^/requests/[^/]+/(approve|deny)$"), "admin"),
    (None,     re.compile(r"^/requests/[^/]+/waitlist$"), "waitlist"),
    (None,     re.compile(r"^/waitlist(/|$)"), "waitlist"),
    ("POST",   re.compile(r"^/requests(/check)?$"), "booking"),
    ("PATCH",  re.compile(r"^/requests/[^/]+$"), "booking_changes"),
    ("POST",   re.compile(r"^/requests/[^/]+/cancel$"), "booking_changes"),
    ("GET",    re.compile(r"^/requests(/|$)"), "my_requests"),
    ("GET",    re.compile(r"^/rooms/(search|available)$"), "room_search"),
    ("GET",    re.compile(r"^/rooms/[^/]+/photo$"), None),  # images: too noisy to count
    ("GET",    re.compile(r"^/rooms(/|$)"), "room_browse"),
    (None,     re.compile(r"^/organizations(/|$)"), "clubs"),
    (None,     re.compile(r"^/notifications(/|$)"), "notifications"),
    ("GET",    re.compile(r"^/me/calendar-link$"), "calendar"),
    (None,     re.compile(r"^/me(/|$)"), "profile"),
    ("GET",    re.compile(r"^/auth/me$"), "sign_in"),  # the app calls this right after logging in
]

_counts: Counter = Counter()
_lock = threading.Lock()


def feature_for(method: str, path: str) -> str | None:
    for m, pattern, feature in FEATURES:
        if (m is None or m == method) and pattern.match(path):
            return feature
    return None


def user_id_from(authorization: str | None) -> uuid.UUID | None:
    """The user id in a login token, or None. Calendar-feed tokens (which have a
    "purpose") and anything invalid are ignored."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(authorization[7:].strip(), SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("purpose"):
        return None
    try:
        return uuid.UUID(str(payload.get("sub")))
    except (TypeError, ValueError):
        return None


def record(method: str, path: str, authorization: str | None) -> None:
    feature = feature_for(method, path)
    if feature is None:
        return
    user_id = user_id_from(authorization)
    if user_id is None:
        return
    with _lock:
        _counts[(user_id, dt.date.today(), feature)] += 1


def flush() -> int:
    """Write pending counts to the database. Returns how many rows were written."""
    from database import SessionLocal  # imported here so tests can import this module freely
    from models.usage import UsageDaily

    with _lock:
        pending = dict(_counts)
        _counts.clear()
    if not pending:
        return 0
    rows = [{"user_id": u, "day": d, "feature": f, "count": n} for (u, d, f), n in pending.items()]
    stmt = insert(UsageDaily).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id", "day", "feature"],
        set_={"count": UsageDaily.count + stmt.excluded.count},
    )
    try:
        with SessionLocal() as db:
            db.execute(stmt)
            db.commit()
    except Exception:  # noqa: BLE001 -- never let analytics break the app
        logger.exception("Couldn't save usage counts; will retry next flush")
        with _lock:
            for key, n in pending.items():
                _counts[key] += n
        return 0
    return len(rows)


async def flush_loop() -> None:
    while True:
        await asyncio.sleep(FLUSH_SECONDS)
        await asyncio.to_thread(flush)


class UsageMiddleware:
    """Pure ASGI middleware: counts the request after it succeeds (status < 400)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        status = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        await self.app(scope, receive, send_wrapper)
        if status["code"] < 400:
            try:
                headers = dict(scope.get("headers") or [])
                auth = headers.get(b"authorization", b"").decode("latin-1") or None
                record(scope["method"], scope["path"], auth)
            except Exception:  # noqa: BLE001
                logger.debug("usage tracking skipped", exc_info=True)

