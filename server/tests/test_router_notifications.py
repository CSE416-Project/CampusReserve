"""Tests for routers/notifications.py: list, unread count, mark one / all read.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid

import pytest

from models.communication import Notification, NotificationType

ENDPOINTS = [("get", "/notifications"), ("get", "/notifications/unread-count"),
             ("post", "/notifications/read-all"),
             ("post", f"/notifications/{uuid.uuid4()}/read")]


@pytest.fixture()
def notify_user(db):
    """Add a notification directly. `minutes_ago` controls the newest-first order."""
    def _make(user, message="Something happened", minutes_ago=0, is_read=False,
              type_=NotificationType.MEMBERSHIP_VERIFIED, request=None):
        n = Notification(user_id=user.id, type=type_, message=message, is_read=is_read,
                         request_id=request.id if request else None,
                         created_at=dt.datetime.utcnow() - dt.timedelta(minutes=minutes_ago))
        db.add(n)
        db.flush()
        return n
    return _make


def messages(resp):
    return [n["message"] for n in resp.json()]


# =============================================================================
# Login required
# =============================================================================

@pytest.mark.parametrize("method,path", ENDPOINTS)
def test_notification_endpoints_need_a_token(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# =============================================================================
# GET /notifications
# =============================================================================

def test_list_is_empty_for_a_new_user(client, auth, leader):
    r = client.get("/notifications", headers=auth(leader))
    assert r.status_code == 200 and r.json() == []


def test_list_is_newest_first(client, auth, leader, notify_user):
    notify_user(leader, "old", minutes_ago=30)
    notify_user(leader, "newest", minutes_ago=1)
    notify_user(leader, "middle", minutes_ago=10)

    r = client.get("/notifications", headers=auth(leader))

    assert messages(r) == ["newest", "middle", "old"]


def test_list_only_shows_your_own(client, auth, leader, make_user, notify_user):
    notify_user(leader, "mine")
    notify_user(make_user(), "someone else's")

    assert messages(client.get("/notifications", headers=auth(leader))) == ["mine"]


def test_list_unread_only(client, auth, leader, notify_user):
    notify_user(leader, "unread")
    notify_user(leader, "already read", is_read=True)

    everything = client.get("/notifications", headers=auth(leader))
    unread = client.get("/notifications", params={"unread_only": True}, headers=auth(leader))

    assert sorted(messages(everything)) == ["already read", "unread"]
    assert messages(unread) == ["unread"]


def test_list_respects_limit(client, auth, leader, notify_user):
    for i in range(5):
        notify_user(leader, f"n{i}", minutes_ago=i)

    r = client.get("/notifications", params={"limit": 2}, headers=auth(leader))

    assert messages(r) == ["n0", "n1"]  # the two newest


@pytest.mark.parametrize("limit", [0, 201])
def test_list_rejects_bad_limits(client, auth, leader, limit):
    r = client.get("/notifications", params={"limit": limit}, headers=auth(leader))
    assert r.status_code == 422


def test_list_item_fields(client, auth, leader, notify_user, make_request):
    req = make_request(days=5)
    n = notify_user(leader, "About your booking", request=req,
                    type_=NotificationType.MEMBERSHIP_REQUESTED)

    item = client.get("/notifications", headers=auth(leader)).json()[0]

    assert item["id"] == str(n.id)
    assert item["type"] == NotificationType.MEMBERSHIP_REQUESTED.value
    assert item["message"] == "About your booking"
    assert item["request_id"] == str(req.id)
    assert item["is_read"] is False
    assert item["created_at"]


def test_list_request_id_is_null_without_a_request(client, auth, leader, notify_user):
    notify_user(leader)
    assert client.get("/notifications", headers=auth(leader)).json()[0]["request_id"] is None


# =============================================================================
# GET /notifications/unread-count
# =============================================================================

def test_unread_count_is_zero_for_a_new_user(client, auth, leader):
    r = client.get("/notifications/unread-count", headers=auth(leader))
    assert r.status_code == 200 and r.json() == {"unread": 0}


def test_unread_count_counts_only_your_unread(client, auth, leader, make_user, notify_user):
    notify_user(leader, "a")
    notify_user(leader, "b")
    notify_user(leader, "read", is_read=True)
    notify_user(make_user(), "not mine")

    r = client.get("/notifications/unread-count", headers=auth(leader))

    assert r.json() == {"unread": 2}


# =============================================================================
# POST /notifications/read-all
# =============================================================================

def test_read_all_marks_everything_read(client, auth, leader, notify_user):
    notify_user(leader, "a")
    notify_user(leader, "b")
    notify_user(leader, "c", is_read=True)

    r = client.post("/notifications/read-all", headers=auth(leader))

    assert r.status_code == 200 and r.json() == {"marked_read": 2}
    assert client.get("/notifications/unread-count", headers=auth(leader)).json() == {"unread": 0}
    assert all(n["is_read"] for n in client.get("/notifications", headers=auth(leader)).json())


def test_read_all_again_marks_nothing(client, auth, leader, notify_user):
    notify_user(leader)
    client.post("/notifications/read-all", headers=auth(leader))
    assert client.post("/notifications/read-all", headers=auth(leader)).json() == \
        {"marked_read": 0}


def test_read_all_leaves_other_users_alone(client, auth, leader, make_user, notify_user):
    other = make_user()
    notify_user(leader)
    notify_user(other)

    client.post("/notifications/read-all", headers=auth(leader))

    assert client.get("/notifications/unread-count", headers=auth(other)).json() == {"unread": 1}


# =============================================================================
# POST /notifications/{id}/read
# =============================================================================

def test_mark_one_read(client, auth, leader, notify_user):
    target = notify_user(leader, "target")
    notify_user(leader, "other")

    r = client.post(f"/notifications/{target.id}/read", headers=auth(leader))

    assert r.status_code == 200
    assert r.json()["id"] == str(target.id) and r.json()["is_read"] is True
    assert client.get("/notifications/unread-count", headers=auth(leader)).json() == {"unread": 1}


def test_mark_read_twice_is_fine(client, auth, leader, notify_user):
    n = notify_user(leader)
    client.post(f"/notifications/{n.id}/read", headers=auth(leader))
    r = client.post(f"/notifications/{n.id}/read", headers=auth(leader))
    assert r.status_code == 200 and r.json()["is_read"] is True


def test_cannot_mark_someone_elses_notification(client, auth, leader, make_user, notify_user):
    other = make_user()
    theirs = notify_user(other)

    r = client.post(f"/notifications/{theirs.id}/read", headers=auth(leader))

    assert r.status_code == 404  # same as "doesn't exist", so ids can't be probed
    assert client.get("/notifications/unread-count", headers=auth(other)).json() == {"unread": 1}


def test_mark_unknown_notification_is_404(client, auth, leader):
    r = client.post(f"/notifications/{uuid.uuid4()}/read", headers=auth(leader))
    assert r.status_code == 404


def test_mark_with_a_malformed_id_is_rejected(client, auth, leader):
    r = client.post("/notifications/not-a-uuid/read", headers=auth(leader))
    assert r.status_code in (404, 422)


# =============================================================================
# End to end: a real event creates a notification
# =============================================================================

def test_being_verified_notifies_the_member(client, auth, admin, leader, org):
    client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify",
                headers=auth(admin))

    items = client.get("/notifications", headers=auth(leader)).json()

    assert len(items) == 1
    assert items[0]["type"] == NotificationType.MEMBERSHIP_VERIFIED.value
    assert org.name in items[0]["message"]
    assert client.get("/notifications/unread-count", headers=auth(leader)).json() == {"unread": 1}
