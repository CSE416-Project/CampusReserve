"""Tests for routers/requests.py: check, submit, list, view, edit, cancel,
approve, deny and the waitlist.

The booking check, 25Live room loading and waitlist promotion are replaced with
fakes (see the `booking_check` fixture), so each test decides whether the room
is free. Everything else (permissions, booking.*, the database) is real.
Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid
from types import SimpleNamespace

import pytest

import routers.requests as requests_router
from models.room import RequestStatus, SyncStatus
from services.room_merge import campus_now

DENIED = (401, 403)


# =============================================================================
# Fakes
# =============================================================================

@pytest.fixture(autouse=True)
def booking_check(monkeypatch):
    """Controls what the booking check reports. Defaults to "the room is free".

        booking_check.set(ok=False, can_waitlist=True, problems=["taken"])
    """
    state = SimpleNamespace(ok=True, can_waitlist=False, problems=[], warnings=[], calls=[])

    def set_(ok=True, can_waitlist=False, problems=(), warnings=()):
        state.ok, state.can_waitlist = ok, can_waitlist
        state.problems, state.warnings = list(problems), list(warnings)

    async def fake_check(*args, **kwargs):
        state.calls.append(kwargs)
        problems = [{"code": c, "message": f"problem: {c}"} for c in state.problems]
        warnings = [SimpleNamespace(to_dict=lambda c=c: {"code": c, "message": f"note: {c}"})
                    for c in state.warnings]
        return SimpleNamespace(
            ok=state.ok, can_waitlist=state.can_waitlist, warnings=warnings,
            blocking=[SimpleNamespace(code=c) for c in state.problems],
            to_dict=lambda: {"ok": state.ok, "can_waitlist": state.can_waitlist,
                             "problems": problems, "warnings": [w.to_dict() for w in warnings]})

    state.set = set_
    monkeypatch.setattr(requests_router, "check_booking", fake_check)
    return state


@pytest.fixture(autouse=True)
def spaces_25live(monkeypatch):
    """25Live rooms that aren't imported yet. Empty unless a test adds some."""
    spaces = []

    async def fake_load():
        return spaces, {}

    monkeypatch.setattr(requests_router, "load_25live_rooms", fake_load)
    return spaces


@pytest.fixture(autouse=True)
def promoted(monkeypatch):
    """Records calls to promote_waitlisted instead of running it."""
    calls = []

    async def fake_promote(db):
        calls.append(db)

    monkeypatch.setattr(requests_router, "promote_waitlisted", fake_promote)
    return calls


# =============================================================================
# Helpers and fixtures
# =============================================================================

def at(days, hour=18):
    return (campus_now() + dt.timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0, tzinfo=None).isoformat()


def body(org, room, days=20, hour=18, hours=2, **kw):
    b = {"organization_id": str(org.id), "room_id": str(room.id), "event_name": "Club Night",
         "start_time": at(days, hour), "end_time": at(days, hour + hours),
         "expected_attendance": 25}
    b.update(kw)
    return b


def ids(resp):
    return [r["id"] for r in resp.json()]


@pytest.fixture()
def verified(admin, leader, org, member):
    """`leader` is a verified member of `org`, so they can book for it."""
    return member(leader, org, verified=True, verified_by=admin,
                  term_start=dt.date.today() - dt.timedelta(days=30))


@pytest.fixture()
def outsider(make_user):
    return make_user(name="Otto Outsider")


# =============================================================================
# POST /requests/check
# =============================================================================

def test_check_reports_a_free_room(client, auth, leader, org, room):
    r = client.post("/requests/check", json=body(org, room), headers=auth(leader))
    assert r.status_code == 200
    assert r.json() == {"ok": True, "can_waitlist": False, "problems": [], "warnings": []}


