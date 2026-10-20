"""Tests for routers/rooms.py: list, detail, availability, search, buildings,
map, photos, 25Live details and schedules.

25Live is replaced by the `live` fixture (rooms, bookings, details, photos,
and failures are set per test). The merging, availability and schedule logic
in services.room_merge is real. Uses the fixtures in conftest.py.
"""

from __future__ import annotations

import datetime as dt
import uuid
from types import SimpleNamespace

import pytest

from models.room import RequestStatus, RoomClosure, SyncStatus
from services import live25, room_features
from services.room_merge import campus_now

DAYS_AHEAD = 10  # the date the availability tests look at


# =============================================================================
# Fake 25Live
# =============================================================================

@pytest.fixture(autouse=True)
def live(monkeypatch):
    """A fake 25Live. Tests add rooms with live.space(...), bookings with
    live.booking(...), and make calls fail with live.down / live.failing."""
    state = SimpleNamespace(spaces=[], info={}, bookings={}, details={}, images={},
                            down=False, info_down=False, failing=set(), booking_calls=[],
                            cache={"ready": True})

    def space(id_="1810", name="SAC 302", building="Student Activities Center", capacity=40,
              features=(), categories=(), room_type=None, lat=None, lon=None, photo_id=None):
        state.spaces.append({"id": id_, "name": name, "short_name": name.upper(),
                             "building": building, "capacity": capacity})
        state.info[id_] = {"features": list(features), "categories": list(categories),
                           "room_type": room_type}
        state.details[id_] = {"id": id_, "name": name, "short_name": name.upper(),
                              "capacity": capacity, "building": building,
                              "latitude": lat, "longitude": lon, "layout_photo_id": photo_id}
        return id_

    def booking(id_, start, end, name="25Live Event", kind="event", status="Confirmed"):
        state.bookings.setdefault(id_, []).append(
            {"source": "25live", "kind": kind, "status": status, "name": name,
             "start": start, "end": end, "event_start": start, "event_end": end,
             "expected_headcount": None})

    def check():
        if state.down:
            raise live25.Live25Error("25Live is down")

    async def list_spaces():
        check()
        return [dict(s) for s in state.spaces]

    async def list_location_info():
        if state.info_down:
            raise live25.Live25Error("features unavailable")
        return state.info

    async def get_bookings(space_id, start, end):
        check()
        state.booking_calls.append((space_id, start, end))
        if space_id in state.failing:
            raise live25.Live25Error(f"room {space_id} failed")
        return list(state.bookings.get(space_id, []))

    async def get_space_detail(space_id):
        check()
        return state.details.get(space_id)

    async def get_space_details(space_ids):
        return {i: state.details[i] for i in space_ids if i in state.details}

    async def get_image(photo_id):
        check()
        return state.images[photo_id]

    for name, fn in [("list_spaces", list_spaces), ("list_location_info", list_location_info),
                     ("get_bookings", get_bookings), ("get_space_detail", get_space_detail),
                     ("get_space_details", get_space_details), ("get_image", get_image),
                     ("cache_status", lambda: state.cache)]:
        monkeypatch.setattr(live25, name, fn)
    state.space, state.booking = space, booking
    return state


# =============================================================================
# Helpers
# =============================================================================

def target_day():
    return (campus_now() + dt.timedelta(days=DAYS_AHEAD)).date()


def at(hour, day=None):
    return dt.datetime.combine(day or target_day(), dt.time(hour))


def window(start="6:00 PM", end="8:00 PM", day=None, **extra):
    d = day or target_day()
    return {"year": d.year, "month": d.month, "day": d.day,
            "start_time": start, "end_time": end, **extra}


def by_id(resp):
    return {r["id"]: r for r in resp.json()}


@pytest.fixture()
def closure(db, admin):
    def _make(room=None, venue=None, start=None, end=None, reason="Maintenance"):
        c = RoomClosure(room_id=room.id if room else None, venue_id=venue.id if venue else None,
                        closed_from=start or at(0), closed_until=end or at(23),
                        reason=reason, created_by_id=admin.id)
        db.add(c)
        db.flush()
        return c
    return _make


# =============================================================================
# Login required
# =============================================================================

