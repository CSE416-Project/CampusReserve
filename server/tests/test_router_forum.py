"""Tests for routers/forum.py: posts and replies. Uses the fixtures in conftest.py."""

from __future__ import annotations

import datetime as dt
import uuid

import pytest

from models.communication import ForumCategory, ForumPost
from models.user import UserRole


@pytest.fixture()
def post(db):
    """Make a top-level post (and optional replies) with explicit timestamps."""
    def _make(author, title="Need a projector", body="Anyone have one?", category=ForumCategory.GENERAL,
              org=None, minutes=0):
        p = ForumPost(author_id=author.id, organization_id=org.id if org else None, title=title, body=body,
                      category=category, created_at=dt.datetime(2030, 1, 1) + dt.timedelta(minutes=minutes))
        db.add(p)
        db.flush()
        return p
    return _make


def reply_to(db, parent, author, body="me too", minutes=1):
    r = ForumPost(author_id=author.id, parent_id=parent.id, body=body, category=parent.category,
                  created_at=parent.created_at + dt.timedelta(minutes=minutes))
    db.add(r)
    db.flush()
    return r


@pytest.mark.parametrize("method,path", [("get", "/forum"), ("post", "/forum"),
                                         ("post", f"/forum/{uuid.uuid4()}/replies")])
def test_forum_needs_a_token(client, method, path):
    assert getattr(client, method)(path).status_code == 401


# --- reading -----------------------------------------------------------------

def test_list_is_newest_first_with_replies_oldest_first(client, auth, db, leader, host, post):
    old = post(leader, title="Old", minutes=0)
    new = post(host, title="New", minutes=10)
    reply_to(db, old, host, "second", minutes=5)
    reply_to(db, old, leader, "first", minutes=2)

    r = client.get("/forum", headers=auth(leader)).json()

    assert [p["title"] for p in r] == ["New", "Old"]
    assert [x["body"] for x in r[1]["replies"]] == ["first", "second"]
    assert r[1]["replies"][0]["author_name"] == "Lee Leader" and r[0]["author_name"] == "Hal Host"
    assert r[0]["replies"] == [] and new.id  # replies never appear at top level


def test_list_filters_by_category(client, auth, leader, post):
    post(leader, title="Share", category=ForumCategory.RESOURCE_SHARE)
    post(leader, title="Collab", category=ForumCategory.COLLABORATION)

    r = client.get("/forum", params={"category": "resource_share"}, headers=auth(leader)).json()

    assert [p["title"] for p in r] == ["Share"] and r[0]["category"] == "resource_share"
    assert client.get("/forum", params={"category": "nope"}, headers=auth(leader)).status_code == 422


def test_venue_hosts_can_read(client, auth, host, leader, post):
    post(leader)
    assert len(client.get("/forum", headers=auth(host)).json()) == 1


# --- posting -----------------------------------------------------------------

def test_create_a_post(client, auth, leader):
    r = client.post("/forum", json={"title": "  Co-host a mixer?  ", "body": " Looking for a partner club ",
                                    "category": "collaboration"}, headers=auth(leader))

    assert r.status_code == 201
    b = r.json()
    assert (b["title"], b["body"], b["category"]) == ("Co-host a mixer?", "Looking for a partner club", "collaboration")
    assert b["author_name"] == "Lee Leader" and b["organization_id"] is None and b["replies"] == []
    assert [p["id"] for p in client.get("/forum", headers=auth(leader)).json()] == [b["id"]]


def test_category_defaults_to_general(client, auth, leader):
    r = client.post("/forum", json={"title": "Hi", "body": "there"}, headers=auth(leader))
    assert r.json()["category"] == "general"


def test_post_as_one_of_my_organizations(client, auth, leader, org, member):
    member(leader, org, verified=True)

    r = client.post("/forum", json={"title": "Hi", "body": "there", "organization_id": str(org.id)},
                    headers=auth(leader))

    assert r.status_code == 201 and r.json()["organization_name"] == org.name


