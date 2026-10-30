"""Sending email through Brevo's HTTP API.

Render's free plan blocks outgoing SMTP (ports 25/465/587), so email goes out over
HTTPS instead. Brevo's free plan allows 300 emails a day.

Environment variables (set them on the API service in Render):
    BREVO_API_KEY      API key from Brevo (SMTP & API > API keys). No key = email is off.
    EMAIL_FROM         The sender address you verified in Brevo (Senders, domains & IPs).
    EMAIL_FROM_NAME    Optional, defaults to "CampusReserve".
    EMAIL_REDIRECT_TO  Optional, for testing: every email goes to this address instead
                       of the real recipient, so demo accounts never email real people.

Uses only the standard library, so nothing new goes in requirements.txt.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

log = logging.getLogger("campusreserve.email")

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT_SECONDS = 10

# A couple of background threads, so a slow email never slows down an API response.
_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="email")


def email_enabled() -> bool:
    return bool(os.environ.get("BREVO_API_KEY") and os.environ.get("EMAIL_FROM"))


def send_email(to_email: str, to_name: str | None, subject: str, html: str, text: str) -> bool:
    """Sends one email right away. Returns True if Brevo accepted it. Never raises."""
    if not email_enabled():
        return False
    redirect = os.environ.get("EMAIL_REDIRECT_TO", "").strip()
    if redirect:
        subject = f"[to {to_email}] {subject}"
        to_email, to_name = redirect, None
    recipient = {"email": to_email}
    if to_name:
        recipient["name"] = to_name
    body = {
        "sender": {"email": os.environ["EMAIL_FROM"], "name": os.environ.get("EMAIL_FROM_NAME", "CampusReserve")},
        "to": [recipient],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    req = urllib.request.Request(
        os.environ.get("BREVO_API_URL", BREVO_URL),
        data=json.dumps(body).encode(),
        method="POST",
        headers={"api-key": os.environ["BREVO_API_KEY"], "content-type": "application/json", "accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            ok = 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        log.warning("Email to %s failed: HTTP %s %s", to_email, e.code, e.read()[:300])
        return False
    except Exception as e:  # network problems, timeouts
        log.warning("Email to %s failed: %s", to_email, e)
        return False
    if ok:
        log.info("Email sent to %s: %s", to_email, subject)
    return ok


def send_email_later(*args, **kwargs) -> None:
    """Queues send_email on a background thread and returns immediately."""
    if email_enabled():
        _pool.submit(send_email, *args, **kwargs)