def test_check_reports_problems(client, auth, leader, org, room, booking_check):
    booking_check.set(ok=False, can_waitlist=True, problems=["taken"], warnings=["busy_day"])
    r = client.post("/requests/check", json=body(org, room), headers=auth(leader))
    assert r.json()["ok"] is False and r.json()["can_waitlist"] is True
    assert [p["code"] for p in r.json()["problems"]] == ["taken"]
    assert [w["code"] for w in r.json()["warnings"]] == ["busy_day"]


def test_check_creates_nothing(client, auth, leader, verified, org, room):
    client.post("/requests/check", json=body(org, room), headers=auth(leader))
    assert client.get("/requests", headers=auth(leader)).json() == []


def test_check_unknown_room_is_404(client, auth, leader, org, room):
    b = body(org, room, room_id=str(uuid.uuid4()))
    assert client.post("/requests/check", json=b, headers=auth(leader)).status_code == 404


def test_check_unknown_25live_room_is_404(client, auth, leader, org, room):
    b = body(org, room, room_id="999999")
    assert client.post("/requests/check", json=b, headers=auth(leader)).status_code == 404


def test_check_unimported_25live_room_uses_its_capacity(client, auth, leader, org, room,
                                                        spaces_25live, booking_check):
    spaces_25live.append({"id": "1810", "name": "SAC 302", "capacity": 40})
    r = client.post("/requests/check", json=body(org, room, room_id="1810"), headers=auth(leader))
    assert r.status_code == 200
    assert booking_check.calls[-1]["fallback_rules"].capacity == 40


def test_check_needs_a_token(client, org, room):
    assert client.post("/requests/check", json=body(org, room)).status_code == 401


# =============================================================================
# POST /requests
# =============================================================================

def test_verified_member_submits_a_request(client, auth, leader, verified, org, room):
    r = client.post("/requests", json=body(org, room, event_name="  Game Night  "),
                    headers=auth(leader))

    assert r.status_code == 201
    req = r.json()
    assert req["status"] == RequestStatus.PENDING.value
    assert req["event_name"] == "Game Night"  # trimmed
    assert req["organization_id"] == str(org.id) and req["room_db_id"] == str(room.id)
    assert req["requester_id"] == str(leader.id)
    assert req["sync_status"] == SyncStatus.NOT_SYNCED.value


def test_setup_and_cleanup_widen_the_reserved_time(client, auth, leader, verified, org, room):
    r = client.post("/requests", json=body(org, room, setup_minutes=30, cleanup_minutes=15),
                    headers=auth(leader))
    req = r.json()
    start, end = dt.datetime.fromisoformat(req["start_time"]), dt.datetime.fromisoformat(req["end_time"])
    assert dt.datetime.fromisoformat(req["setup_start"]) == start - dt.timedelta(minutes=30)
    assert dt.datetime.fromisoformat(req["cleanup_end"]) == end + dt.timedelta(minutes=15)


def test_submit_returns_check_warnings(client, auth, leader, verified, org, room, booking_check):
    booking_check.set(warnings=["other_pending_requests"])
    r = client.post("/requests", json=body(org, room), headers=auth(leader))
    assert r.status_code == 201
    assert [w["code"] for w in r.json()["warnings"]] == ["other_pending_requests"]


def test_unverified_member_cannot_submit(client, auth, leader, org, room, member):
    member(leader, org)  # asked to join, not verified
    assert client.post("/requests", json=body(org, room), headers=auth(leader)).status_code == 403


def test_non_member_cannot_submit(client, auth, outsider, org, room):
    assert client.post("/requests", json=body(org, room),
                       headers=auth(outsider)).status_code == 403


def test_member_whose_term_ended_cannot_submit(client, auth, admin, leader, org, room, member):
    member(leader, org, verified=True, verified_by=admin,
           term_start=dt.date.today() - dt.timedelta(days=365),
           term_end=dt.date.today() - dt.timedelta(days=1))
    assert client.post("/requests", json=body(org, room), headers=auth(leader)).status_code == 403


def test_admin_can_submit_for_any_organization(client, auth, admin, org, room):
    assert client.post("/requests", json=body(org, room), headers=auth(admin)).status_code == 201


