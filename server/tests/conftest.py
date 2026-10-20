"""Shared fixtures for the API tests.

The models use Postgres-only features (ARRAY, TSTZRANGE, the double-booking
exclusion constraint), so these tests need a real Postgres database, NOT
SQLite. Point TEST_DATABASE_URL at a throwaway database, e.g.

    createdb campusreserve_test
    export TEST_DATABASE_URL=postgresql+psycopg://localhost:5432/campusreserve_test

Never point it at Supabase: every test runs inside a transaction that is
rolled back, but the tables are created there on the first run.

Run from server/:   pytest -v
"""

from __future__ import annotations

import datetime as dt
import os
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest

# Make server/ importable (the app uses bare imports like `from database import ...`).
SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

TEST_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_URL:
    pytest.exit("Set TEST_DATABASE_URL to a throwaway Postgres database (see conftest.py).",
                returncode=2)
if "test" not in TEST_URL.rsplit("/", 1)[-1] or "supabase" in TEST_URL:
    pytest.exit("TEST_DATABASE_URL must be a local database whose name contains 'test'. "
                "Refusing to run against what looks like a real database.", returncode=2)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Enum as SAEnum, create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import models  # noqa: E402,F401  (registers every table)
import routers.admin as admin_router  # noqa: E402
from authentication import create_access_token, hash_password  # noqa: E402
from database import get_db  # noqa: E402
from main import app  # noqa: E402
from models.base import Base  # noqa: E402
from models.communication import Notification  # noqa: E402
from models.organization_and_venue import Organization, OrganizationMember, Venue  # noqa: E402
from models.room import Request, RequestStatus, Room, SyncStatus  # noqa: E402
from models.user import User, UserRole  # noqa: E402
from services.room_merge import campus_now  # noqa: E402


# --------------------------------------------------------------------------- database

# Tables come from whichever Base the models actually use (it may not be
# models.base.Base).
METADATAS = []
for _model in (Base, User, Organization, OrganizationMember, Venue, Room, Request, Notification):
    if _model.metadata not in METADATAS:
        METADATAS.append(_model.metadata)


def ensure_schema(eng):
    """Create the extension, enum types and tables if they're missing. Enum types
    go first in case the models declare them with create_type=False."""
    with eng.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
        for md in METADATAS:
            for table in md.tables.values():
                for col in table.columns:
                    if isinstance(col.type, SAEnum):
                        col.type.create(conn, checkfirst=True)
        for md in METADATAS:
            md.create_all(conn)


def schema_missing(eng):
    with eng.connect() as conn:
        return conn.execute(text("SELECT to_regclass(:t)"),
                            {"t": User.__table__.name}).scalar() is None


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_URL)
    # Rebuild from the current models every run, so a table left over from an
    # older schema can't cause "column does not exist" errors. Safe: the checks
    # above guarantee this is a throwaway test database.
    with eng.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    ensure_schema(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine):
    """A session whose changes are all rolled back after the test, even the
    endpoints' own commits (they become savepoints)."""
    if schema_missing(engine):  # another test file (e.g. one that runs drop_all) removed it
        ensure_schema(engine)
    conn = engine.connect()
    outer = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        conn.close()


@pytest.fixture()
def client(db):
    def _get_db():
        yield db

    app.dependency_overrides[get_db] = _get_db
    try:
        yield TestClient(app)  # no `with`: skips startup events that might touch the real DB
    finally:
        app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- 25Live

@pytest.fixture(autouse=True)
def no_25live(monkeypatch):
    """Keep tests offline: no 25Live room loads, and a booking check that
    always reports the slot as free."""
    async def fake_load():
        return [], {}

    async def fake_check(*args, **kwargs):
        return SimpleNamespace(to_dict=lambda: {"ok": True, "can_waitlist": False,
                                                "problems": [], "warnings": []})

    monkeypatch.setattr(admin_router, "load_25live_rooms", fake_load)
    monkeypatch.setattr(admin_router, "check_booking", fake_check)


# --------------------------------------------------------------------------- factories

@pytest.fixture()
def make_user(db):
    def _make(role=UserRole.CLUB_LEADER, name=None, email=None, is_active=True):
        tag = uuid.uuid4().hex[:8]
        user = User(email=email or f"{role.value}-{tag}@example.com", name=name or f"User {tag}",
                    role=role, password_hash=hash_password("testpass123"), is_active=is_active)
        db.add(user)
        db.flush()
        return user
    return _make


@pytest.fixture()
def auth():
    def _headers(user):
        return {"Authorization": f"Bearer {create_access_token(user)}"}
    return _headers


@pytest.fixture()
def admin(make_user):
    return make_user(UserRole.ADMIN, name="Ada Admin")


@pytest.fixture()
def leader(make_user):
    return make_user(UserRole.CLUB_LEADER, name="Lee Leader")


@pytest.fixture()
def host(make_user):
    return make_user(UserRole.VENUE_HOST, name="Hal Host")


@pytest.fixture()
def org(db):
    o = Organization(name=f"Test Club {uuid.uuid4().hex[:6]}", description="For tests")
    db.add(o)
    db.flush()
    return o


@pytest.fixture()
def venue(db):
    v = Venue(name=f"Test Hall {uuid.uuid4().hex[:6]}")
    db.add(v)
    db.flush()
    return v


@pytest.fixture()
def make_room(db, venue):
    def _make(name=None, in_venue=None, **kw):
        r = Room(venue_id=(in_venue or venue).id, name=name or f"Room {uuid.uuid4().hex[:4]}",
                 capacity=kw.pop("capacity", 30), club_bookable=kw.pop("club_bookable", True),
                 is_active=kw.pop("is_active", True), **kw)
        db.add(r)
        db.flush()
        return r
    return _make


@pytest.fixture()
def room(make_room):
    return make_room(name="Room 101")


@pytest.fixture()
def make_request(db, room, org, leader):
    """A request `days` from now, `hours` long. Each test should use different
    days for overlapping approved requests (the exclusion constraint)."""
    def _make(days=7, hours=2, status=RequestStatus.PENDING, sync=SyncStatus.NOT_SYNCED,
              in_room=None, for_org=None, start_hour=18, requester=None, **kw):
        start = (campus_now() + dt.timedelta(days=days)).replace(
            hour=start_hour, minute=0, second=0, microsecond=0, tzinfo=None)
        end = start + dt.timedelta(hours=hours)
        if status in (RequestStatus.APPROVED, RequestStatus.DENIED):
            # Decided requests need a decision (a check constraint requires a
            # reason for denials).
            kw.setdefault("decided_at", dt.datetime.utcnow())
            kw.setdefault("decision_reason", "Decided in a test")
        req = Request(room_id=(in_room or room).id, organization_id=(for_org or org).id,
                      requester_id=(requester or leader).id, event_name=kw.pop("event_name", "Test Event"),
                      start_time=start, end_time=end, setup_start=start, cleanup_end=end,
                      status=status, sync_status=sync, expected_attendance=20, **kw)
        db.add(req)
        db.flush()
        return req
    return _make


@pytest.fixture()
def member(db):
    def _make(user, organization, verified=False, verified_by=None, **kw):
        m = OrganizationMember(user_id=user.id, organization_id=organization.id,
                               term_start=kw.pop("term_start", dt.date.today()),
                               verified_at=dt.datetime.utcnow() if verified else None,
                               verified_by_id=verified_by.id if verified_by else None, **kw)
        db.add(m)
        db.flush()
        return m
    return _make
