"""Tests for general accounts: sign up with a username and password (no email,
no verification), log in with the username, search rooms, but nothing else.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import pytest

from authentication import scopes_for_user
from models.user import User, UserRole
from services import live25

PASSWORD = "s3cret-pass"


def register(client, username="wolfie", password=PASSWORD):
    return client.post("/auth/register-general", json={"username": username, "password": password})


def login(client, username, password=PASSWORD):
    return client.post("/auth/token", data={"username": username, "password": password})


def token_headers(client, username, password=PASSWORD):
    r = login(client, username, password)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def general(client):
    assert register(client, "seawolf_fan").status_code == 201
    return token_headers(client, "seawolf_fan")


# =============================================================================
# Signing up
# =============================================================================

def test_register_creates_a_general_account_without_an_email(client, db):
    r = register(client, "Wolfie")

    assert r.status_code == 201
    body = r.json()
    assert body["role"] == UserRole.GENERAL.value
    assert body["username"] == "Wolfie"
    assert body["email"] is None
    assert "password" not in str(body).lower()
    user = db.query(User).filter(User.username == "Wolfie").one()
    assert user.email is None and user.name == "Wolfie"


def test_username_must_be_unused_ignoring_case(client):
    assert register(client, "Wolfie").status_code == 201
    r = register(client, "wolfie")
    assert r.status_code == 409
    assert "taken" in r.json()["detail"]


@pytest.mark.parametrize("username", ["ab", "x" * 31, "has space", "me@example.com", ""])
def test_bad_usernames_are_rejected(client, username):
    assert register(client, username).status_code == 422


def test_short_password_is_rejected(client):
    assert register(client, "wolfie", password="short").status_code == 422


# =============================================================================
# Logging in
# =============================================================================

def test_can_log_in_right_away_with_the_username_any_case(client):
    register(client, "Wolfie")
    for name in ("Wolfie", "wolfie", "  WOLFIE "):
        assert login(client, name).status_code == 200


def test_wrong_password_is_rejected(client):
    register(client, "wolfie")
    r = login(client, "wolfie", "not-the-password")
    assert r.status_code == 401


def test_me_shows_the_general_role_and_username(client, general):
    r = client.get("/auth/me", headers=general)
    assert r.status_code == 200
    assert r.json()["role"] == "general" and r.json()["username"] == "seawolf_fan"
    assert r.json()["email"] is None


def test_email_login_still_works(client, leader):
    assert login(client, leader.email, "testpass123").status_code == 200


def test_a_username_does_not_log_in_as_an_email_account(client, leader):
    # Someone picking a username that matches the start of an email gets nothing.
    local_part = leader.email.split("@")[0]
    assert login(client, local_part, "testpass123").status_code == 401


def test_general_accounts_can_change_their_password(client, general):
    r = client.post("/auth/change-password", headers=general,
                    json={"current_password": PASSWORD, "new_password": "another-pass-1"})
    assert r.status_code == 204
    assert login(client, "seawolf_fan", "another-pass-1").status_code == 200


# =============================================================================
# What a general account can and can't do
# =============================================================================

def test_general_accounts_only_get_the_read_rooms_scope(db):
    user = User(username="x", role=UserRole.GENERAL, name="x", password_hash="x")
    assert scopes_for_user(user) == ["read:rooms"]


def test_general_accounts_can_use_room_search(client, general, monkeypatch):
    monkeypatch.setattr(live25, "cache_status", lambda: {"ready": True})
    assert client.get("/rooms/cache-status", headers=general).status_code == 200


@pytest.mark.parametrize("path", ["/requests/mine", "/forum", "/conversations", "/users/search?q=a"])
def test_general_accounts_cant_see_requests_messages_or_the_forum(client, general, path):
    r = client.get(path, headers=general)
    assert r.status_code == 403, (path, r.status_code, r.text)


def test_general_accounts_cant_book(client, general, org, room):
    r = client.post("/requests", headers=general, json={
        "organization_id": str(org.id), "room_id": str(room.id), "event_name": "Study group",
        "start_time": "2030-01-10T18:00", "end_time": "2030-01-10T19:00"})
    assert r.status_code == 403, r.text


def test_general_accounts_cant_join_a_club(client, general, org):
    r = client.post(f"/organizations/{org.id}/join", headers=general, json={})
    assert r.status_code == 403


def test_general_accounts_dont_show_up_when_searching_people_to_message(client, auth, leader):
    register(client, "findme_general")
    r = client.get("/users/search", params={"q": "findme"}, headers=auth(leader))
    assert r.status_code == 200
    assert r.json() == []


# =============================================================================
# Admin
# =============================================================================

def test_admin_sees_the_username(client, auth, admin):
    register(client, "listed_general")
    r = client.get("/admin/users", params={"search": "listed_general"}, headers=auth(admin))
    assert r.status_code == 200
    [u] = r.json()
    assert u["username"] == "listed_general" and u["email"] is None and u["role"] == "general"


def test_admin_cant_make_an_account_without_an_email_a_club_leader(client, auth, admin, db):
    register(client, "no_email_here")
    user = db.query(User).filter(User.username == "no_email_here").one()
    r = client.patch(f"/admin/users/{user.id}", json={"role": "club_leader"}, headers=auth(admin))
    assert r.status_code == 409
