"""Sending email. In development it just logs messages.

Settings (environment variables):
    EMAIL_MODE      "log" (default) prints emails to the server log;
                    "smtp" sends them for real over SMTP;
                    "brevo" sends them for real through Brevo's HTTPS API
                    (use this on Render's free plan, which blocks SMTP ports)
    SMTP_HOST       e.g. smtp.gmail.com
    SMTP_PORT       default 587
    SMTP_USERNAME / SMTP_PASSWORD
    SMTP_STARTTLS   "1" (default) or "0"
    BREVO_API_KEY   API key from Brevo (SMTP & API > API keys), for EMAIL_MODE=brevo
    EMAIL_FROM      e.g. "CampusReserve <noreply@example.edu>"
                    (for brevo, the address must be a verified sender in Brevo)
    EMAIL_REDIRECT_TO  optional, for testing: send every email to this address
                    instead of the real recipient (real recipient goes in the subject)
    APP_URL         link included in emails, default http://localhost:5173

Sending happens on a background thread so a slow mail server never delays
an API response.
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
import threading
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import parseaddr

logger = logging.getLogger(__name__)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def app_url() -> str:
    return os.getenv("APP_URL", "http://localhost:5173").rstrip("/")


def _from_header() -> str:
    return os.getenv("EMAIL_FROM", "CampusReserve <noreply@localhost>")


def _send_smtp(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = _from_header()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=20) as smtp:
        if os.getenv("SMTP_STARTTLS", "1") == "1":
            smtp.starttls()
        user = os.getenv("SMTP_USERNAME")
        if user:
            smtp.login(user, os.getenv("SMTP_PASSWORD", ""))
        smtp.send_message(msg)


def _send_brevo(to: str, subject: str, body: str) -> None:
    """Sends through Brevo's HTTP API (port 443), which Render's free plan allows."""
    name, address = parseaddr(_from_header())
    payload = {
        "sender": {"email": address, "name": name or "CampusReserve"},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": body,
    }
    req = urllib.request.Request(
        os.getenv("BREVO_API_URL", BREVO_URL),
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"api-key": os.environ["BREVO_API_KEY"], "content-type": "application/json",
                 "accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20):
            pass
    except urllib.error.HTTPError as e:  # include Brevo's reason in the log
        raise RuntimeError(f"Brevo returned HTTP {e.code}: {e.read()[:300]!r}") from None


def _deliver(to: str, subject: str, body: str) -> None:
    mode = os.getenv("EMAIL_MODE", "log").lower()
    redirect = os.getenv("EMAIL_REDIRECT_TO", "").strip()
    if redirect and mode in ("smtp", "brevo"):
        subject, to = f"[to {to}] {subject}", redirect
    try:
        if mode == "smtp":
            _send_smtp(to, subject, body)
            logger.info("Emailed %s: %s", to, subject)
        elif mode == "brevo":
            _send_brevo(to, subject, body)
            logger.info("Emailed %s: %s", to, subject)
        else:
            logger.info("EMAIL (not sent, EMAIL_MODE=%s) to %s: %s\n%s", mode, to, subject, body)
    except Exception:  # never let email problems break the app
        logger.exception("Failed to email %s: %s", to, subject)


def send_email(to: str, subject: str, body: str) -> None:
    """Send in the background. Returns immediately."""
    if not to:
        return
    threading.Thread(target=_deliver, args=(to, subject, body), daemon=True).start()