def test_taken_room_is_409_with_reasons(client, auth, leader, verified, org, room, booking_check):
    booking_check.set(ok=False, can_waitlist=False, problems=["room_closed"])

    r = client.post("/requests", json=body(org, room), headers=auth(leader))

    assert r.status_code == 409
    assert [p["code"] for p in r.json()["detail"]["problems"]] == ["room_closed"]
    assert "waitlist" not in r.json()["detail"]["message"]


def test_taken_room_suggests_the_waitlist(client, auth, leader, verified, org, room,
                                          booking_check):
    booking_check.set(ok=False, can_waitlist=True, problems=["already_booked"])
    r = client.post("/requests", json=body(org, room), headers=auth(leader))
    assert r.status_code == 409 and "waitlist" in r.json()["detail"]["message"]


def test_taken_room_with_waitlist_flag_joins_the_waitlist(client, auth, leader, verified, org,
                                                          room, booking_check):
    booking_check.set(ok=False, can_waitlist=True, problems=["already_booked"])

    r = client.post("/requests", json=body(org, room, join_waitlist_if_taken=True),
                    headers=auth(leader))

    assert r.status_code == 201
    assert r.json()["status"] == RequestStatus.WAITLISTED.value
    assert r.json()["waitlist_position"] is not None


def test_waitlist_flag_doesnt_override_unwaitlistable_problems(client, auth, leader, verified,
                                                               org, room, booking_check):
    booking_check.set(ok=False, can_waitlist=False, problems=["room_closed"])
    r = client.post("/requests", json=body(org, room, join_waitlist_if_taken=True),
                    headers=auth(leader))
    assert r.status_code == 409


def test_submit_unknown_room_is_404(client, auth, leader, verified, org, room):
    b = body(org, room, room_id=str(uuid.uuid4()))
    assert client.post("/requests", json=b, headers=auth(leader)).status_code == 404


@pytest.mark.parametrize("override", [
    {"event_name": ""}, {"event_name": "x" * 256}, {"setup_minutes": -1},
    {"setup_minutes": 241}, {"cleanup_minutes": 241}, {"expected_attendance": 0},
])
def test_submit_validates_fields(client, auth, leader, verified, org, room, override):
    r = client.post("/requests", json=body(org, room, **override), headers=auth(leader))
    assert r.status_code == 422


@pytest.mark.parametrize("missing", ["organization_id", "room_id", "event_name",
                                     "start_time", "end_time"])
def test_submit_requires_fields(client, auth, leader, verified, org, room, missing):
    b = body(org, room)
    b.pop(missing)
    assert client.post("/requests", json=b, headers=auth(leader)).status_code == 422


def test_submit_needs_a_token(client, org, room):
    assert client.post("/requests", json=body(org, room)).status_code == 401


# =============================================================================
# GET /requests and /requests/mine
# =============================================================================

def test_list_shows_your_orgs_requests_newest_first(client, auth, leader, verified, org, room):
    first = client.post("/requests", json=body(org, room, days=20), headers=auth(leader)).json()
    second = client.post("/requests", json=body(org, room, days=21), headers=auth(leader)).json()

    r = client.get("/requests", headers=auth(leader))

    assert ids(r) == [second["id"], first["id"]]


def test_mine_is_the_same_list(client, auth, leader, verified, make_request):
    make_request(days=22)
    assert ids(client.get("/requests/mine", headers=auth(leader))) == \
        ids(client.get("/requests", headers=auth(leader)))


def test_list_includes_teammates_requests(client, auth, admin, leader, make_user, org,
                                          member, verified, make_request):
    teammate = make_user(name="Tia Teammate")
    member(teammate, org, verified=True, verified_by=admin)
    theirs = make_request(days=23, requester=teammate)

    assert str(theirs.id) in ids(client.get("/requests", headers=auth(leader)))


def test_list_includes_your_own_requests_without_membership(client, auth, leader, make_request):
    mine = make_request(days=24)  # leader is the requester but not a member any more
    assert ids(client.get("/requests", headers=auth(leader))) == [str(mine.id)]


