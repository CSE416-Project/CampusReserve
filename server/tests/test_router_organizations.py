"""Tests for routers/organizations.py: list, detail and joining.

Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid

import pytest

from models.communication import NotificationType
from models.organization_and_venue import Organization, OrganizationMember

TODAY = dt.date.today()


@pytest.fixture()
def make_org(db):
    def _make(name, description=None):
        o = Organization(name=name, description=description)
        db.add(o)
        db.flush()
        return o
    return _make


def expired(member, user, org, admin):
    """A verified membership whose term ended yesterday."""
    return member(user, org, verified=True, verified_by=admin,
                  term_start=TODAY - dt.timedelta(days=365),
                  term_end=TODAY - dt.timedelta(days=1))


# =============================================================================
# Login required
# =============================================================================

@pytest.mark.parametrize("method,path", [
    ("get", "/organizations"),
    ("get", f"/organizations/{uuid.uuid4()}"),
    ("post", f"/organizations/{uuid.uuid4()}/join"),
])
def test_organization_endpoints_need_a_token(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# =============================================================================
# GET /organizations
# =============================================================================

def test_list_is_sorted_by_name(client, auth, leader, make_org):
    make_org("Zebra Club")
    make_org("Astronomy Club")
    make_org("Math Club")

    names = [o["name"] for o in client.get("/organizations", headers=auth(leader)).json()]

    assert names == ["Astronomy Club", "Math Club", "Zebra Club"]


def test_list_search_is_case_insensitive(client, auth, leader, make_org):
    make_org("Chess Club")
    make_org("Women in Computer Science")

    found = client.get("/organizations", params={"search": "CHESS"}, headers=auth(leader)).json()

    assert [o["name"] for o in found] == ["Chess Club"]


def test_list_search_with_no_match_is_empty(client, auth, leader, make_org):
    make_org("Chess Club")
    r = client.get("/organizations", params={"search": "nonexistent"}, headers=auth(leader))
    assert r.status_code == 200 and r.json() == []


def test_list_counts_only_verified_members(client, auth, admin, leader, make_user, make_org,
                                           member):
    club = make_org("Count Club", "We count")
    member(leader, club, verified=True, verified_by=admin)
    member(make_user(), club, verified=True, verified_by=admin)
    member(make_user(), club)  # waiting for verification
    make_org("Empty Club")

    orgs = {o["name"]: o for o in client.get("/organizations", headers=auth(leader)).json()}

    assert orgs["Count Club"]["verified_member_count"] == 2
    assert orgs["Count Club"]["description"] == "We count"
    assert orgs["Empty Club"]["verified_member_count"] == 0


def test_list_never_includes_member_details(client, auth, admin, leader, org, member):
    member(leader, org, verified=True, verified_by=admin)
    for o in client.get("/organizations", headers=auth(admin)).json():
        assert o["members"] is None


@pytest.mark.xfail(reason="The count includes verified members whose term has ended, so "
                          "graduated E-board members keep counting.", strict=False)
def test_list_count_leaves_out_ended_terms(client, auth, admin, leader, make_user, org,
                                          member):
    member(leader, org, verified=True, verified_by=admin)
    expired(member, make_user(), org, admin)

    o = next(o for o in client.get("/organizations", headers=auth(leader)).json()
             if o["id"] == str(org.id))

    assert o["verified_member_count"] == 1


# =============================================================================
# GET /organizations/{id}
# =============================================================================

def test_detail_shows_the_organization(client, auth, leader, make_org):
    club = make_org("Detail Club", "Details here")

    r = client.get(f"/organizations/{club.id}", headers=auth(leader))

    assert r.status_code == 200
    body = r.json()
    assert (body["id"], body["name"], body["description"]) == \
        (str(club.id), "Detail Club", "Details here")


def test_detail_unknown_organization_is_404(client, auth, leader):
    assert client.get(f"/organizations/{uuid.uuid4()}", headers=auth(leader)).status_code == 404


def test_detail_malformed_id_is_rejected(client, auth, leader):
    assert client.get("/organizations/not-a-uuid", headers=auth(leader)).status_code in (404, 422)


def test_detail_counts_verified_members(client, auth, admin, leader, make_user, org, member):
    member(leader, org, verified=True, verified_by=admin)
    member(make_user(), org)
    body = client.get(f"/organizations/{org.id}", headers=auth(leader)).json()
    assert body["verified_member_count"] == 1


def test_admins_see_the_member_list(client, auth, admin, leader, make_user, org, member):
    member(leader, org, verified=True, verified_by=admin, position_title="President")
    member(make_user(name="Wanda Waiting"), org)

    members = client.get(f"/organizations/{org.id}", headers=auth(admin)).json()["members"]

    by_name = {m["user_name"]: m for m in members}
    assert by_name[leader.name]["verified"] is True
    assert by_name[leader.name]["position_title"] == "President"
    assert by_name["Wanda Waiting"]["verified"] is False


def test_verified_members_see_the_member_list(client, auth, admin, leader, org, member):
    member(leader, org, verified=True, verified_by=admin)
    body = client.get(f"/organizations/{org.id}", headers=auth(leader)).json()
    assert [m["user_id"] for m in body["members"]] == [str(leader.id)]


def test_non_members_dont_see_the_member_list(client, auth, admin, leader, make_user, org,
                                              member):
    member(make_user(), org, verified=True, verified_by=admin)
    body = client.get(f"/organizations/{org.id}", headers=auth(leader)).json()
    assert body["members"] is None and body["verified_member_count"] == 1


def test_unverified_members_dont_see_the_member_list(client, auth, leader, org, member):
    member(leader, org)
    assert client.get(f"/organizations/{org.id}", headers=auth(leader)).json()["members"] is None


def test_members_whose_term_ended_dont_see_the_member_list(client, auth, admin, leader, org,
                                                           member):
    expired(member, leader, org, admin)
    assert client.get(f"/organizations/{org.id}", headers=auth(leader)).json()["members"] is None


# =============================================================================
# POST /organizations/{id}/join
# =============================================================================

def test_join_creates_an_unverified_membership(client, auth, leader, org, db):
    r = client.post(f"/organizations/{org.id}/join", json={"position_title": "Treasurer"},
                    headers=auth(leader))

    assert r.status_code == 201
    body = r.json()
    assert body["organization_id"] == str(org.id) and body["user_id"] == str(leader.id)
    assert body["verified"] is False and body["verified_at"] is None
    assert body["position_title"] == "Treasurer"
    assert body["term_start"] == TODAY.isoformat() and body["term_end"] is None
    assert db.get(OrganizationMember, (leader.id, org.id)) is not None


def test_join_without_a_body(client, auth, leader, org):
    r = client.post(f"/organizations/{org.id}/join", headers=auth(leader))
    assert r.status_code == 201 and r.json()["position_title"] is None


def test_join_position_title_is_limited(client, auth, leader, org):
    r = client.post(f"/organizations/{org.id}/join", json={"position_title": "x" * 101},
                    headers=auth(leader))
    assert r.status_code == 422


def test_join_unknown_organization_is_404(client, auth, leader):
    r = client.post(f"/organizations/{uuid.uuid4()}/join", headers=auth(leader))
    assert r.status_code == 404


def test_join_twice_while_waiting_is_409(client, auth, leader, org):
    client.post(f"/organizations/{org.id}/join", headers=auth(leader))
    assert client.post(f"/organizations/{org.id}/join", headers=auth(leader)).status_code == 409


def test_join_when_already_verified_is_409(client, auth, admin, leader, org, member):
    member(leader, org, verified=True, verified_by=admin)
    assert client.post(f"/organizations/{org.id}/join", headers=auth(leader)).status_code == 409


def test_join_while_term_runs_until_today_is_409(client, auth, admin, leader, org, member):
    member(leader, org, verified=True, verified_by=admin,
           term_start=TODAY - dt.timedelta(days=30), term_end=TODAY)
    assert client.post(f"/organizations/{org.id}/join", headers=auth(leader)).status_code == 409


def test_rejoin_after_term_ended_starts_fresh(client, auth, admin, leader, org, member, db):
    expired(member, leader, org, admin)

    r = client.post(f"/organizations/{org.id}/join", json={"position_title": "Secretary"},
                    headers=auth(leader))

    assert r.status_code == 201
    body = r.json()
    assert body["verified"] is False  # needs verifying again
    assert body["term_start"] == TODAY.isoformat() and body["term_end"] is None
    db.expire_all()
    m = db.get(OrganizationMember, (leader.id, org.id))
    assert m.verified_at is None and m.verified_by_id is None


def test_join_notifies_admins(client, auth, admin, leader, org):
    client.post(f"/organizations/{org.id}/join", headers=auth(leader))

    items = client.get("/notifications", headers=auth(admin)).json()

    assert any(n["type"] == NotificationType.MEMBERSHIP_REQUESTED.value
               and leader.name in n["message"] and org.name in n["message"] for n in items)


def test_join_doesnt_notify_the_requester(client, auth, admin, leader, org):
    client.post(f"/organizations/{org.id}/join", headers=auth(leader))
    assert client.get("/notifications", headers=auth(leader)).json() == []


def test_joining_doesnt_let_you_see_the_member_list(client, auth, leader, org):
    client.post(f"/organizations/{org.id}/join", headers=auth(leader))
    assert client.get(f"/organizations/{org.id}", headers=auth(leader)).json()["members"] is None


def test_join_then_admin_verifies(client, auth, admin, leader, org):
    """End to end: join, get verified, then see the member list."""
    client.post(f"/organizations/{org.id}/join", headers=auth(leader))
    client.post(f"/admin/organizations/{org.id}/members/{leader.id}/verify", headers=auth(admin))

    body = client.get(f"/organizations/{org.id}", headers=auth(leader)).json()

    assert body["verified_member_count"] == 1
    assert body["members"][0]["verified"] is True