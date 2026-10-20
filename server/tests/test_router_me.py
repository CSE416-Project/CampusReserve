"""Tests for routers/me.py: /me/memberships, /me/calendar-link and the
/calendar/{token}.ics feed.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid
from urllib.parse import urlparse

import pytest
from jose import jwt

from authentication import ALGORITHM, SECRET_KEY
from models.organization_and_venue import Organization
from models.room import RequestStatus

CALENDAR = "calendar"


def calendar_token(user_id, purpose=CALENDAR, key=SECRET_KEY):
    claims = {"sub": str(user_id)}
    if purpose is not None:
        claims["purpose"] = purpose
    return jwt.encode(claims, key, algorithm=ALGORITHM)


def feed(client, token):
    return client.get(f"/calendar/{token}.ics")


@pytest.fixture()
def viewer(make_user, org, admin, member):
    """A verified member of `org` who isn't the requester of the test bookings,
    so bookings reach their calendar through the organization."""
    user = make_user(name="Vera Viewer")
    member(user, org, verified=True, verified_by=admin,
           term_start=dt.date.today() - dt.timedelta(days=60))
    return user


@pytest.fixture()
def other_org(db):
    o = Organization(name=f"Other Club {uuid.uuid4().hex[:6]}")
    db.add(o)
    db.flush()
    return o


# =============================================================================
# GET /me/memberships
# =============================================================================

def test_memberships_need_a_token(client):
    assert client.get("/me/memberships").status_code == 401


def test_memberships_empty_for_a_new_user(client, auth, leader):
    r = client.get("/me/memberships", headers=auth(leader))
    assert r.status_code == 200 and r.json() == []


def test_memberships_show_verification_status(client, auth, admin, leader, org, other_org,
                                              member):
    member(leader, org, verified=True, verified_by=admin, position_title="President")
    member(leader, other_org)

    items = {m["organization_id"]: m for m in
             client.get("/me/memberships", headers=auth(leader)).json()}

    assert items[str(org.id)]["verified"] is True
    assert items[str(org.id)]["position_title"] == "President"
    assert items[str(other_org.id)]["verified"] is False


def test_memberships_only_show_your_own(client, auth, leader, make_user, org, member):
    member(make_user(), org)
    assert client.get("/me/memberships", headers=auth(leader)).json() == []


# =============================================================================
# GET /me/calendar-link
# =============================================================================

def test_calendar_link_needs_a_token(client):
    assert client.get("/me/calendar-link").status_code == 401


def test_calendar_link_points_at_the_feed(client, auth, leader):
    body = client.get("/me/calendar-link", headers=auth(leader)).json()

    path = urlparse(body["url"]).path
    assert path.startswith("/calendar/") and path.endswith(".ics")
    assert body["note"]


def test_calendar_link_token_identifies_the_user(client, auth, leader):
    url = client.get("/me/calendar-link", headers=auth(leader)).json()["url"]
    token = urlparse(url).path.removeprefix("/calendar/").removesuffix(".ics")

    claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert claims == {"sub": str(leader.id), "purpose": CALENDAR}


def test_calendar_link_opens(client, auth, leader):
    url = client.get("/me/calendar-link", headers=auth(leader)).json()["url"]
    r = client.get(urlparse(url).path)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/calendar")


def test_calendar_token_cannot_be_used_to_log_in(client, leader):
    """The calendar key never expires and ends up in calendar apps, so it must
    not work as a login token for the API."""
    token = calendar_token(leader.id)
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


# =============================================================================
# GET /calendar/{token}.ics: who can open it
# =============================================================================

def test_feed_rejects_garbage_tokens(client):
    assert feed(client, "not-a-token").status_code == 404


def test_feed_rejects_login_tokens(client, auth, leader):
    """A normal access token has no calendar purpose, so it can't open a feed."""
    login_token = auth(leader)["Authorization"].removeprefix("Bearer ")
    assert feed(client, login_token).status_code == 404


def test_feed_rejects_other_purposes(client, leader):
    assert feed(client, calendar_token(leader.id, purpose="reset-password")).status_code == 404


def test_feed_rejects_tokens_signed_with_another_key(client, leader):
    forged = calendar_token(leader.id, key="not-the-real-secret")
    assert feed(client, forged).status_code == 404