def test_list_hides_other_orgs_requests(client, auth, outsider, make_request):
    make_request(days=25)
    assert client.get("/requests", headers=auth(outsider)).json() == []


def test_list_filters_by_status(client, auth, leader, verified, make_request):
    approved = make_request(days=26, status=RequestStatus.APPROVED)
    make_request(days=27)

    r = client.get("/requests", params={"status": "approved"}, headers=auth(leader))

    assert ids(r) == [str(approved.id)]


def test_list_filters_by_organization(client, auth, admin, leader, verified, db, member,
                                      make_request):
    from models.organization_and_venue import Organization
    other = Organization(name=f"Second Club {uuid.uuid4().hex[:6]}")
    db.add(other)
    db.flush()
    member(leader, other, verified=True, verified_by=admin)
    theirs = make_request(days=28, for_org=other)
    make_request(days=29)

    r = client.get("/requests", params={"organization_id": str(other.id)}, headers=auth(leader))

    assert ids(r) == [str(theirs.id)]


def test_list_upcoming_only(client, auth, leader, verified, make_request):
    upcoming = make_request(days=30)
    make_request(days=-3)

    r = client.get("/requests", params={"upcoming_only": True}, headers=auth(leader))

    assert ids(r) == [str(upcoming.id)]


def test_list_needs_a_token(client):
    assert client.get("/requests").status_code == 401


# =============================================================================
# GET /requests/{id}
# =============================================================================

def test_requester_can_view(client, auth, leader, make_request):
    req = make_request(days=31)
    r = client.get(f"/requests/{req.id}", headers=auth(leader))
    assert r.status_code == 200 and r.json()["id"] == str(req.id)


def test_verified_member_can_view(client, auth, admin, make_user, org, member, make_request):
    teammate = make_user()
    member(teammate, org, verified=True, verified_by=admin)
    req = make_request(days=32)
    assert client.get(f"/requests/{req.id}", headers=auth(teammate)).status_code == 200


def test_admin_can_view(client, auth, admin, make_request):
    req = make_request(days=33)
    assert client.get(f"/requests/{req.id}", headers=auth(admin)).status_code == 200


def test_outsider_gets_404_not_403(client, auth, outsider, make_request):
    """Not even revealing that the request exists."""
    req = make_request(days=34)
    assert client.get(f"/requests/{req.id}", headers=auth(outsider)).status_code == 404


def test_view_unknown_request_is_404(client, auth, admin):
    assert client.get(f"/requests/{uuid.uuid4()}", headers=auth(admin)).status_code == 404


def test_view_shows_room_and_org_names(client, auth, leader, org, room, make_request):
    req = make_request(days=35)
    body_ = client.get(f"/requests/{req.id}", headers=auth(leader)).json()
    assert body_["room_name"] == room.name and body_["organization_name"] == org.name
    assert body_["requester_name"] == leader.name


# =============================================================================
# PATCH /requests/{id}
# =============================================================================

def edit(days=40, hour=19, hours=2, **kw):
    b = {"start_time": at(days, hour), "end_time": at(days, hour + hours)}
    b.update(kw)
    return b


def test_member_edits_a_pending_request(client, auth, leader, verified, make_request):
    req = make_request(days=36)

    r = client.patch(f"/requests/{req.id}",
                     json=edit(event_name="Renamed", expected_attendance=40),
                     headers=auth(leader))

    assert r.status_code == 200
    out = r.json()
    assert out["event_name"] == "Renamed" and out["expected_attendance"] == 40
    assert out["start_time"].startswith(at(40, 19)[:16])
    assert out["status"] == RequestStatus.PENDING.value


def test_edit_rechecks_without_counting_itself(client, auth, leader, verified, make_request,
                                               booking_check):
    req = make_request(days=37)
    client.patch(f"/requests/{req.id}", json=edit(), headers=auth(leader))
    assert booking_check.calls[-1]["exclude_id"] == req.id


