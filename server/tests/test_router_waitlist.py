"""Tests for routers/waitlist.py: /waitlist/mine and /waitlist/rooms/{id}.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid

import pytest

from models.organization_and_venue import Organization
from models.room import RequestStatus

WAITLISTED = RequestStatus.WAITLISTED


@pytest.fixture()
def verified(admin, leader, org, member):
    """`leader` is a verified member of `org`."""
    return member(leader, org, verified=True, verified_by=admin,
                  term_start=dt.date.today() - dt.timedelta(days=30))


@pytest.fixture()
def other_org(db):
    o = Organization(name=f"Rival Club {uuid.uuid4().hex[:6]}")
    db.add(o)
    db.flush()
    return o


@pytest.fixture()
def rival(make_user, admin, other_org, member):
    """A verified member of another organization."""
    user = make_user(name="Riley Rival")
    member(user, other_org, verified=True, verified_by=admin)
    return user


def waiting(make_request, days, position, **kw):
    return make_request(days=days, status=WAITLISTED, waitlist_position=position, **kw)


# =============================================================================
# Login required
# =============================================================================

@pytest.mark.parametrize("path", ["/waitlist/mine", f"/waitlist/rooms/{uuid.uuid4()}"])
def test_waitlist_endpoints_need_a_token(client, path):
    assert client.get(path).status_code == 401


# =============================================================================
# GET /waitlist/mine
# =============================================================================

def test_mine_is_empty_with_nothing_waitlisted(client, auth, leader, verified):
    r = client.get("/waitlist/mine", headers=auth(leader))
    assert r.status_code == 200 and r.json() == []


def test_mine_shows_position_and_how_many_are_ahead(client, auth, leader, verified,
                                                    make_request):
    req = waiting(make_request, days=10, position=3)

    entry = client.get("/waitlist/mine", headers=auth(leader)).json()[0]

    assert entry["request"]["id"] == str(req.id)
    assert entry["request"]["status"] == WAITLISTED.value
    assert (entry["position"], entry["ahead_of_you"]) == (3, 2)


def test_first_in_line_has_nobody_ahead(client, auth, leader, verified, make_request):
    waiting(make_request, days=10, position=1)
    assert client.get("/waitlist/mine", headers=auth(leader)).json()[0]["ahead_of_you"] == 0


def test_mine_includes_teammates_waitlisted_requests(client, auth, admin, leader, verified,
                                                     make_user, org, member, make_request):
    teammate = make_user(name="Tia Teammate")
    member(teammate, org, verified=True, verified_by=admin)
    theirs = waiting(make_request, days=11, position=1, requester=teammate)

    ids = [e["request"]["id"] for e in client.get("/waitlist/mine", headers=auth(leader)).json()]

    assert ids == [str(theirs.id)]


def test_mine_includes_your_own_requests_in_any_org(client, auth, leader, other_org,
                                                    make_request):
    mine = waiting(make_request, days=12, position=1, for_org=other_org)  # leader requested it
    ids = [e["request"]["id"] for e in client.get("/waitlist/mine", headers=auth(leader)).json()]
    assert ids == [str(mine.id)]


def test_mine_leaves_out_other_orgs(client, auth, leader, verified, rival, other_org,
                                    make_request):
    waiting(make_request, days=13, position=1, for_org=other_org, requester=rival)
    assert client.get("/waitlist/mine", headers=auth(leader)).json() == []


def test_mine_leaves_out_unverified_memberships(client, auth, make_user, org, member,
                                                make_request):
    pending = make_user(name="Pat Pending")
    member(pending, org)  # asked to join, not verified
    waiting(make_request, days=14, position=1)
    assert client.get("/waitlist/mine", headers=auth(pending)).json() == []


@pytest.mark.parametrize("status_", [RequestStatus.PENDING, RequestStatus.APPROVED,
                                     RequestStatus.DENIED])
def test_mine_only_shows_waitlisted_requests(client, auth, leader, verified, make_request,
                                             status_):
    make_request(days=15, status=status_)
    assert client.get("/waitlist/mine", headers=auth(leader)).json() == []


def test_mine_leaves_out_past_slots(client, auth, leader, verified, make_request):
    waiting(make_request, days=-3, position=1)
    assert client.get("/waitlist/mine", headers=auth(leader)).json() == []


def test_mine_is_ordered_by_event_time(client, auth, leader, verified, make_request):
    later = waiting(make_request, days=20, position=1, event_name="Later")
    sooner = waiting(make_request, days=16, position=2, event_name="Sooner")

    ids = [e["request"]["id"] for e in client.get("/waitlist/mine", headers=auth(leader)).json()]

    assert ids == [str(sooner.id), str(later.id)]


# =============================================================================
# GET /waitlist/rooms/{room_id}
# =============================================================================

def test_room_line_shows_positions_and_times(client, auth, leader, verified, room,
                                             make_request):
    req = waiting(make_request, days=10, position=1)

    line = client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader)).json()

    assert len(line) == 1
    entry = line[0]
    assert entry["position"] == 1
    assert dt.datetime.fromisoformat(entry["start"]) == req.start_time
    assert dt.datetime.fromisoformat(entry["end"]) == req.end_time


def test_room_line_marks_your_entries(client, auth, leader, verified, rival, other_org, room,
                                      make_request):
    mine = waiting(make_request, days=10, position=2)
    waiting(make_request, days=10, position=1, for_org=other_org, requester=rival)

    line = client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader)).json()

    assert [(e["position"], e["is_yours"], e["request_id"]) for e in line] == \
        [(1, False, None), (2, True, str(mine.id))]


def test_room_line_keeps_other_orgs_private(client, auth, leader, verified, rival, other_org,
                                            room, make_request):
    waiting(make_request, days=10, position=1, for_org=other_org, requester=rival,
            event_name="Secret Party")

    r = client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader))

    entry = r.json()[0]
    assert set(entry) == {"position", "start", "end", "is_yours", "request_id"}
    assert entry["request_id"] is None
    assert "Secret Party" not in r.text and other_org.name not in r.text


def test_room_line_sees_your_own_request_without_membership(client, auth, leader, room,
                                                            make_request):
    mine = waiting(make_request, days=10, position=1)  # leader requested it, isn't a member
    entry = client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader)).json()[0]
    assert entry["is_yours"] is True and entry["request_id"] == str(mine.id)


def test_room_line_is_ordered_by_time_then_position(client, auth, leader, verified, room,
                                                    make_request):
    waiting(make_request, days=12, position=1, event_name="Later slot")
    second = waiting(make_request, days=10, position=2)
    first = waiting(make_request, days=10, position=1)

    line = client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader)).json()

    assert [e["request_id"] for e in line[:2]] == [str(first.id), str(second.id)]
    assert len(line) == 3


def test_room_line_only_includes_this_room(client, auth, leader, verified, room, make_room,
                                           make_request):
    waiting(make_request, days=10, position=1, in_room=make_room(name="Room 999"))
    assert client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader)).json() == []


def test_room_line_leaves_out_past_and_non_waitlisted(client, auth, leader, verified, room,
                                                      make_request):
    waiting(make_request, days=-3, position=1)
    make_request(days=10)  # pending, not waiting
    assert client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader)).json() == []


def test_room_line_by_25live_id(client, auth, leader, verified, make_room, make_request):
    sac = make_room(name="SAC 302", external_ref="1810")
    waiting(make_request, days=10, position=1, in_room=sac)
    assert len(client.get("/waitlist/rooms/1810", headers=auth(leader)).json()) == 1


def test_room_line_empty_room(client, auth, leader, room):
    r = client.get(f"/waitlist/rooms/{room.id}", headers=auth(leader))
    assert r.status_code == 200 and r.json() == []


@pytest.mark.parametrize("room_id", [str(uuid.uuid4()), "999999"])
def test_room_line_unknown_room_is_404(client, auth, leader, room_id):
    assert client.get(f"/waitlist/rooms/{room_id}", headers=auth(leader)).status_code == 404