@pytest.mark.parametrize("sub", ["not-a-uuid", "", None])
def test_feed_rejects_bad_user_ids(client, sub):
    claims = {"purpose": CALENDAR} | ({"sub": sub} if sub is not None else {})
    token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    assert feed(client, token).status_code == 404


def test_feed_rejects_unknown_users(client):
    assert feed(client, calendar_token(uuid.uuid4())).status_code == 404


def test_feed_rejects_deactivated_users(client, make_user):
    user = make_user(is_active=False)
    assert feed(client, calendar_token(user.id)).status_code == 404


def test_feed_errors_look_the_same(client, make_user):
    """Every failure is the same 404, so a link can't be used to probe accounts."""
    inactive = make_user(is_active=False)
    bodies = {feed(client, t).text for t in
              ("garbage", calendar_token(uuid.uuid4()), calendar_token(inactive.id))}
    assert len(bodies) == 1


# =============================================================================
# GET /calendar/{token}.ics: what's in it
# =============================================================================

def test_feed_is_an_icalendar_file(client, viewer):
    r = feed(client, calendar_token(viewer.id))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VCALENDAR" in r.text and "END:VCALENDAR" in r.text


def test_feed_includes_approved_bookings_of_your_orgs(client, viewer, make_request):
    req = make_request(days=5, status=RequestStatus.APPROVED, event_name="Game Night")

    body = feed(client, calendar_token(viewer.id)).text

    assert str(req.id) in body and "Game Night" in body


@pytest.mark.parametrize("status_", [RequestStatus.PENDING, RequestStatus.DENIED])
def test_feed_leaves_out_unapproved_requests(client, viewer, make_request, status_):
    make_request(days=6, status=status_, event_name="Not Happening")
    assert "Not Happening" not in feed(client, calendar_token(viewer.id)).text


def test_feed_leaves_out_other_orgs_bookings(client, viewer, make_request, other_org):
    make_request(days=7, status=RequestStatus.APPROVED, for_org=other_org,
                 event_name="Someone Elses Event")
    assert "Someone Elses Event" not in feed(client, calendar_token(viewer.id)).text


def test_feed_includes_your_own_requests_in_any_org(client, viewer, make_request, other_org):
    make_request(days=8, status=RequestStatus.APPROVED, for_org=other_org,
                 requester=viewer, event_name="My Own Event")
    assert "My Own Event" in feed(client, calendar_token(viewer.id)).text


def test_feed_leaves_out_orgs_you_are_not_verified_for(client, make_user, org, member,
                                                       make_request):
    pending = make_user(name="Pat Pending")
    member(pending, org)  # asked to join, not verified
    make_request(days=9, status=RequestStatus.APPROVED, event_name="Members Only")
    assert "Members Only" not in feed(client, calendar_token(pending.id)).text


def test_feed_leaves_out_orgs_whose_term_ended(client, make_user, admin, org, member,
                                               make_request):
    alum = make_user(name="Al Alum")
    member(alum, org, verified=True, verified_by=admin,
           term_start=dt.date.today() - dt.timedelta(days=400),
           term_end=dt.date.today() - dt.timedelta(days=1))
    make_request(days=10, status=RequestStatus.APPROVED, event_name="After Graduation")
    assert "After Graduation" not in feed(client, calendar_token(alum.id)).text


def test_feed_keeps_the_last_30_days(client, viewer, make_request):
    make_request(days=-10, status=RequestStatus.APPROVED, event_name="Recent Past")
    make_request(days=-40, status=RequestStatus.APPROVED, event_name="Long Ago")

    body = feed(client, calendar_token(viewer.id)).text

    assert "Recent Past" in body and "Long Ago" not in body


def test_feed_lists_bookings_in_time_order(client, viewer, make_request):
    later = make_request(days=12, status=RequestStatus.APPROVED, event_name="Later One")
    sooner = make_request(days=11, status=RequestStatus.APPROVED, event_name="Sooner One")

    body = feed(client, calendar_token(viewer.id)).text

    assert body.index(str(sooner.id)) < body.index(str(later.id))


def test_feed_shows_room_and_organization(client, viewer, org, room, make_request):
    make_request(days=13, status=RequestStatus.APPROVED)
    body = feed(client, calendar_token(viewer.id)).text
    assert room.name in body and org.name in body


def test_feed_is_empty_but_valid_without_bookings(client, viewer):
    r = feed(client, calendar_token(viewer.id))
    assert r.status_code == 200 and "BEGIN:VEVENT" not in r.text