def test_edit_to_an_impossible_time_is_409(client, auth, leader, verified, make_request,
                                           booking_check):
    req = make_request(days=38)
    booking_check.set(ok=False, can_waitlist=False, problems=["outside_hours"])
    assert client.patch(f"/requests/{req.id}", json=edit(),
                        headers=auth(leader)).status_code == 409


def test_edit_to_a_taken_time_needs_the_waitlist_flag(client, auth, leader, verified,
                                                      make_request, booking_check):
    req = make_request(days=39)
    booking_check.set(ok=False, can_waitlist=True, problems=["already_booked"])

    refused = client.patch(f"/requests/{req.id}", json=edit(), headers=auth(leader))
    moved = client.patch(f"/requests/{req.id}", json=edit(join_waitlist_if_taken=True),
                         headers=auth(leader))

    assert refused.status_code == 409
    assert moved.status_code == 200 and moved.json()["status"] == RequestStatus.WAITLISTED.value


def test_cannot_edit_an_approved_request(client, auth, leader, verified, make_request):
    req = make_request(days=41, status=RequestStatus.APPROVED)
    assert client.patch(f"/requests/{req.id}", json=edit(),
                        headers=auth(leader)).status_code in (400, 409)


def test_requester_who_left_the_org_cannot_edit(client, auth, leader, make_request):
    req = make_request(days=42)  # leader can see it (their request) but isn't a member
    assert client.patch(f"/requests/{req.id}", json=edit(),
                        headers=auth(leader)).status_code == 403


def test_outsider_cannot_edit(client, auth, outsider, make_request):
    req = make_request(days=43)
    assert client.patch(f"/requests/{req.id}", json=edit(),
                        headers=auth(outsider)).status_code == 404


def test_edit_requires_times(client, auth, leader, verified, make_request):
    req = make_request(days=44)
    assert client.patch(f"/requests/{req.id}", json={"event_name": "Only a name"},
                        headers=auth(leader)).status_code == 422


# =============================================================================
# POST /requests/{id}/cancel
# =============================================================================

def test_member_cancels_a_pending_request(client, auth, leader, verified, make_request,
                                          promoted):
    req = make_request(days=45)

    r = client.post(f"/requests/{req.id}/cancel", headers=auth(leader))

    assert r.status_code == 200
    assert r.json()["request"]["status"] == RequestStatus.CANCELLED.value
    assert r.json()["sync"] is None
    assert promoted == []  # nothing was booked, so nobody to promote


def test_cancelling_an_approved_booking_promotes_the_waitlist(client, auth, leader, verified,
                                                              make_request, promoted):
    req = make_request(days=46, status=RequestStatus.APPROVED)

    r = client.post(f"/requests/{req.id}/cancel", headers=auth(leader))

    assert r.json()["request"]["status"] == RequestStatus.CANCELLED.value
    assert len(promoted) == 1


def test_cancelling_a_synced_booking_cancels_it_in_25live(client, auth, leader, verified,
                                                          make_request, monkeypatch):
    req = make_request(days=47, status=RequestStatus.APPROVED, sync=SyncStatus.SYNCED,
                       external_booking_ref="EV-77")
    cancelled = []

    async def fake_cancel(details, ref):
        cancelled.append(ref)
        return SimpleNamespace(status=SyncStatus.NOT_SYNCED, message="Remove EV-77 in 25Live.",
                               instructions={"event": ref})

    provider = SimpleNamespace(mode="manual", cancel=fake_cancel)
    monkeypatch.setattr(requests_router, "get_provider", lambda: provider)

    r = client.post(f"/requests/{req.id}/cancel", headers=auth(leader))

    assert cancelled == ["EV-77"]
    assert r.json()["sync"]["mode"] == "manual"
    assert r.json()["sync"]["instructions"] == {"event": "EV-77"}


