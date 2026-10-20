"""Tests for routers/admin.py: review queue, 25Live sync, rooms, closures,
users and organizations."""

from __future__ import annotations

import datetime as dt
import uuid

import pytest

from models.organization_and_venue import OrganizationMember
from models.room import RequestStatus, SyncStatus
from models.user import UserRole
from services import room_features
from services.room_merge import campus_now

DENIED = (401, 403)  # depending on how get_current_user reports missing scopes


def iso(days, hour=9):
    t = (campus_now() + dt.timedelta(days=days)).replace(hour=hour, minute=0, second=0,
                                                         microsecond=0, tzinfo=None)
    return t.isoformat()


# =============================================================================
# Access control
# =============================================================================

ADMIN_GETS = ["/admin/requests", "/admin/sync", "/admin/closures", "/admin/users"]


@pytest.mark.parametrize("path", ADMIN_GETS)
def test_admin_endpoints_need_a_token(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", ADMIN_GETS)
def test_club_leaders_cannot_use_admin_endpoints(client, auth, leader, path):
    assert client.get(path, headers=auth(leader)).status_code in DENIED


@pytest.mark.parametrize("path", ADMIN_GETS)
def test_admins_can_use_admin_endpoints(client, auth, admin, path):
    assert client.get(path, headers=auth(admin)).status_code == 200


def test_venue_host_cannot_manage_users(client, auth, host):
    assert client.get("/admin/users", headers=auth(host)).status_code in DENIED


# =============================================================================
# Review queue
# =============================================================================

def test_queue_is_empty_without_requests(client, auth, admin):
    assert client.get("/admin/requests", headers=auth(admin)).json() == []


def test_queue_lists_pending_oldest_first_with_a_check(client, auth, admin, make_request):
    first = make_request(days=10, event_name="First")
    second = make_request(days=11, event_name="Second")
    make_request(days=12, status=RequestStatus.DENIED)

    items = client.get("/admin/requests", headers=auth(admin)).json()

    assert [i["request"]["id"] for i in items] == [str(first.id), str(second.id)]
    assert all(i["check"]["ok"] is True for i in items)


def test_queue_filters_by_status_without_a_check(client, auth, admin, make_request):
    approved = make_request(days=13, status=RequestStatus.APPROVED)
    make_request(days=14)

    items = client.get("/admin/requests", params={"status": "approved"},
                       headers=auth(admin)).json()

    assert [i["request"]["id"] for i in items] == [str(approved.id)]
    assert items[0]["check"] is None


def test_queue_filters_by_organization(client, auth, admin, db, make_request):
    from models.organization_and_venue import Organization
    other = Organization(name=f"Other {uuid.uuid4().hex[:6]}")
    db.add(other)
    db.flush()
    mine = make_request(days=15)
    make_request(days=16, for_org=other)

    items = client.get("/admin/requests", params={"organization_id": str(mine.organization_id)},
                       headers=auth(admin)).json()

    assert [i["request"]["id"] for i in items] == [str(mine.id)]


def test_queue_filters_by_room(client, auth, admin, make_room, make_request):
    other_room = make_room(name="Room 202")
    mine = make_request(days=17)
    make_request(days=18, in_room=other_room)

    items = client.get("/admin/requests", params={"room_id": str(mine.room_id)},
                       headers=auth(admin)).json()

    assert [i["request"]["id"] for i in items] == [str(mine.id)]


def test_queue_with_unknown_room_is_empty(client, auth, admin, make_request):
    make_request(days=19)
    r = client.get("/admin/requests", params={"room_id": str(uuid.uuid4())}, headers=auth(admin))
    assert r.status_code == 200 and r.json() == []


@pytest.mark.parametrize("limit", [0, 201])
def test_queue_rejects_bad_limits(client, auth, admin, limit):
    r = client.get("/admin/requests", params={"limit": limit}, headers=auth(admin))
    assert r.status_code == 422


def test_queue_respects_limit(client, auth, admin, make_request):
    for d in (20, 21, 22):
        make_request(days=d)
    r = client.get("/admin/requests", params={"limit": 2}, headers=auth(admin))
    assert len(r.json()) == 2


# =============================================================================
# 25Live sync
# =============================================================================

def test_sync_queue_lists_unsynced_upcoming_approvals(client, auth, admin, make_request):
    later = make_request(days=31, status=RequestStatus.APPROVED)
    sooner = make_request(days=30, status=RequestStatus.APPROVED, sync=SyncStatus.FAILED)
    make_request(days=32, status=RequestStatus.APPROVED, sync=SyncStatus.SYNCED,
                 external_booking_ref="EV-1")
    make_request(days=33)  # pending: not synced yet, but not approved either

    items = client.get("/admin/sync", headers=auth(admin)).json()

    assert [i["request"]["id"] for i in items] == [str(sooner.id), str(later.id)]
    assert all(i["steps"] for i in items)


def test_sync_queue_hides_past_unless_asked(client, auth, admin, make_request):
    past = make_request(days=-5, status=RequestStatus.APPROVED)

    default = client.get("/admin/sync", headers=auth(admin)).json()
    with_past = client.get("/admin/sync", params={"include_past": True},
                           headers=auth(admin)).json()

    assert str(past.id) not in [i["request"]["id"] for i in default]
    assert str(past.id) in [i["request"]["id"] for i in with_past]


def test_push_refuses_unapproved_requests(client, auth, admin, make_request):
    req = make_request(days=34)
    r = client.post(f"/admin/requests/{req.id}/sync", headers=auth(admin))
    assert r.status_code == 409


def test_push_refuses_already_synced_requests(client, auth, admin, make_request):
    req = make_request(days=35, status=RequestStatus.APPROVED, sync=SyncStatus.SYNCED,
                       external_booking_ref="EV-2")
    r = client.post(f"/admin/requests/{req.id}/sync", headers=auth(admin))
    assert r.status_code == 409
    assert "EV-2" in r.json()["detail"]


def test_push_unknown_request_is_404(client, auth, admin):
    r = client.post(f"/admin/requests/{uuid.uuid4()}/sync", headers=auth(admin))
    assert r.status_code == 404


def test_confirm_sync_marks_request_synced(client, auth, admin, make_request):
    req = make_request(days=36, status=RequestStatus.APPROVED)

    r = client.post(f"/admin/requests/{req.id}/sync/confirm",
                    json={"external_booking_ref": "EV-123"}, headers=auth(admin))

    assert r.status_code == 200
    assert r.json()["sync_status"] == SyncStatus.SYNCED.value
    assert r.json()["external_booking_ref"] == "EV-123"


def test_confirm_sync_needs_a_reference(client, auth, admin, make_request):
    req = make_request(days=37, status=RequestStatus.APPROVED)
    r = client.post(f"/admin/requests/{req.id}/sync/confirm",
                    json={"external_booking_ref": ""}, headers=auth(admin))
    assert r.status_code == 422


def test_club_leaders_cannot_confirm_sync(client, auth, leader, make_request):
    req = make_request(days=38, status=RequestStatus.APPROVED)
    r = client.post(f"/admin/requests/{req.id}/sync/confirm",
                    json={"external_booking_ref": "EV-9"}, headers=auth(leader))
    assert r.status_code in DENIED


# =============================================================================
# Rooms
# =============================================================================

def test_admin_updates_room_details(client, auth, admin, room):
    r = client.patch(f"/admin/rooms/{room.id}",
                     json={"capacity": 45, "club_bookable": False,
                           "booking_opens_days_ahead": 60},
                     headers=auth(admin))

    assert r.status_code == 200
    body = r.json()
    assert (body["capacity"], body["club_bookable"], body["booking_opens_days_ahead"]) == \
        (45, False, 60)
    assert body["name"] == "Room 101"  # fields not sent are unchanged


def test_room_update_normalizes_known_feature_tags(client, auth, admin, room):
    tag = sorted(room_features.FEATURES)[0]
    r = client.patch(f"/admin/rooms/{room.id}", json={"features": [tag, tag]},
                     headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["features"] == [tag]


def test_room_update_rejects_unknown_feature_tags(client, auth, admin, room):
    r = client.patch(f"/admin/rooms/{room.id}", json={"features": ["definitely-not-a-tag"]},
                     headers=auth(admin))
    assert r.status_code == 422
    assert "valid_tags" in r.json()["detail"]


@pytest.mark.parametrize("field", ["name", "club_bookable", "is_active"])
def test_room_update_refuses_to_clear_required_fields(client, auth, admin, room, field):
    r = client.patch(f"/admin/rooms/{room.id}", json={field: None}, headers=auth(admin))
    assert r.status_code == 422


@pytest.mark.parametrize("body", [{"capacity": -1}, {"booking_opens_days_ahead": 731},
                                  {"name": ""}])
def test_room_update_validates_values(client, auth, admin, room, body):
    assert client.patch(f"/admin/rooms/{room.id}", json=body,
                        headers=auth(admin)).status_code == 422


def test_room_update_unknown_room_is_404(client, auth, admin):
    r = client.patch(f"/admin/rooms/{uuid.uuid4()}", json={"capacity": 10}, headers=auth(admin))
    assert r.status_code == 404


def test_room_update_duplicate_name_in_venue_is_409(client, auth, admin, room, make_room):
    other = make_room(name="Room 102")
    r = client.patch(f"/admin/rooms/{other.id}", json={"name": room.name}, headers=auth(admin))
    assert r.status_code == 409


def test_host_cannot_edit_rooms_outside_their_venues(client, auth, host, room):
    r = client.patch(f"/admin/rooms/{room.id}", json={"capacity": 5}, headers=auth(host))
    assert r.status_code in DENIED


def test_club_leaders_cannot_edit_rooms(client, auth, leader, room):
    r = client.patch(f"/admin/rooms/{room.id}", json={"capacity": 5}, headers=auth(leader))
    assert r.status_code in DENIED


def test_admin_imports_rooms(client, auth, admin):
    r = client.post("/admin/rooms/import", json={"building": "Student Activities"},
                    headers=auth(admin))
    assert r.status_code == 200
    assert isinstance(r.json(), dict)


def test_only_admins_import_rooms(client, auth, host):
    assert client.post("/admin/rooms/import", headers=auth(host)).status_code in DENIED


# =============================================================================
# Closures
# =============================================================================

def closure(room=None, venue=None, start_days=40, end_days=41, reason="HVAC maintenance"):
    body = {"closed_from": iso(start_days), "closed_until": iso(end_days), "reason": reason}
    if room is not None:
        body["room_id"] = str(room.id)
    if venue is not None:
        body["venue_id"] = str(venue.id)
    return body


def test_admin_closes_a_room(client, auth, admin, room):
    r = client.post("/admin/closures", json=closure(room=room), headers=auth(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["room_name"] == "Room 101"
    assert body["venue_id"] is None
    assert body["reason"] == "HVAC maintenance"


def test_closure_lists_requests_it_affects(client, auth, admin, room, make_request):
    inside = make_request(days=40, start_hour=12)
    make_request(days=45)  # outside the closure

    r = client.post("/admin/closures", json=closure(room=room, start_days=40, end_days=41),
                    headers=auth(admin))

    assert [a["id"] for a in r.json()["affected_requests"]] == [str(inside.id)]


def test_venue_closure_covers_all_its_rooms(client, auth, admin, venue, make_room,
                                            make_request):
    other = make_room(name="Room 103")
    req = make_request(days=50, start_hour=12, in_room=other)

    r = client.post("/admin/closures", json=closure(venue=venue, start_days=50, end_days=51),
                    headers=auth(admin))

    assert r.status_code == 201
    assert r.json()["venue_name"] == venue.name
    assert [a["id"] for a in r.json()["affected_requests"]] == [str(req.id)]


@pytest.mark.parametrize("which", ["both", "neither"])
def test_closure_needs_exactly_one_target(client, auth, admin, room, venue, which):
    body = closure(room=room, venue=venue) if which == "both" else closure()
    assert client.post("/admin/closures", json=body, headers=auth(admin)).status_code == 422


def test_closure_must_end_after_it_starts(client, auth, admin, room):
    body = closure(room=room, start_days=42, end_days=41)
    assert client.post("/admin/closures", json=body, headers=auth(admin)).status_code == 422


def test_closure_needs_a_reason(client, auth, admin, room):
    body = closure(room=room, reason="")
    assert client.post("/admin/closures", json=body, headers=auth(admin)).status_code == 422


def test_closure_for_unknown_venue_is_404(client, auth, admin):
    body = {"venue_id": str(uuid.uuid4()), "closed_from": iso(40), "closed_until": iso(41),
            "reason": "Holiday"}
    assert client.post("/admin/closures", json=body, headers=auth(admin)).status_code == 404


def test_host_cannot_close_rooms_outside_their_venues(client, auth, host, room):
    r = client.post("/admin/closures", json=closure(room=room), headers=auth(host))
    assert r.status_code in DENIED


def test_closures_list_hides_past_unless_asked(client, auth, admin, room):
    client.post("/admin/closures", json=closure(room=room, start_days=-10, end_days=-9),
                headers=auth(admin))
    upcoming = client.post("/admin/closures", json=closure(room=room, start_days=60,
                                                           end_days=61),
                           headers=auth(admin)).json()

    default = client.get("/admin/closures", headers=auth(admin)).json()
    everything = client.get("/admin/closures", params={"include_past": True},
                            headers=auth(admin)).json()

    assert [c["id"] for c in default] == [upcoming["id"]]
    assert len(everything) == 2


def test_closures_list_for_a_room_includes_its_venue(client, auth, admin, room, venue):
    client.post("/admin/closures", json=closure(room=room, start_days=70, end_days=71),
                headers=auth(admin))
    client.post("/admin/closures", json=closure(venue=venue, start_days=72, end_days=73),
                headers=auth(admin))

    items = client.get("/admin/closures", params={"room_id": str(room.id)},
                       headers=auth(admin)).json()

    assert len(items) == 2


def test_delete_closure(client, auth, admin, room):
    c = client.post("/admin/closures", json=closure(room=room), headers=auth(admin)).json()

    assert client.delete(f"/admin/closures/{c['id']}", headers=auth(admin)).status_code == 204
    assert client.delete(f"/admin/closures/{c['id']}", headers=auth(admin)).status_code == 404


# =============================================================================
# Users
# =============================================================================

def test_list_users_filters_by_role_and_search(client, auth, admin, make_user):
    make_user(UserRole.CLUB_LEADER, name="Zelda Zebra")
    make_user(UserRole.VENUE_HOST, name="Victor Venue")

    leaders = client.get("/admin/users", params={"role": UserRole.CLUB_LEADER.value},
                         headers=auth(admin)).json()
    found = client.get("/admin/users", params={"search": "zebra"}, headers=auth(admin)).json()

    assert {u["role"] for u in leaders} == {UserRole.CLUB_LEADER.value}
    assert [u["name"] for u in found] == ["Zelda Zebra"]


def test_list_users_awaiting_verification(client, auth, admin, make_user, org, member):
    waiting = make_user(name="Wanda Waiting")
    done = make_user(name="Vic Verified")
    member(waiting, org)
    member(done, org, verified=True, verified_by=admin)

    users = client.get("/admin/users", params={"awaiting_verification": True},
                       headers=auth(admin)).json()

    names = [u["name"] for u in users]
    assert "Wanda Waiting" in names and "Vic Verified" not in names
    wanda = next(u for u in users if u["name"] == "Wanda Waiting")
    assert wanda["memberships"][0]["verified"] is False


def test_admin_changes_a_users_role(client, auth, admin, leader):
    r = client.patch(f"/admin/users/{leader.id}", json={"role": UserRole.VENUE_HOST.value},
                     headers=auth(admin))
    assert r.status_code == 200 and r.json()["role"] == UserRole.VENUE_HOST.value


def test_admin_deactivates_a_user(client, auth, admin, leader):
    r = client.patch(f"/admin/users/{leader.id}", json={"is_active": False},
                     headers=auth(admin))
    assert r.status_code == 200 and r.json()["is_active"] is False


@pytest.mark.parametrize("body", [{"is_active": False},
                                  {"role": UserRole.CLUB_LEADER.value}])
def test_admin_cannot_remove_own_admin_access(client, auth, admin, body):
    r = client.patch(f"/admin/users/{admin.id}", json=body, headers=auth(admin))
    assert r.status_code == 409


def test_update_unknown_user_is_404(client, auth, admin):
    r = client.patch(f"/admin/users/{uuid.uuid4()}", json={"is_active": False},
                     headers=auth(admin))
    assert r.status_code == 404


# =============================================================================
# Organizations and memberships
# =============================================================================

def test_create_organization(client, auth, admin):
    r = client.post("/admin/organizations", json={"name": "  Chess Club Test  ",
                                                  "description": "Checkmate"},
                    headers=auth(admin))
    assert r.status_code == 201
    assert r.json()["name"] == "Chess Club Test"  # trimmed


def test_create_duplicate_organization_is_409(client, auth, admin, org):
    r = client.post("/admin/organizations", json={"name": org.name}, headers=auth(admin))
    assert r.status_code == 409


def test_create_organization_needs_a_name(client, auth, admin):
    r = client.post("/admin/organizations", json={"name": ""}, headers=auth(admin))
    assert r.status_code == 422


def test_verify_creates_a_verified_membership(client, auth, admin, leader, org, db):
    r = client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify",
                    json={"position_title": "President"}, headers=auth(admin))

    assert r.status_code == 200
    body = r.json()
    assert body["verified"] is True and body["position_title"] == "President"
    assert db.get(OrganizationMember, (leader.id, org.id)).verified_by_id == admin.id


def test_verify_an_existing_join_request(client, auth, admin, leader, org, member):
    member(leader, org, position_title="Treasurer")
    r = client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify",
                    headers=auth(admin))
    assert r.status_code == 200
    assert r.json()["verified"] is True and r.json()["position_title"] == "Treasurer"


def test_verify_sets_term_end(client, auth, admin, leader, org):
    end = (dt.date.today() + dt.timedelta(days=200)).isoformat()
    r = client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify",
                    json={"term_end": end}, headers=auth(admin))
    assert r.json()["term_end"] == end


def test_verify_rejects_term_end_before_start(client, auth, admin, leader, org):
    end = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    r = client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify",
                    json={"term_end": end}, headers=auth(admin))
    assert r.status_code == 422


