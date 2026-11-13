"""Spaces made of smaller spaces (a lobby and its tables): reading the links and merging bookings."""
import asyncio
import datetime as dt

from services import live25


def booking(name, hour, kind="event"):
    s = dt.datetime(2026, 11, 20, hour)
    e = s + dt.timedelta(hours=1)
    return {"space_id": "x", "kind": kind, "state": "Confirmed", "name": name, "start": s, "end": e,
            "event_start": s, "event_end": e, "expected_headcount": None}


def test_detail_reads_parents_and_parts():
    data = {"content": {"data": {"items": [{"kind": "space", "id": 2856, "spaceName": "LOBBY 01", "relationships": {
        "subdivisionOf": [{"spaceId": 2864}, {"spaceId": 2940}], "dividesInto": [{"spaceId": 5}]}}]}}}
    d = live25.parse_space_detail(data)
    assert d["parent_ids"] == ["2864", "2940"] and d["child_ids"] == ["5"]


def test_detail_without_links_has_none():
    data = {"content": {"data": {"items": [{"kind": "space", "id": 1, "spaceName": "A"}]}}}
    d = live25.parse_space_detail(data)
    assert d["parent_ids"] == [] and d["child_ids"] == []


def test_whole_space_shows_each_part_and_whole_bookings_labelled():
    own = [booking("Whole lobby event", 9)]
    merged = live25.merge_related(own, [("Table 1", [booking("Chess", 11)]), ("Table 2", [booking("Bake sale", 11)])], [])
    names = {(b["name"], b["space_name"]) for b in merged}
    assert names == {("Whole lobby event", "Whole space"), ("Chess", "Table 1"), ("Bake sale", "Table 2")}


def test_events_25live_already_lists_are_labelled_not_doubled():
    own = [booking("Chess", 11)]
    merged = live25.merge_related(own, [("Table 1", [booking("Chess", 11)])], [])
    assert [(b["name"], b["space_name"]) for b in merged] == [("Chess", "Table 1")]


def test_a_part_shows_the_whole_spaces_bookings_and_leaves_its_own_unlabelled():
    own = [booking("My table event", 9)]
    merged = live25.merge_related(own, [], [("Union Lobby", [booking("Lobby takeover", 14)])])
    assert {(b["name"], b.get("space_name")) for b in merged} == {("My table event", None), ("Lobby takeover", "Whole space: Union Lobby")}


def test_closed_hours_of_related_spaces_are_ignored():
    merged = live25.merge_related([], [("Table 1", [booking("Closed", 0, kind="closed")])], [])
    assert merged == []


def test_a_related_space_that_cannot_be_loaded_is_left_out(monkeypatch):
    async def detail(space_id, force=False):
        return {"id": space_id, "name": "Lobby", "capacity": 4, "child_ids": ["2", "3"], "parent_ids": [], "layout_diagram_id": 1}

    async def details(ids):
        return {i: {"name": f"Table {i}", "capacity": 2} for i in ids}

    async def bookings(space_id, start, end=None):
        if space_id == "3":
            raise live25.Live25Error("down")
        return [booking(f"event {space_id}", 9)]

    monkeypatch.setattr(live25, "get_space_detail", detail)
    monkeypatch.setattr(live25, "get_space_details", details)
    monkeypatch.setattr(live25, "get_bookings", bookings)
    out = asyncio.run(live25.get_bookings_with_related("1", dt.date(2026, 11, 20)))
    assert {(b["name"], b["space_name"]) for b in out} == {("event 1", "Whole space"), ("event 2", "Table 2")}


def test_only_the_smallest_spaces_are_offered_and_labelled_with_their_group(monkeypatch):
    details = {
        "1": {"id": "1", "name": "Lobby (All Spaces)", "capacity": 26, "child_ids": ["2", "3", "4", "5"], "parent_ids": [], "layout_diagram_id": 9},
        "2": {"name": "Ballroom (All Spaces)", "capacity": 8, "child_ids": ["3", "4"], "parent_ids": ["1"]},
        "3": {"name": "Table 1", "capacity": 2, "child_ids": [], "parent_ids": ["1", "2"]},
        "4": {"name": "Table 2", "capacity": 2, "child_ids": [], "parent_ids": ["1", "2"]},
        "5": {"name": "Window seat", "capacity": 1, "child_ids": [], "parent_ids": ["1"]},
    }

    async def detail(space_id, force=False):
        return details[space_id]

    async def many(ids):
        return {i: details[i] for i in ids}

    monkeypatch.setattr(live25, "get_space_detail", detail)
    monkeypatch.setattr(live25, "get_space_details", many)
    rel = asyncio.run(live25.get_relations("1"))
    assert [(c["name"], c["group"]) for c in rel["children"]] == [
        ("Table 1", "Ballroom (All Spaces)"), ("Table 2", "Ballroom (All Spaces)"), ("Window seat", None)]
    assert rel["diagram"] is True


def test_bookings_of_a_smaller_whole_inside_are_labelled_too(monkeypatch):
    details = {
        "1": {"id": "1", "name": "Lobby", "capacity": 9, "child_ids": ["2", "3"], "parent_ids": [], "layout_diagram_id": None},
        "2": {"name": "Ballroom Lobby (All Spaces)", "capacity": 4, "child_ids": ["3"], "parent_ids": ["1"]},
        "3": {"name": "Table 1", "capacity": 2, "child_ids": [], "parent_ids": ["1", "2"]},
    }

    async def detail(space_id, force=False):
        return details[space_id]

    async def many(ids):
        return {i: details[i] for i in ids}

    async def bookings(space_id, start, end=None):
        return {"1": [], "2": [booking("Ballroom lobby fair", 10)], "3": [booking("Chess", 12)]}[space_id]

    monkeypatch.setattr(live25, "get_space_detail", detail)
    monkeypatch.setattr(live25, "get_space_details", many)
    monkeypatch.setattr(live25, "get_bookings", bookings)
    out = asyncio.run(live25.get_bookings_with_related("1", dt.date(2026, 11, 20)))
    assert {(b["name"], b["space_name"]) for b in out} == {("Ballroom lobby fair", "Ballroom Lobby (All Spaces)"), ("Chess", "Table 1")}
