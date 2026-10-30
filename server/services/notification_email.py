"""Emails a copy of every in-app notification to the user it's for.

Nothing in the routers needs to change: this listens to SQLAlchemy sessions, notices
when Notification rows are saved, and after the transaction COMMITS emails each user
who has an email address on their account. If the transaction is rolled back (for
example a request that failed halfway), no email goes out.

Turn it on by importing this module once at startup (main.py):
    import services.notification_email  # noqa: F401
and setting BREVO_API_KEY and EMAIL_FROM (see services/mailer.py). Without those
variables it does nothing, so local runs and tests never send email.
"""

from __future__ import annotations

import html
import logging
import os

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from models.communication import Notification
from models.user import User
from services.mailer import email_enabled, send_email_later

log = logging.getLogger("campusreserve.email")
_PENDING = "pending_notification_emails"

# Where the "Open CampusReserve" button points. Set FRONTEND_URL on the API service.
def _site() -> str:
    return os.environ.get("FRONTEND_URL", "https://campusreserve-1.onrender.com").rstrip("/")


def _type_name(t) -> str:
    return str(getattr(t, "value", t) or "")


def _subject(type_name: str, message: str) -> str:
    """'BOOKING_APPROVED' / 'booking_approved' -> 'Booking approved'."""
    words = type_name.replace("_", " ").strip().lower()
    if words:
        return f"CampusReserve: {words[0].upper()}{words[1:]}"
    first = message.strip().split(". ")[0]
    return f"CampusReserve: {first[:70]}"


def _link(type_name: str, request_id) -> str:
    t = type_name.lower()
    if request_id or any(w in t for w in ("request", "booking", "waitlist")):
        return f"{_site()}/requests"
    if "membership" in t or "verif" in t:
        return f"{_site()}/profile"
    if "message" in t:
        return f"{_site()}/messages"
    return _site()


def _bodies(name: str | None, message: str, link: str) -> tuple[str, str]:
    hello = f"Hi {name.split()[0]}," if name and name.strip() else "Hi,"
    text = f"{hello}\n\n{message}\n\nOpen CampusReserve: {link}\n\n" \
           "You're getting this because you have a CampusReserve account."
    h = html.escape
    page = f"""<!doctype html><html><body style="margin:0;background:#F4F6FA;font-family:Arial,Helvetica,sans-serif;color:#1B2A4A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:2px solid #1B2A4A;border-radius:14px">
<tr><td style="padding:18px 22px;border-bottom:2px solid #1B2A4A;font-size:20px;font-weight:bold">CampusReserve</td></tr>
<tr><td style="padding:22px;font-size:16px;line-height:1.55">
<p style="margin:0 0 12px">{h(hello)}</p>
<p style="margin:0 0 20px">{h(message)}</p>
<a href="{h(link)}" style="display:inline-block;background:#FFC93C;color:#1B2A4A;font-weight:bold;text-decoration:none;padding:12px 20px;border:2px solid #1B2A4A;border-radius:10px">Open CampusReserve</a>
</td></tr>
<tr><td style="padding:14px 22px;font-size:12.5px;color:#5E6A82;border-top:1px solid #EDF1F7">You're getting this because you have a CampusReserve account.</td></tr>
</table></td></tr></table></body></html>"""
    return page, text


@event.listens_for(Session, "after_flush")
def _collect(session, flush_context):
    """Remember new notifications (and their user's email) until the commit."""
    if not email_enabled():
        return
    new = [o for o in session.new if isinstance(o, Notification)]
    if not new:
        return
    user_ids = {n.user_id for n in new if n.user_id is not None}
    if not user_ids:
        return
    try:
        rows = session.connection().execute(
            select(User.id, User.email, User.name, User.is_active).where(User.id.in_(user_ids))
        ).all()
    except Exception as e:  # never break the request that created the notification
        log.warning("Couldn't look up notification recipients: %s", e)
        return
    users = {r.id: r for r in rows}
    pending = session.info.setdefault(_PENDING, [])
    for n in new:
        u = users.get(n.user_id)
        if not u or not u.email or not u.email.strip() or u.is_active is False:
            continue  # no address on the account (or a deactivated account): in-app only
        type_name = _type_name(n.type)
        pending.append((u.email.strip(), u.name, type_name, n.message or "", n.request_id))


@event.listens_for(Session, "after_commit")
def _send(session):
    pending = session.info.pop(_PENDING, None)
    for email, name, type_name, message, request_id in pending or []:
        page, text = _bodies(name, message, _link(type_name, request_id))
        send_email_later(email, name, _subject(type_name, message), page, text)


@event.listens_for(Session, "after_soft_rollback")
def _discard(session, previous_transaction):
    # Fires on every Session.rollback(), including when the database transaction is a
    # savepoint. A rolled-back begin_nested() block inside a transaction that still
    # commits is left alone.
    if not previous_transaction.nested:
        session.info.pop(_PENDING, None)