def test_verify_unknown_org_or_user_is_404(client, auth, admin, leader, org):
    bad_org = client.post(f"/admin/organizations/{uuid.uuid4()}/members/{leader.id}/verify",
                          headers=auth(admin))
    bad_user = client.post(f"/admin/organizations/{org.id}/members/{uuid.uuid4()}/verify",
                           headers=auth(admin))
    assert bad_org.status_code == 404 and bad_user.status_code == 404


def test_removing_unverified_member_deletes_the_request(client, auth, admin, leader, org,
                                                        member, db):
    member(leader, org)
    r = client.delete(f"/admin/organizations/{org.id}/members/{leader.id}", headers=auth(admin))

    assert r.status_code == 204
    db.expire_all()
    assert db.get(OrganizationMember, (leader.id, org.id)) is None


def test_removing_verified_member_ends_their_term(client, auth, admin, leader, org, member, db):
    member(leader, org, verified=True, verified_by=admin,
           term_start=dt.date.today() - dt.timedelta(days=30))
    r = client.delete(f"/admin/organizations/{org.id}/members/{leader.id}", headers=auth(admin))

    assert r.status_code == 204
    db.expire_all()
    m = db.get(OrganizationMember, (leader.id, org.id))
    assert m is not None and m.term_end == dt.date.today()  # history kept


def test_remove_unknown_membership_is_404(client, auth, admin, leader, org):
    r = client.delete(f"/admin/organizations/{org.id}/members/{leader.id}", headers=auth(admin))
    assert r.status_code == 404


def test_club_leaders_cannot_verify_members(client, auth, leader, org):
    r = client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify",
                    headers=auth(leader))
    assert r.status_code in DENIED
