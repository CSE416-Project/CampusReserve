"""Tests for routers/auth.py: register, login (/auth/token) and /auth/me.

Uses the fixtures in conftest.py (a rolled-back test database, users, tokens).
"""

from __future__ import annotations

import pytest

from models.user import User, UserRole

PASSWORD = "testpass123"  # the password conftest's make_user gives every user


def register(client, email="new@example.com", name="New Person", password="s3cret-pass"):
    return client.post("/auth/register",
                       json={"email": email, "name": name, "password": password})


def login(client, username, password=PASSWORD):
    # OAuth2 password flow: form fields, not JSON, and the email goes in "username".
    return client.post("/auth/token", data={"username": username, "password": password})


# =============================================================================
# POST /auth/register
# =============================================================================

def test_register_creates_a_club_leader(client):
    r = register(client)

    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "new@example.com"
    assert body["name"] == "New Person"
    assert body["role"] == UserRole.CLUB_LEADER.value
    assert body["id"]


def test_register_never_returns_the_password(client):
    body = register(client).json()
    assert "password" not in body and "password_hash" not in body


def test_register_stores_a_hash_not_the_password(client, db):
    register(client, password="plain-text-pw")
    user = db.query(User).filter(User.email == "new@example.com").one()
    assert user.password_hash and user.password_hash != "plain-text-pw"


def test_register_duplicate_email_is_409(client):
    register(client)
    r = register(client, name="Someone Else")
    assert r.status_code == 409


@pytest.mark.xfail(reason="Emails are compared case-sensitively, so the same address with "
                          "different capitals creates a second account.", strict=False)
def test_register_duplicate_email_ignores_case(client):
    register(client, email="casey@example.com")
    assert register(client, email="Casey@example.com").status_code == 409


@pytest.mark.parametrize("email", ["not-an-email", "missing-at.test.local", "a@", ""])
def test_register_rejects_invalid_emails(client, email):
    assert register(client, email=email).status_code == 422


@pytest.mark.parametrize("missing", ["email", "name", "password"])
def test_register_requires_every_field(client, missing):
    body = {"email": "new@example.com", "name": "New Person", "password": "s3cret-pass"}
    body.pop(missing)
    assert client.post("/auth/register", json=body).status_code == 422


def test_registered_user_can_log_in(client):
    register(client, email="fresh@example.com", password="fresh-pass-1")
    r = login(client, "fresh@example.com", "fresh-pass-1")
    assert r.status_code == 200


# =============================================================================
# POST /auth/token
# =============================================================================

def test_login_returns_a_bearer_token(client, leader):
    r = login(client, leader.email)

    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_token_works_on_me(client, leader):
    token = login(client, leader.email).json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["email"] == leader.email


def test_login_wrong_password_is_401(client, leader):
    r = login(client, leader.email, "wrong-password")

    assert r.status_code == 401
    assert r.headers.get("www-authenticate") == "Bearer"


def test_login_unknown_email_is_401(client):
    r = login(client, "nobody@example.com")
    assert r.status_code == 401


def test_login_errors_dont_reveal_which_part_was_wrong(client, leader):
    wrong_pw = login(client, leader.email, "wrong-password").json()
    no_user = login(client, "nobody@example.com").json()
    assert wrong_pw == no_user


@pytest.mark.parametrize("missing", ["username", "password"])
def test_login_requires_both_fields(client, leader, missing):
    data = {"username": leader.email, "password": PASSWORD}
    data.pop(missing)
    assert client.post("/auth/token", data=data).status_code == 422


def test_login_rejects_json_bodies(client, leader):
    # The token endpoint takes form data; JSON is a common frontend mistake.
    r = client.post("/auth/token", json={"username": leader.email, "password": PASSWORD})
    assert r.status_code == 422


def test_deactivated_user_is_locked_out(client, make_user):
    """Admins deactivate users with PATCH /admin/users. Either login is refused,
    or the token it gives can't be used."""
    user = make_user(is_active=False)
    r = login(client, user.email)
    if r.status_code == 200:
        token = r.json()["access_token"]
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code in (401, 403)
    else:
        assert r.status_code in (400, 401, 403)


# =============================================================================
# GET /auth/me
# =============================================================================

def test_me_returns_the_logged_in_user(client, auth, admin):
    r = client.get("/auth/me", headers=auth(admin))

    assert r.status_code == 200
    body = r.json()
    assert body == {"id": str(admin.id), "email": admin.email, "name": admin.name,
                    "role": UserRole.ADMIN.value}


def test_me_without_a_token_is_401(client):
    assert client.get("/auth/me").status_code == 401


@pytest.mark.parametrize("header", ["Bearer not-a-real-token", "Bearer ", "Basic abc123"])
def test_me_with_a_bad_token_is_401(client, header):
    assert client.get("/auth/me", headers={"Authorization": header}).status_code == 401


def test_me_with_a_tampered_token_is_401(client, auth, leader):
    token = auth(leader)["Authorization"].removeprefix("Bearer ")
    head, payload, sig = token.split(".")
    tampered = f"{head}.{payload}.{sig[:-2]}{'AA' if sig[-2:] != 'AA' else 'BB'}"
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {tampered}"})
    assert r.status_code == 401


# =============================================================================
# POST /auth/change-password
# =============================================================================

def change(client, auth, user, current=PASSWORD, new="brand-new-pass"):
    return client.post("/auth/change-password", headers=auth(user),
                       json={"current_password": current, "new_password": new})


def test_change_password_needs_a_token(client):
    r = client.post("/auth/change-password", json={"current_password": "x", "new_password": "longenough1"})
    assert r.status_code == 401


def test_change_password_then_log_in_with_the_new_one(client, auth, leader):
    assert change(client, auth, leader).status_code == 204

    assert login(client, leader.email, "brand-new-pass").status_code == 200
    assert login(client, leader.email, PASSWORD).status_code == 401


def test_change_password_stores_a_hash(client, auth, db, leader):
    change(client, auth, leader)
    db.refresh(leader)
    assert leader.password_hash != "brand-new-pass" and leader.password_hash.startswith("$2")


def test_wrong_current_password_is_400_and_changes_nothing(client, auth, leader):
    r = change(client, auth, leader, current="not-my-password")

    assert r.status_code == 400 and "current password" in r.json()["detail"]
    assert login(client, leader.email, PASSWORD).status_code == 200


def test_new_password_must_differ_from_the_current_one(client, auth, leader):
    assert change(client, auth, leader, new=PASSWORD).status_code == 400


@pytest.mark.parametrize("new", ["short", "", "1234567"])
def test_new_password_must_be_at_least_8_characters(client, auth, leader, new):
    assert change(client, auth, leader, new=new).status_code == 422


def test_change_password_needs_both_fields(client, auth, leader):
    r = client.post("/auth/change-password", headers=auth(leader), json={"new_password": "brand-new-pass"})
    assert r.status_code == 422


def test_your_login_still_works_after_changing_the_password(client, auth, leader):
    headers = auth(leader)
    client.post("/auth/change-password", headers=headers,
                json={"current_password": PASSWORD, "new_password": "brand-new-pass"})
    assert client.get("/auth/me", headers=headers).status_code == 200


def test_change_password_only_changes_your_own(client, auth, leader, host):
    change(client, auth, leader)
    assert login(client, host.email, PASSWORD).status_code == 200