def test_cannot_cancel_twice(client, auth, leader, verified, make_request):
    req = make_request(days=48)
    client.post(f"/requests/{req.id}/cancel", headers=auth(leader))
    assert client.post(f"/requests/{req.id}/cancel",
                       headers=auth(leader)).status_code in (400, 409)


def test_outsider_cannot_cancel(client, auth, outsider, make_request):
    req = make_request(days=49)
    assert client.post(f"/requests/{req.id}/cancel", headers=auth(outsider)).status_code == 404


def test_admin_can_cancel_any_request(client, auth, admin, make_request):
    req = make_request(days=50)
    assert client.post(f"/requests/{req.id}/cancel", headers=auth(admin)).status_code == 200


# =============================================================================
# POST /requests/{id}/approve
# =============================================================================

def test_admin_approves_with_a_reason(client, auth, admin, make_request):
    req = make_request(days=51)

    r = client.post(f"/requests/{req.id}/approve", json={"reason": "Looks good"},
                    headers=auth(admin))

    assert r.status_code == 200
    out = r.json()
    assert out["request"]["status"] == RequestStatus.APPROVED.value
    assert out["request"]["decision_reason"] == "Looks good"
    assert out["request"]["decided_at"] is not None
    assert out["moved_to_waitlist"] == []
    assert out["sync"]["mode"]


def test_approve_without_a_body(client, auth, admin, make_request):
    req = make_request(days=52)
    assert client.post(f"/requests/{req.id}/approve", headers=auth(admin)).status_code == 200


def test_approve_moves_overlapping_requests_to_the_waitlist(client, auth, admin, make_request):
    winner = make_request(days=53, event_name="Winner")
    rival = make_request(days=53, event_name="Rival")  # same room, same time

    r = client.post(f"/requests/{winner.id}/approve", headers=auth(admin))

    assert r.json()["moved_to_waitlist"] == [str(rival.id)]
    rival_now = client.get(f"/requests/{rival.id}", headers=auth(admin)).json()
    assert rival_now["status"] == RequestStatus.WAITLISTED.value


def test_approve_leaves_other_rooms_alone(client, auth, admin, make_room, make_request):
    here = make_request(days=54)
    make_request(days=54, in_room=make_room(name="Room 104"))
    assert client.post(f"/requests/{here.id}/approve",
                       headers=auth(admin)).json()["moved_to_waitlist"] == []


def test_approve_is_refused_when_the_room_is_taken(client, auth, admin, make_request,
                                                   booking_check):
    req = make_request(days=55)
    booking_check.set(ok=False, can_waitlist=True, problems=["already_booked"])

    r = client.post(f"/requests/{req.id}/approve", headers=auth(admin))

    assert r.status_code == 409
    assert client.get(f"/requests/{req.id}",
                      headers=auth(admin)).json()["status"] == RequestStatus.PENDING.value


@pytest.mark.parametrize("code", ["in_past", "not_open_yet"])
def test_approve_ignores_timing_problems(client, auth, admin, make_request, booking_check, code):
    req = make_request(days=56)
    booking_check.set(ok=False, problems=[code])
    assert client.post(f"/requests/{req.id}/approve", headers=auth(admin)).status_code == 200


def test_approve_uses_a_strict_check(client, auth, admin, make_request, booking_check):
    req = make_request(days=57)
    client.post(f"/requests/{req.id}/approve", headers=auth(admin))
    assert booking_check.calls[-1]["strict"] is True
    assert booking_check.calls[-1]["exclude_id"] == req.id


def test_cannot_approve_twice(client, auth, admin, make_request):
    req = make_request(days=58)
    client.post(f"/requests/{req.id}/approve", headers=auth(admin))
    assert client.post(f"/requests/{req.id}/approve",
                       headers=auth(admin)).status_code in (400, 409)


def test_club_leaders_cannot_approve(client, auth, leader, verified, make_request):
    req = make_request(days=59)
    assert client.post(f"/requests/{req.id}/approve",
                       headers=auth(leader)).status_code in DENIED