def test_cannot_post_as_an_organization_you_are_not_verified_in(client, auth, leader, org, member):
    r = client.post("/forum", json={"title": "Hi", "body": "x", "organization_id": str(org.id)}, headers=auth(leader))
    assert r.status_code == 403
    member(leader, org, verified=False)
    r = client.post("/forum", json={"title": "Hi", "body": "x", "organization_id": str(org.id)}, headers=auth(leader))
    assert r.status_code == 403
    r = client.post("/forum", json={"title": "Hi", "body": "x", "organization_id": str(uuid.uuid4())}, headers=auth(leader))
    assert r.status_code == 404


def test_admin_can_post_as_any_organization(client, auth, admin, org):
    r = client.post("/forum", json={"title": "Notice", "body": "x", "organization_id": str(org.id)}, headers=auth(admin))
    assert r.status_code == 201


def test_venue_hosts_cannot_post(client, auth, host, post, leader):
    assert client.post("/forum", json={"title": "a", "body": "b"}, headers=auth(host)).status_code == 403
    p = post(leader)
    assert client.post(f"/forum/{p.id}/replies", json={"body": "b"}, headers=auth(host)).status_code == 403


@pytest.mark.parametrize("payload", [{"title": "", "body": "x"}, {"title": "  ", "body": "x"},
                                     {"title": "t", "body": ""}, {"title": "t", "body": " "},
                                     {"title": "t" * 256, "body": "x"}, {"title": "t", "body": "x" * 10001},
                                     {"title": "t", "body": "x", "category": "spam"}, {"body": "x"}])
def test_bad_posts_are_rejected(client, auth, leader, payload):
    assert client.post("/forum", json=payload, headers=auth(leader)).status_code == 422


# --- replying ----------------------------------------------------------------

def test_reply_to_a_post(client, auth, leader, host, post):
    p = post(host)

    r = client.post(f"/forum/{p.id}/replies", json={"body": "  I do!  "}, headers=auth(leader))

    assert r.status_code == 201
    assert r.json()["body"] == "I do!" and r.json()["author_name"] == "Lee Leader"
    shown = client.get("/forum", headers=auth(host)).json()[0]
    assert [x["body"] for x in shown["replies"]] == ["I do!"]


def test_reply_as_an_organization(client, auth, leader, post, org, member):
    member(leader, org, verified=True)
    p = post(leader)

    r = client.post(f"/forum/{p.id}/replies", json={"body": "hi", "organization_id": str(org.id)}, headers=auth(leader))

    assert r.status_code == 201 and r.json()["organization_name"] == org.name


def test_cannot_reply_as_an_organization_you_are_not_in(client, auth, leader, post, org):
    p = post(leader)
    r = client.post(f"/forum/{p.id}/replies", json={"body": "hi", "organization_id": str(org.id)}, headers=auth(leader))
    assert r.status_code == 403


def test_cannot_reply_to_a_reply_or_a_missing_post(client, auth, db, leader, post):
    p = post(leader)
    r1 = reply_to(db, p, leader)
    for pid in (str(r1.id), str(uuid.uuid4()), "nope"):
        assert client.post(f"/forum/{pid}/replies", json={"body": "x"}, headers=auth(leader)).status_code == 404


@pytest.mark.parametrize("text", ["", "   ", "x" * 5001], ids=["empty", "blank", "too-long"])
def test_bad_replies_are_rejected(client, auth, leader, post, text):
    p = post(leader)
    assert client.post(f"/forum/{p.id}/replies", json={"body": text}, headers=auth(leader)).status_code == 422


def test_replies_inherit_the_category(client, auth, db, leader, post):
    p = post(leader, category=ForumCategory.RESOURCE_SHARE)
    client.post(f"/forum/{p.id}/replies", json={"body": "x"}, headers=auth(leader))
    assert db.query(ForumPost).filter(ForumPost.parent_id == p.id).one().category == ForumCategory.RESOURCE_SHARE
