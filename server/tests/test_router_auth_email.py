"""Forgot-password and email-verification (routers/auth.py + services/auth_tokens.py).

No email is really sent: services.mailer.send_email is replaced with a list, and the
link in the email is read back out of it, just like a person clicking it would.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta

import pytest

from models.auth_token import AuthToken
from models.user import User

PASSWORD = "testpass123"


@pytest.fixture()
def sent(monkeypatch):
    out = []
    monkeypatch.setattr("services.mailer.send_email", lambda to, subject, body: out.append((to, subject, body)))
    return out


def token_in(email_tuple):
    m = re.search(r"token=([\w-]+)", email_tuple[2])
    assert m, "the email has no link"
    return m.group(1)


def register(client, email="new@example.com", password="s3cret-pass"):
    return client.post("/auth/register", json={"email": email, "name": "New Person", "password": password})


def login(client, email, password):
    return client.post("/auth/token", data={"username": email, "password": password})


def age_tokens(db, minutes):
    """Pretend the emails went out `minutes` ago (to get past the one-per-minute limit)."""
    for t in db.query(AuthToken).all():
        t.created_at = datetime.utcnow() - timedelta(minutes=minutes)
    db.flush()


# =============================================================================
# Email verification
# =============================================================================

def test_register_emails_a_confirmation_link(client, sent):
    assert register(client).status_code == 201
    assert len(sent) == 1
    to, subject, body = sent[0]
    assert to == "new@example.com" and "Confirm" in subject
    assert "/verify-email?token=" in body


def test_cannot_log_in_until_email_is_confirmed(client, sent):
    register(client, password="fresh-pass-1")
    r = login(client, "new@example.com", "fresh-pass-1")
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "email_not_verified"


def test_wrong_password_is_still_401_even_when_unconfirmed(client, sent):
    register(client)
    assert login(client, "new@example.com", "nope-nope-1").status_code == 401


def test_confirming_the_link_allows_login(client, sent):
    register(client, password="fresh-pass-1")
    r = client.post("/auth/verify-email", json={"token": token_in(sent[0])})
    assert r.status_code == 204
    assert login(client, "new@example.com", "fresh-pass-1").status_code == 200


def test_confirmation_link_works_only_once(client, sent):
    register(client)
    tok = token_in(sent[0])
    assert client.post("/auth/verify-email", json={"token": tok}).status_code == 204
    assert client.post("/auth/verify-email", json={"token": tok}).status_code == 400


def test_bad_confirmation_link_is_400(client):
    assert client.post("/auth/verify-email", json={"token": "not-a-real-token"}).status_code == 400


def test_expired_confirmation_link_is_400_and_login_stays_blocked(client, sent, db):
    register(client, password="fresh-pass-1")
    for t in db.query(AuthToken).all():
        t.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.flush()
    assert client.post("/auth/verify-email", json={"token": token_in(sent[0])}).status_code == 400
    assert login(client, "new@example.com", "fresh-pass-1").status_code == 403


def test_resend_sends_a_new_working_link(client, sent, db):
    register(client, password="fresh-pass-1")
    age_tokens(db, 5)
    assert client.post("/auth/resend-verification", json={"email": "new@example.com"}).status_code == 204
    assert len(sent) == 2
    first, second = token_in(sent[0]), token_in(sent[1])
    assert first != second
    assert client.post("/auth/verify-email", json={"token": first}).status_code == 400   # replaced
    assert client.post("/auth/verify-email", json={"token": second}).status_code == 204


def test_resend_is_limited_to_one_a_minute(client, sent):
    register(client)
    client.post("/auth/resend-verification", json={"email": "new@example.com"})
    assert len(sent) == 1


def test_resend_for_unknown_or_confirmed_email_sends_nothing_and_looks_the_same(client, sent, leader):
    assert client.post("/auth/resend-verification", json={"email": "ghost@example.com"}).status_code == 204
    assert client.post("/auth/resend-verification", json={"email": leader.email}).status_code == 204
    assert sent == []


def test_existing_accounts_without_a_link_can_still_log_in(client, leader):
    assert login(client, leader.email, PASSWORD).status_code == 200


# =============================================================================
# Forgot / reset password
# =============================================================================

def test_forgot_password_emails_a_reset_link(client, sent, leader):
    assert client.post("/auth/forgot-password", json={"email": leader.email}).status_code == 204
    assert len(sent) == 1
    to, subject, body = sent[0]
    assert to == leader.email and "Reset" in subject and "/reset-password?token=" in body


def test_forgot_password_looks_the_same_for_unknown_email(client, sent):
    assert client.post("/auth/forgot-password", json={"email": "ghost@example.com"}).status_code == 204
    assert sent == []


def test_forgot_password_ignores_email_case(client, sent, leader):
    client.post("/auth/forgot-password", json={"email": leader.email.upper()})
    assert len(sent) == 1


def test_forgot_password_does_not_email_inactive_accounts(client, sent, make_user):
    u = make_user(is_active=False)
    client.post("/auth/forgot-password", json={"email": u.email})
    assert sent == []


def test_forgot_password_is_limited_to_one_a_minute(client, sent, leader):
    client.post("/auth/forgot-password", json={"email": leader.email})
    client.post("/auth/forgot-password", json={"email": leader.email})
    assert len(sent) == 1


def test_reset_changes_the_password(client, sent, leader, db):
    client.post("/auth/forgot-password", json={"email": leader.email})
    r = client.post("/auth/reset-password", json={"token": token_in(sent[0]), "new_password": "brand-new-pass"})
    assert r.status_code == 204
    assert login(client, leader.email, "brand-new-pass").status_code == 200
    assert login(client, leader.email, PASSWORD).status_code == 401


def test_reset_link_works_only_once(client, sent, leader):
    client.post("/auth/forgot-password", json={"email": leader.email})
    tok = token_in(sent[0])
    assert client.post("/auth/reset-password", json={"token": tok, "new_password": "brand-new-pass"}).status_code == 204
    assert client.post("/auth/reset-password", json={"token": tok, "new_password": "another-pass-1"}).status_code == 400


def test_reset_rejects_bad_expired_and_short(client, sent, leader, db):
    assert client.post("/auth/reset-password", json={"token": "nope", "new_password": "brand-new-pass"}).status_code == 400
    client.post("/auth/forgot-password", json={"email": leader.email})
    tok = token_in(sent[0])
    assert client.post("/auth/reset-password", json={"token": tok, "new_password": "short"}).status_code == 422
    for t in db.query(AuthToken).all():
        t.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.flush()
    assert client.post("/auth/reset-password", json={"token": tok, "new_password": "brand-new-pass"}).status_code == 400


def test_a_verify_link_cannot_be_used_to_reset_a_password(client, sent):
    register(client)
    r = client.post("/auth/reset-password", json={"token": token_in(sent[0]), "new_password": "brand-new-pass"})
    assert r.status_code == 400


def test_resetting_also_confirms_the_email(client, sent):
    register(client)
    client.post("/auth/forgot-password", json={"email": "new@example.com"})
    # the verify email came first; the reset email is the second one (one-a-minute limit is per kind)
    reset_tok = token_in(sent[1])
    assert client.post("/auth/reset-password", json={"token": reset_tok, "new_password": "brand-new-pass"}).status_code == 204
    assert login(client, "new@example.com", "brand-new-pass").status_code == 200


def test_reset_link_stored_hashed(client, sent, leader, db):
    client.post("/auth/forgot-password", json={"email": leader.email})
    tok = token_in(sent[0])
    assert all(row.token_hash != tok for row in db.query(AuthToken).all())