@pytest.mark.parametrize("path", ["/rooms", "/rooms/1810", "/rooms/features",
                                  "/rooms/cache-status", "/rooms/buildings",
                                  "/rooms/1810/schedule", "/rooms/1810/details"])
def test_room_endpoints_need_a_token(client, path):
    assert client.get(path).status_code == 401


# =============================================================================
# GET /rooms
# =============================================================================

def test_lists_25live_rooms(client, auth, leader, live):
    live.space("1810", "SAC 302", capacity=40)

    rooms = by_id(client.get("/rooms", headers=auth(leader)))

    assert rooms["1810"]["name"] == "SAC 302"
    assert rooms["1810"]["capacity"] == 40
    assert rooms["1810"]["source"] == "25live"
    assert rooms["1810"]["db_id"] is None


def test_merges_25live_rooms_with_ours(client, auth, leader, live, make_room):
    live.space("1810", "SAC 302")
    ours = make_room(name="SAC 302", external_ref="1810", club_bookable=False)

    room = by_id(client.get("/rooms", headers=auth(leader)))["1810"]

    assert room["source"] == "both"
    assert room["db_id"] == str(ours.id)
    assert room["club_bookable"] is False


def test_lists_rooms_only_in_our_database(client, auth, leader, room):
    rooms = by_id(client.get("/rooms", headers=auth(leader)))
    assert rooms[str(room.id)]["source"] == "campusreserve"


def test_adds_25live_features(client, auth, leader, live):
    live.space("1810", features=["Food Permitted"], categories=["Type - Meeting Room"])
    room = by_id(client.get("/rooms", headers=auth(leader)))["1810"]
    assert room["live25_features"] == ["Food Permitted"]
    assert room["live25_categories"] == ["Type - Meeting Room"]


def test_counts_upcoming_pending_and_waitlisted(client, auth, leader, room, make_request):
    make_request(days=5)
    make_request(days=6)
    make_request(days=7, status=RequestStatus.WAITLISTED, waitlist_position=1)
    make_request(days=-5)  # past: not counted

    r = by_id(client.get("/rooms", headers=auth(leader)))[str(room.id)]

    assert (r["pending_requests"], r["waitlist_count"]) == (2, 1)


def test_filters_by_building_and_capacity(client, auth, leader, live):
    live.space("1", "Small", building="Student Activities Center", capacity=10)
    live.space("2", "Big", building="Student Activities Center", capacity=100)
    live.space("3", "Elsewhere", building="Library", capacity=100)

    r = client.get("/rooms", params={"building": "student act", "min_capacity": 50},
                   headers=auth(leader))

    assert list(by_id(r)) == ["2"]


def test_filters_club_bookable_and_hides_inactive(client, auth, leader, make_room):
    bookable = make_room(name="Open Room")
    closed = make_room(name="Staff Only", club_bookable=False)
    retired = make_room(name="Retired", is_active=False)

    default = by_id(client.get("/rooms", headers=auth(leader)))
    bookable_only = by_id(client.get("/rooms", params={"club_bookable_only": True},
                                     headers=auth(leader)))
    everything = by_id(client.get("/rooms", params={"include_inactive": True},
                                  headers=auth(leader)))

    assert str(retired.id) not in default and str(retired.id) in everything
    assert str(bookable.id) in bookable_only and str(closed.id) not in bookable_only


def test_list_is_502_when_25live_is_down(client, auth, leader, live):
    live.down = True
    assert client.get("/rooms", headers=auth(leader)).status_code == 502


def test_list_still_works_without_25live_features(client, auth, leader, live):
    live.space("1810", features=["Food Permitted"])
    live.info_down = True
    r = client.get("/rooms", headers=auth(leader))
    assert r.status_code == 200 and by_id(r)["1810"]["live25_features"] == []


# =============================================================================
# GET /rooms/{id}
# =============================================================================

def test_get_a_25live_room(client, auth, leader, live):
    live.space("1810", "SAC 302")
    r = client.get("/rooms/1810", headers=auth(leader))
    assert r.status_code == 200 and r.json()["name"] == "SAC 302"


def test_get_a_local_room_by_uuid(client, auth, leader, room):
    r = client.get(f"/rooms/{room.id}", headers=auth(leader))
    assert r.status_code == 200 and r.json()["name"] == room.name


