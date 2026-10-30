"""Tests for services/notification_email.py: every new notification is emailed to its
user (if they have an email address), only after the database commit.

Nothing is really sent: send_email_later is replaced with a list that records calls.
"""

from __future__ import annotations

import pytest

import services.notification_email as notification_email
from models.communication import Notification, NotificationType


@pytest.fixture()
def sent(monkeypatch):
    """Turns email on (with fake settings) and records what would be sent."""
    monkeypatch.setenv("BREVO_API_KEY", "test-key")
    monkeypatch.setenv("EMAIL_FROM", "campusreserve@example.com")
    monkeypatch.setenv("FRONTEND_URL", "https://example.test")
    calls = []
    monkeypatch.setattr(notification_email, "send_email_later",
                        lambda to, name, subject, html, text: calls.append(
                            {"to": to, "name": name, "subject": subject, "html": html, "text": text}))
    return calls


def add_notification(db, user, message="Your booking was approved.", type_=NotificationType.MEMBERSHIP_VERIFIED):
    n = Notification(user_id=user.id, type=type_, message=message, is_read=False)
    db.add(n)
    return n


def test_emailed_after_commit_not_before(db, leader, sent):
    add_notification(db, leader)
    db.flush()
    assert sent == []          # nothing goes out until the transaction commits
    db.commit()
    assert [c["to"] for c in sent] == [leader.email]


def test_email_content(db, make_user, sent):
    user = make_user(name="Jane Doe", email="jane.doe@example.com")
    add_notification(db, user, "You're verified as President of Robotics Club.")
    db.commit()
    (mail,) = sent
    assert mail["name"] == "Jane Doe"
    assert mail["subject"].startswith("CampusReserve: ")
    assert "You're verified as President of Robotics Club." in mail["text"]
    assert "Hi Jane," in mail["text"]
    assert "https://example.test/" in mail["text"]


def test_message_is_html_escaped(db, leader, sent):
    add_notification(db, leader, "<b>bold</b> & more")
    db.commit()
    assert "<b>bold</b>" not in sent[0]["html"]
    assert "&lt;b&gt;bold&lt;/b&gt; &amp; more" in sent[0]["html"]


def test_rolled_back_notification_is_not_emailed(db, leader, sent):
    add_notification(db, leader)
    db.flush()
    db.rollback()
    db.commit()
    assert sent == []


def test_inactive_user_is_not_emailed(db, make_user, sent):
    add_notification(db, make_user(is_active=False))
    db.commit()
    assert sent == []


def test_one_email_per_notification(db, leader, admin, sent):
    add_notification(db, leader, "one")
    add_notification(db, admin, "two")
    db.commit()
    assert sorted(c["to"] for c in sent) == sorted([leader.email, admin.email])


def test_nothing_sent_when_email_is_not_configured(db, leader, sent, monkeypatch):
    monkeypatch.delenv("BREVO_API_KEY")
    add_notification(db, leader)
    db.commit()
    assert sent == []


def test_endpoint_notifications_are_emailed(client, auth, admin, leader, org, sent):
    """End to end: joining a club notifies the admins in the app AND by email."""
    client.post(f"/organizations/{org.id}/join", headers=auth(leader))
    assert admin.email in [c["to"] for c in sent]
    assert leader.email not in [c["to"] for c in sent]   # the person who joined isn't notified
