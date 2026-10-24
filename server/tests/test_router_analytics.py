"""Tests for routers/analytics.py and the usage tracking in services/usage.py.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid

import pytest

from models.room import RequestStatus
from models.usage import UsageDaily
from services import usage

TODAY = dt.date.today()


@pytest.fixture()
def use(db):
    """Add usage rows directly: use(user, "room_search", days_ago=0, count=3)."""
    def _add(user, feature, days_ago=0, count=1):
        db.add(UsageDaily(user_id=user.id, day=TODAY - dt.timedelta(days=days_ago),
                          feature=feature, count=count))
        db.flush()
    return _add


def get(client, auth, user, **params):
    return client.get("/admin/analytics", params=params, headers=auth(user))


# =============================================================================
# Access
# =============================================================================

def test_analytics_needs_a_token(client):
    assert client.get("/admin/analytics").status_code == 401


def test_club_leaders_cannot_see_analytics(client, auth, leader):
    assert get(client, auth, leader).status_code in (401, 403)


def test_admins_can_see_analytics(client, auth, admin):
    r = get(client, auth, admin)
    assert r.status_code == 200
    body = r.json()
    assert body["days"] == 30 and len(body["users"]["daily_active"]) == 30


@pytest.mark.parametrize("days", [0, 366])
def test_days_is_limited(client, auth, admin, days):
    assert get(client, auth, admin, days=days).status_code == 422


# =============================================================================
# Users and usage
# =============================================================================

def test_counts_users_by_role(client, auth, admin, leader, host):
    users = get(client, auth, admin).json()["users"]
    assert users["total"] >= 3
    assert users["by_role"]["admin"] >= 1 and users["by_role"]["club_leader"] >= 1


def test_active_users_and_features(client, auth, admin, leader, make_user, use):
    other = make_user()
    use(leader, "room_search", count=4)
    use(leader, "booking", count=1)
    use(other, "room_search", days_ago=10, count=2)
    use(other, "clubs", days_ago=40)  # outside the 30-day window

    body = get(client, auth, admin).json()

    assert body["users"]["active_in_period"] == 2
    assert body["users"]["active_last_7_days"] == 1
    features = {f["feature"]: f for f in body["features"]}
    assert features["room_search"] == {"feature": "room_search", "uses": 6, "users": 2}
    assert "clubs" not in features
    assert body["features"][0]["feature"] == "room_search"  # most used first
    assert body["tracking_since"] == (TODAY - dt.timedelta(days=40)).isoformat()


def test_daily_active_series(client, auth, admin, leader, use):
    use(leader, "room_browse", days_ago=0)
    use(leader, "booking", days_ago=0)  # same person, same day: counted once
    use(leader, "room_browse", days_ago=2)

    series = {p["day"]: p["value"] for p in get(client, auth, admin, days=7).json()["users"]["daily_active"]}

    assert series[TODAY.isoformat()] == 1
    assert series[(TODAY - dt.timedelta(days=2)).isoformat()] == 1
    assert series[(TODAY - dt.timedelta(days=1)).isoformat()] == 0
    assert len(series) == 7


def test_no_usage_yet(client, auth, admin):
    body = get(client, auth, admin).json()
    assert body["features"] == [] and body["users"]["active_in_period"] == 0


# =============================================================================
# Booking requests
# =============================================================================

def test_request_stats(client, auth, admin, make_request, db):
    a = make_request(days=5, status=RequestStatus.APPROVED, start_hour=18)
    make_request(days=6, status=RequestStatus.DENIED, start_hour=18)
    make_request(days=7, start_hour=14)
    a.decided_at = a.created_at + dt.timedelta(hours=4)
    db.flush()

    req = get(client, auth, admin).json()["requests"]

    assert req["total"] == 3
    assert req["by_status"] == {"approved": 1, "denied": 1, "pending": 1}
    assert req["approval_rate"] == 0.5
    assert req["avg_attendance"] == 20
    assert req["upcoming_approved"] >= 1
    assert sum(req["by_weekday"]) == 3 and len(req["by_weekday"]) == 7
    assert req["by_hour"][18] == 2 and req["by_hour"][14] == 1
    assert req["top_rooms"][0] == {"name": "Room 101", "count": 3}
    assert req["top_organizations"][0]["count"] == 3


def test_no_requests_means_no_rates(client, auth, admin):
    req = get(client, auth, admin).json()["requests"]
    assert req["total"] == 0 and req["approval_rate"] is None and req["avg_decision_hours"] is None


# =============================================================================
# Organizations
# =============================================================================

def test_organization_stats(client, auth, admin, leader, make_user, org, member):
    member(leader, org, verified=True, verified_by=admin)
    member(make_user(), org)  # waiting for verification

    orgs = get(client, auth, admin).json()["organizations"]

    assert orgs["total"] >= 1
    assert orgs["with_verified_members"] >= 1
    assert orgs["pending_verifications"] >= 1


# =============================================================================
# Usage tracking (services/usage.py)
# =============================================================================

@pytest.mark.parametrize("method,path,feature", [
    ("GET", "/rooms/search", "room_search"),
    ("GET", "/rooms/1810", "room_browse"),
    ("GET", "/rooms/1810/photo", None),
    ("POST", "/requests", "booking"),
    ("POST", "/requests/check", "booking"),
    ("POST", "/requests/abc/cancel", "booking_changes"),
    ("POST", "/requests/abc/approve", "admin"),
    ("POST", "/requests/abc/waitlist", "waitlist"),
    ("GET", "/requests/mine", "my_requests"),
    ("GET", "/organizations", "clubs"),
    ("GET", "/admin/users", "admin"),
    ("GET", "/auth/me", "sign_in"),
    ("POST", "/auth/token", None),
    ("GET", "/docs", None),
])
def test_feature_for(method, path, feature):
    assert usage.feature_for(method, path) == feature


def test_user_id_comes_from_login_tokens_only(auth, leader):
    token = auth(leader)["Authorization"]
    assert usage.user_id_from(token) == leader.id
    assert usage.user_id_from(None) is None
    assert usage.user_id_from("Bearer garbage") is None


def test_requests_are_counted_in_memory(client, auth, leader):
    usage._counts.clear()
    client.get("/organizations", headers=auth(leader))
    client.get("/organizations", headers=auth(leader))
    client.get("/organizations")  # not logged in: not counted
    assert usage._counts[(leader.id, TODAY, "clubs")] == 2
    usage._counts.clear()


def test_failed_requests_are_not_counted(client, auth, leader):
    usage._counts.clear()
    client.get(f"/organizations/{uuid.uuid4()}", headers=auth(leader))  # 404
    assert not usage._counts