@pytest.mark.parametrize("room_id", ["999999", str(uuid.uuid4())])
def test_get_unknown_room_is_404(client, auth, leader, room_id):
    assert client.get(f"/rooms/{room_id}", headers=auth(leader)).status_code == 404


# =============================================================================
# GET /rooms/available
# =============================================================================

def test_free_25live_room_is_available(client, auth, leader, live):
    live.space("1810")
    r = client.get("/rooms/available", params=window(), headers=auth(leader))
    assert r.status_code == 200 and "1810" in by_id(r)


def test_room_booked_in_25live_is_not_available(client, auth, leader, live):
    live.space("1810")
    live.space("1811", "SAC 303")
    live.booking("1810", at(17), at(19))

    rooms = by_id(client.get("/rooms/available", params=window(), headers=auth(leader)))

    assert "1810" not in rooms and "1811" in rooms


def test_booking_that_ends_at_the_start_doesnt_block(client, auth, leader, live):
    live.space("1810")
    live.booking("1810", at(16), at(18))
    assert "1810" in by_id(client.get("/rooms/available", params=window(),
                                      headers=auth(leader)))


def test_local_room_is_available_when_nothing_blocks_it(client, auth, leader, room):
    rooms = by_id(client.get("/rooms/available", params=window(), headers=auth(leader)))
    assert rooms[str(room.id)]["overlapping_pending_requests"] == 0


def test_pending_requests_dont_block_but_are_counted(client, auth, leader, room, make_request):
    make_request(days=DAYS_AHEAD, start_hour=18)
    rooms = by_id(client.get("/rooms/available", params=window(), headers=auth(leader)))
    assert rooms[str(room.id)]["overlapping_pending_requests"] == 1


def test_approved_but_unsynced_request_blocks(client, auth, leader, room, make_request):
    make_request(days=DAYS_AHEAD, start_hour=18, status=RequestStatus.APPROVED)
    assert str(room.id) not in by_id(client.get("/rooms/available", params=window(),
                                                headers=auth(leader)))


def test_approved_and_synced_request_is_left_to_25live(client, auth, leader, room,
                                                      make_request):
    """Once it's in 25Live, 25Live's schedule decides (this local room has none)."""
    make_request(days=DAYS_AHEAD, start_hour=18, status=RequestStatus.APPROVED,
                 sync=SyncStatus.SYNCED, external_booking_ref="EV-1")
    assert str(room.id) in by_id(client.get("/rooms/available", params=window(),
                                            headers=auth(leader)))


def test_room_closure_blocks(client, auth, leader, room, closure):
    closure(room=room)
    assert str(room.id) not in by_id(client.get("/rooms/available", params=window(),
                                                headers=auth(leader)))


def test_venue_closure_blocks_every_room_in_it(client, auth, leader, venue, make_room, closure):
    a, b = make_room(name="A"), make_room(name="B")
    closure(venue=venue)
    rooms = by_id(client.get("/rooms/available", params=window(), headers=auth(leader)))
    assert str(a.id) not in rooms and str(b.id) not in rooms


def test_closure_outside_the_window_doesnt_block(client, auth, leader, room, closure):
    closure(room=room, start=at(8), end=at(12))
    assert str(room.id) in by_id(client.get("/rooms/available", params=window(),
                                            headers=auth(leader)))


def test_room_not_open_for_booking_yet_is_excluded(client, auth, leader, make_room):
    early = make_room(name="Opens Late", booking_opens_days_ahead=DAYS_AHEAD - 5)
    assert str(early.id) not in by_id(client.get("/rooms/available", params=window(),
                                                 headers=auth(leader)))


def test_room_whose_check_failed_is_left_out(client, auth, leader, live):
    live.space("1810")
    live.space("1811", "SAC 303")
    live.failing.add("1810")
    rooms = by_id(client.get("/rooms/available", params=window(), headers=auth(leader)))
    assert "1810" not in rooms and "1811" in rooms


def test_available_is_502_when_every_check_fails(client, auth, leader, live):
    live.space("1810")
    live.failing.add("1810")
    assert client.get("/rooms/available", params=window(),
                      headers=auth(leader)).status_code == 502