def test_approve_unknown_request_is_404(client, auth, admin):
    assert client.post(f"/requests/{uuid.uuid4()}/approve",
                       headers=auth(admin)).status_code == 404


# =============================================================================
# POST /requests/{id}/deny
# =============================================================================

def test_admin_denies_with_a_reason(client, auth, admin, make_request):
    req = make_request(days=60)

    r = client.post(f"/requests/{req.id}/deny", json={"reason": "Room under repair"},
                    headers=auth(admin))

    assert r.status_code == 200
    assert r.json()["status"] == RequestStatus.DENIED.value
    assert r.json()["decision_reason"] == "Room under repair"


@pytest.mark.parametrize("payload", [{"reason": ""}, {}])
def test_deny_requires_a_reason(client, auth, admin, make_request, payload):
    req = make_request(days=61)
    assert client.post(f"/requests/{req.id}/deny", json=payload,
                       headers=auth(admin)).status_code == 422


def test_admin_can_deny_a_waitlisted_request(client, auth, admin, make_request):
    req = make_request(days=62, status=RequestStatus.WAITLISTED, waitlist_position=1)
    r = client.post(f"/requests/{req.id}/deny", json={"reason": "No"}, headers=auth(admin))
    assert r.status_code == 200 and r.json()["status"] == RequestStatus.DENIED.value


def test_club_leaders_cannot_deny(client, auth, leader, verified, make_request):
    req = make_request(days=63)
    assert client.post(f"/requests/{req.id}/deny", json={"reason": "No"},
                       headers=auth(leader)).status_code in DENIED


# =============================================================================
# POST and DELETE /requests/{id}/waitlist
# =============================================================================

def test_join_the_waitlist_when_taken(client, auth, leader, verified, make_request,
                                      booking_check):
    req = make_request(days=64)
    booking_check.set(ok=False, can_waitlist=True, problems=["already_booked"])

    r = client.post(f"/requests/{req.id}/waitlist", headers=auth(leader))

    assert r.status_code == 200
    assert r.json()["status"] == RequestStatus.WAITLISTED.value


def test_cannot_waitlist_a_free_slot(client, auth, leader, verified, make_request):
    req = make_request(days=65)
    r = client.post(f"/requests/{req.id}/waitlist", headers=auth(leader))
    assert r.status_code == 409 and "free" in r.json()["detail"]


def test_cannot_waitlist_an_unwaitlistable_slot(client, auth, leader, verified, make_request,
                                                booking_check):
    req = make_request(days=66)
    booking_check.set(ok=False, can_waitlist=False, problems=["room_closed"])
    assert client.post(f"/requests/{req.id}/waitlist",
                       headers=auth(leader)).status_code == 409


def test_outsider_cannot_join_the_waitlist(client, auth, outsider, make_request, booking_check):
    req = make_request(days=67)
    booking_check.set(ok=False, can_waitlist=True, problems=["already_booked"])
    assert client.post(f"/requests/{req.id}/waitlist",
                       headers=auth(outsider)).status_code == 404


def test_leave_the_waitlist_withdraws_the_request(client, auth, leader, verified,
                                                  make_request):
    req = make_request(days=68, status=RequestStatus.WAITLISTED, waitlist_position=1)

    r = client.delete(f"/requests/{req.id}/waitlist", headers=auth(leader))

    assert r.status_code == 200
    assert r.json()["status"] == RequestStatus.CANCELLED.value


def test_cannot_leave_a_waitlist_you_are_not_on(client, auth, leader, verified, make_request):
    req = make_request(days=69)
    assert client.delete(f"/requests/{req.id}/waitlist", headers=auth(leader)).status_code == 409


def test_outsider_cannot_remove_someone_from_the_waitlist(client, auth, outsider, make_request):
    req = make_request(days=70, status=RequestStatus.WAITLISTED, waitlist_position=1)
    assert client.delete(f"/requests/{req.id}/waitlist",
                         headers=auth(outsider)).status_code == 404
