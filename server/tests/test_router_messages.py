"""Tests for routers/messages.py: finding people, starting chats, sending messages.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import uuid

import pytest

from models.communication import Conversation, ConversationParticipant, Message, Notification, NotificationType
from models.user import UserRole

ENDPOINTS = [("get", "/users/search?q=a"), ("get", "/conversations"),
             ("post", "/conversations"), ("post", f"/conversations/{uuid.uuid4()}/messages")]


@pytest.fixture()
def chat(db):
    """A conversation between the given users, with optional (sender, body) messages."""
    def _make(*users, messages=(), title=None):
        conv = Conversation(title=title)
        db.add(conv)
        db.flush()
        for u in users:
            db.add(ConversationParticipant(conversation_id=conv.id, user_id=u.id))
        for sender, text in messages:
            db.add(Message(conversation_id=conv.id, sender_id=sender.id, body=text))
            db.flush()
        db.flush()
        db.refresh(conv)
        return conv
    return _make


# =============================================================================
# Login required
# =============================================================================

@pytest.mark.parametrize("method,path", ENDPOINTS)
def test_message_endpoints_need_a_token(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# =============================================================================
# GET /users/search
# =============================================================================

def test_search_finds_by_name_and_email_without_you(client, auth, leader, make_user):
    bob = make_user(name="Bob Marley", email="bob.marley@stonybrook.edu")
    make_user(name="Alice Zed")

    by_name = client.get("/users/search", params={"q": "marl"}, headers=auth(leader))
    by_email = client.get("/users/search", params={"q": "bob.marley@"}, headers=auth(leader))
    me = client.get("/users/search", params={"q": "lee leader"}, headers=auth(leader))

    assert [p["id"] for p in by_name.json()] == [str(bob.id)]
    assert by_email.json()[0]["email"] == "bob.marley@stonybrook.edu"
    assert me.json() == []


def test_search_skips_inactive_users_and_treats_wildcards_literally(client, auth, leader, make_user):
    make_user(name="Gone Gary", is_active=False)
    make_user(name="Percent Pat")

    assert client.get("/users/search", params={"q": "gary"}, headers=auth(leader)).json() == []
    assert client.get("/users/search", params={"q": "%"}, headers=auth(leader)).json() == []


def test_search_needs_a_term_and_respects_limit(client, auth, leader, make_user):
    for i in range(4):
        make_user(name=f"Sam {i}")

    assert client.get("/users/search", headers=auth(leader)).status_code == 422
    assert client.get("/users/search", params={"q": "  "}, headers=auth(leader)).json() == []
    assert len(client.get("/users/search", params={"q": "sam", "limit": 2}, headers=auth(leader)).json()) == 2


# =============================================================================
# POST /conversations
# =============================================================================

def test_start_a_chat(client, auth, leader, host):
    r = client.post("/conversations", json={"participant_ids": [str(host.id)]}, headers=auth(leader))

    assert r.status_code == 201
    body = r.json()
    assert sorted(p["name"] for p in body["participants"]) == ["Hal Host", "Lee Leader"]
    assert body["messages"] == [] and body["title"] is None


def test_starting_the_same_one_to_one_chat_returns_the_existing_thread(client, auth, leader, host):
    first = client.post("/conversations", json={"participant_ids": [str(host.id)]}, headers=auth(leader)).json()
    again = client.post("/conversations", json={"participant_ids": [str(host.id)]}, headers=auth(leader))
    from_other_side = client.post("/conversations", json={"participant_ids": [str(leader.id)]}, headers=auth(host))

    assert again.status_code == 200 and again.json()["id"] == first["id"]
    assert from_other_side.json()["id"] == first["id"]


def test_a_group_chat_is_always_new(client, auth, leader, host, admin):
    ids = [str(host.id), str(admin.id)]
    one = client.post("/conversations", json={"participant_ids": ids, "title": "Setup"}, headers=auth(leader))
    two = client.post("/conversations", json={"participant_ids": ids}, headers=auth(leader))

    assert one.status_code == two.status_code == 201
    assert one.json()["id"] != two.json()["id"]
    assert one.json()["title"] == "Setup" and len(one.json()["participants"]) == 3


def test_a_group_with_both_people_is_not_reused_for_a_one_to_one(client, auth, leader, host, admin, chat):
    chat(leader, host, admin)

    r = client.post("/conversations", json={"participant_ids": [str(host.id)]}, headers=auth(leader))

    assert r.status_code == 201 and len(r.json()["participants"]) == 2


def test_cannot_start_a_chat_with_only_yourself(client, auth, leader):
    r = client.post("/conversations", json={"participant_ids": [str(leader.id)]}, headers=auth(leader))
    assert r.status_code == 400


def test_unknown_or_inactive_people_are_rejected(client, auth, leader, make_user):
    gone = make_user(is_active=False)
    for pid in (str(uuid.uuid4()), str(gone.id)):
        r = client.post("/conversations", json={"participant_ids": [pid]}, headers=auth(leader))
        assert r.status_code == 404


def test_start_chat_validation(client, auth, leader):
    assert client.post("/conversations", json={"participant_ids": []}, headers=auth(leader)).status_code == 422
    assert client.post("/conversations", json={"participant_ids": ["not-a-uuid"]}, headers=auth(leader)).status_code == 404


# =============================================================================
# GET /conversations
# =============================================================================

def test_list_shows_only_my_conversations_with_messages_in_order(client, auth, leader, host, admin, chat):
    mine = chat(leader, host, messages=[(host, "first"), (leader, "second")])
    chat(host, admin, messages=[(admin, "not for the leader")])

    r = client.get("/conversations", headers=auth(leader))

    assert [c["id"] for c in r.json()] == [str(mine.id)]
    msgs = r.json()[0]["messages"]
    assert [(m["sender_name"], m["body"]) for m in msgs] == [("Hal Host", "first"), ("Lee Leader", "second")]
    assert msgs[0]["sender_id"] == str(host.id)


def test_list_puts_the_most_recently_active_first(client, auth, leader, host, admin, chat):
    older = chat(leader, host, messages=[(host, "hi")])
    newer = chat(leader, admin, messages=[(admin, "hello")])

    ids = [c["id"] for c in client.get("/conversations", headers=auth(leader)).json()]

    assert ids == [str(newer.id), str(older.id)]


def test_admins_cannot_read_other_peoples_conversations(client, auth, leader, host, admin, chat):
    chat(leader, host, messages=[(leader, "private")])

    assert client.get("/conversations", headers=auth(admin)).json() == []


# =============================================================================
# POST /conversations/{id}/messages
# =============================================================================

def test_send_a_message_and_notify_the_other_person(client, auth, db, leader, host, chat):
    conv = chat(leader, host)

    r = client.post(f"/conversations/{conv.id}/messages", json={"body": "  Is the room free?  "}, headers=auth(leader))

    assert r.status_code == 201
    assert r.json()["body"] == "Is the room free?" and r.json()["sender_name"] == "Lee Leader"
    note = db.query(Notification).filter(Notification.user_id == host.id).one()
    assert note.type == NotificationType.NEW_MESSAGE and "Lee Leader: Is the room free?" in note.message
    assert db.query(Notification).filter(Notification.user_id == leader.id).count() == 0
    # and the other person sees it
    theirs = client.get("/conversations", headers=auth(host)).json()[0]["messages"]
    assert [m["body"] for m in theirs] == ["Is the room free?"]


def test_long_messages_are_trimmed_in_the_notification_only(client, auth, db, leader, host, chat):
    conv = chat(leader, host)
    text = "x" * 300

    r = client.post(f"/conversations/{conv.id}/messages", json={"body": text}, headers=auth(leader))

    assert r.json()["body"] == text
    assert len(db.query(Notification).filter(Notification.user_id == host.id).one().message) <= 512


def test_cannot_post_in_someone_elses_conversation(client, auth, leader, host, admin, chat):
    conv = chat(leader, host)

    r = client.post(f"/conversations/{conv.id}/messages", json={"body": "hi"}, headers=auth(admin))

    assert r.status_code == 404


def test_unknown_conversation_is_404(client, auth, leader):
    for cid in (str(uuid.uuid4()), "nope"):
        r = client.post(f"/conversations/{cid}/messages", json={"body": "hi"}, headers=auth(leader))
        assert r.status_code == 404


@pytest.mark.parametrize("text", ["", "   ", "x" * 5001], ids=["empty", "blank", "too-long"])
def test_bad_message_bodies_are_rejected(client, auth, leader, host, chat, text):
    conv = chat(leader, host)
    r = client.post(f"/conversations/{conv.id}/messages", json={"body": text}, headers=auth(leader))
    assert r.status_code == 422


@pytest.mark.parametrize("role", [UserRole.CLUB_LEADER, UserRole.ADMIN, UserRole.VENUE_HOST])
def test_every_role_can_message(client, auth, make_user, role, leader):
    sender = make_user(role)
    r = client.post("/conversations", json={"participant_ids": [str(make_user().id)]}, headers=auth(sender))
    assert r.status_code == 201