def test_available_rejects_past_windows(client, auth, leader):
    past = (campus_now() - dt.timedelta(days=2)).date()
    r = client.get("/rooms/available", params=window(day=past), headers=auth(leader))
    assert r.status_code == 400


def test_available_rejects_impossible_dates(client, auth, leader):
    params = {**window(), "month": 2, "day": 30, "year": target_day().year + 1}
    assert client.get("/rooms/available", params=params, headers=auth(leader)).status_code == 400


def test_available_rejects_unreadable_times(client, auth, leader):
    r = client.get("/rooms/available", params=window(start="whenever"), headers=auth(leader))
    assert r.status_code == 400


@pytest.mark.parametrize("bad", [{"month": 13}, {"day": 0}, {"year": 1999}])
def test_available_validates_the_date_fields(client, auth, leader, bad):
    assert client.get("/rooms/available", params={**window(), **bad},
                      headers=auth(leader)).status_code == 422


def test_available_filters_like_the_list(client, auth, leader, live):
    live.space("1", "Small", capacity=10)
    live.space("2", "Big", capacity=100)
    r = client.get("/rooms/available", params=window(min_capacity=50), headers=auth(leader))
    assert list(by_id(r)) == ["2"]


def test_available_only_asks_25live_about_the_window(client, auth, leader, live):
    live.space("1810")
    client.get("/rooms/available", params=window(), headers=auth(leader))
    assert live.booking_calls == [("1810", target_day(), target_day())]


# =============================================================================
# GET /rooms/search
# =============================================================================

def test_search_by_attendance_fits_and_sorts_smallest_first(client, auth, leader, live):
    live.space("1", "Tiny", capacity=10)
    live.space("2", "Huge", capacity=200)
    live.space("3", "Medium", capacity=50)

    r = client.get("/rooms/search", params=window(attendance=30), headers=auth(leader))

    assert [x["name"] for x in r.json()] == ["Medium", "Huge"]


def test_search_max_capacity(client, auth, leader, live):
    live.space("1", "Small", capacity=10)
    live.space("2", "Big", capacity=200)
    r = client.get("/rooms/search", params=window(max_capacity=50), headers=auth(leader))
    assert list(by_id(r)) == ["1"]


def test_search_yes_no_filters(client, auth, leader, make_room):
    if "food_allowed" not in room_features.FEATURES:
        pytest.skip("No food_allowed tag in room_features.FEATURES")
    food = make_room(name="Kitchen Lounge", features=["food_allowed"])
    plain = make_room(name="Plain Room")

    yes = by_id(client.get("/rooms/search", params=window(food_allowed=True),
                           headers=auth(leader)))
    no = by_id(client.get("/rooms/search", params=window(food_allowed=False),
                          headers=auth(leader)))

    assert str(food.id) in yes and str(plain.id) not in yes
    assert str(plain.id) in no and str(food.id) not in no


def test_search_returns_derived_tags(client, auth, leader, make_room):
    tag = sorted(room_features.FEATURES)[0]
    tagged = make_room(name="Tagged", features=[tag])
    room = by_id(client.get("/rooms/search", params=window(), headers=auth(leader)))[str(tagged.id)]
    assert tag in room["features"]


def test_search_still_checks_availability(client, auth, leader, live):
    live.space("1810", capacity=40)
    live.booking("1810", at(18), at(19))
    assert client.get("/rooms/search", params=window(attendance=10),
                      headers=auth(leader)).json() == []


@pytest.mark.parametrize("bad", [{"attendance": 0}, {"min_capacity": -1},
                                 {"setting": "underwater"}])
def test_search_validates_filters(client, auth, leader, bad):
    assert client.get("/rooms/search", params={**window(), **bad},
                      headers=auth(leader)).status_code == 422


# =============================================================================
# GET /rooms/cache-status and /rooms/features
# =============================================================================

def test_cache_status(client, auth, leader, live):
    live.cache = {"ready": False, "rooms_cached": 3}
    assert client.get("/rooms/cache-status", headers=auth(leader)).json() == \
        {"ready": False, "rooms_cached": 3}


def test_features_lists_every_tag(client, auth, leader):
    assert client.get("/rooms/features", headers=auth(leader)).json() == \
        dict(room_features.FEATURES)


# =============================================================================
# GET /rooms/buildings and /rooms/map
# =============================================================================

def test_buildings_group_active_rooms(client, auth, leader, live, make_room):
    live.space("1", "A", building="Library")
    live.space("2", "B", building="Library")
    live.space("3", "C", building="Union")
    make_room(name="Local Room")
    make_room(name="Retired", is_active=False)

    buildings = {b["name"]: b for b in client.get("/rooms/buildings", headers=auth(leader)).json()}

    assert buildings["Library"]["room_count"] == 2
    assert buildings["Union"]["room_count"] == 1
    assert buildings["Other locations"]["room_count"] == 1  # local room, no building
    assert list(buildings) == sorted(buildings)


def test_buildings_with_locations(client, auth, leader, live):
    live.space("1", "A", building="Library", lat=40.91, lon=-73.12)

    b = client.get("/rooms/buildings", params={"include_location": True},
                   headers=auth(leader)).json()[0]

    assert (b["latitude"], b["longitude"]) == (40.91, -73.12)


def test_buildings_without_locations_by_default(client, auth, leader, live):
    live.space("1", "A", building="Library", lat=40.91, lon=-73.12)
    b = client.get("/rooms/buildings", headers=auth(leader)).json()[0]
    assert b["latitude"] is None


def test_map_lists_a_buildings_rooms_with_coordinates(client, auth, leader, live):
    live.space("1", "A", building="Library", lat=40.91, lon=-73.12)
    live.space("2", "B", building="Union", lat=40.92, lon=-73.13)

    rooms = client.get("/rooms/map", params={"building": "libr"}, headers=auth(leader)).json()

    assert [(r["id"], r["latitude"], r["longitude"]) for r in rooms] == [("1", 40.91, -73.12)]


def test_map_needs_a_building(client, auth, leader):
    assert client.get("/rooms/map", headers=auth(leader)).status_code == 422


# =============================================================================
# GET /rooms/{id}/photo and /rooms/{id}/details
# =============================================================================

def test_photo_is_served_with_caching(client, auth, leader, live):
    live.space("1810", photo_id=55)
    live.images[55] = (b"\x89PNG fake", "image/png")

    r = client.get("/rooms/1810/photo", headers=auth(leader))

    assert r.status_code == 200
    assert r.content == b"\x89PNG fake"
    assert r.headers["content-type"] == "image/png"
    assert "max-age" in r.headers["cache-control"]


def test_room_without_a_photo_is_404(client, auth, leader, live):
    live.space("1810", photo_id=None)
    assert client.get("/rooms/1810/photo", headers=auth(leader)).status_code == 404


def test_local_room_has_no_photo(client, auth, leader, room):
    assert client.get(f"/rooms/{room.id}/photo", headers=auth(leader)).status_code == 404


def test_photo_when_25live_fails_is_404(client, auth, leader, live):
    live.space("1810", photo_id=55)
    live.down = True
    assert client.get("/rooms/1810/photo", headers=auth(leader)).status_code == 404


def test_details_combine_25live_data_and_tags(client, auth, leader, live):
    live.space("1810", "SAC 302", capacity=40, features=["Food Permitted"],
               categories=["Type - Meeting Room"], room_type="Meeting Room", lat=40.9)

    r = client.get("/rooms/1810/details", headers=auth(leader))

    assert r.status_code == 200
    d = r.json()
    assert (d["name"], d["capacity"], d["latitude"]) == ("SAC 302", 40, 40.9)
    assert d["room_type"] == "Meeting Room"
    assert d["live25_features"] == ["Food Permitted"]
    assert d["tags"] == sorted(d["tags"])


def test_details_for_unknown_room_is_404(client, auth, leader):
    assert client.get("/rooms/999999/details", headers=auth(leader)).status_code == 404


def test_details_for_local_room_is_404(client, auth, leader, room):
    assert client.get(f"/rooms/{room.id}/details", headers=auth(leader)).status_code == 404


def test_details_when_25live_is_down_is_502(client, auth, leader, live):
    live.space("1810")
    live.down = True
    assert client.get("/rooms/1810/details", headers=auth(leader)).status_code == 502


# =============================================================================
# GET /rooms/{id}/schedule
# =============================================================================

def schedule(client, auth, user, room_id, **params):
    day = target_day()
    params.setdefault("start", day.isoformat())
    params.setdefault("end", day.isoformat())
    return client.get(f"/rooms/{room_id}/schedule", params=params, headers=auth(user))


def kinds(resp):
    return sorted((i["source"], i["kind"]) for i in resp.json())


def test_schedule_combines_25live_and_our_data(client, auth, leader, live, make_room,
                                               make_request, closure):
    live.space("1810")
    ours = make_room(name="SAC 302", external_ref="1810")
    live.booking("1810", at(9), at(10), name="Official Meeting")
    make_request(days=DAYS_AHEAD, start_hour=12, in_room=ours, event_name="Our Pending")
    make_request(days=DAYS_AHEAD, start_hour=12, in_room=ours, event_name="In Line",
                 status=RequestStatus.WAITLISTED, waitlist_position=1)
    closure(room=ours, start=at(20), end=at(22), reason="Cleaning")

    r = schedule(client, auth, leader, "1810")

    assert r.status_code == 200
    names = {i["name"] for i in r.json()}
    assert {"Official Meeting", "Our Pending", "Cleaning"} <= names
    assert ("25live", "event") in kinds(r)


def test_schedule_leaves_out_synced_and_decided_requests(client, auth, leader, room,
                                                         make_request):
    make_request(days=DAYS_AHEAD, start_hour=9, event_name="Synced",
                 status=RequestStatus.APPROVED, sync=SyncStatus.SYNCED, external_booking_ref="E")
    make_request(days=DAYS_AHEAD, start_hour=12, event_name="Denied", status=RequestStatus.DENIED)
    make_request(days=DAYS_AHEAD, start_hour=15, event_name="Unsynced",
                 status=RequestStatus.APPROVED)

    names = {i["name"] for i in schedule(client, auth, leader, str(room.id)).json()}

    assert "Unsynced" in names and "Synced" not in names and "Denied" not in names


def test_schedule_for_a_local_room(client, auth, leader, room, make_request, live):
    make_request(days=DAYS_AHEAD, event_name="Local Event")
    r = schedule(client, auth, leader, str(room.id))
    assert [i["name"] for i in r.json()] == ["Local Event"]
    assert live.booking_calls == []  # local rooms don't ask 25Live


def test_schedule_hides_25live_closed_hours_unless_asked(client, auth, leader, live):
    live.space("1810")
    live.booking("1810", at(0), at(7), name="Closed", kind="closed")

    default = schedule(client, auth, leader, "1810").json()
    with_closed = schedule(client, auth, leader, "1810", include_closed=True).json()

    assert default == [] and [i["kind"] for i in with_closed] == ["closed"]


def test_schedule_clips_to_the_requested_days(client, auth, leader, live):
    live.space("1810")
    live.booking("1810", at(9, day=target_day() + dt.timedelta(days=3)),
                 at(10, day=target_day() + dt.timedelta(days=3)), name="Later")
    assert schedule(client, auth, leader, "1810").json() == []


def test_schedule_is_limited_to_30_days(client, auth, leader, live):
    live.space("1810")
    start = target_day()
    schedule(client, auth, leader, "1810", end=(start + dt.timedelta(days=90)).isoformat())
    assert live.booking_calls[-1] == ("1810", start, start + dt.timedelta(days=30))


def test_schedule_defaults_to_a_week_from_today(client, auth, leader, live):
    live.space("1810")
    client.get("/rooms/1810/schedule", headers=auth(leader))
    today = campus_now().date()
    assert live.booking_calls[-1] == ("1810", today, today + dt.timedelta(days=7))


def test_schedule_end_before_start_is_400(client, auth, leader):
    day = target_day()
    r = schedule(client, auth, leader, "1810", start=day.isoformat(),
                 end=(day - dt.timedelta(days=1)).isoformat())
    assert r.status_code == 400


def test_schedule_unknown_local_room_is_404(client, auth, leader):
    assert schedule(client, auth, leader, str(uuid.uuid4())).status_code == 404


def test_schedule_is_502_when_25live_is_down(client, auth, leader, live):
    live.down = True
    assert schedule(client, auth, leader, "1810").status_code == 502
