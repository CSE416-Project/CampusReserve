import asyncio
import re
from datetime import date, datetime, timedelta

import pytest

from tflive_integrations.twentyfive_live import (
    CAMPUS_TZ,
    BookingSource,
    BookingStatus,
    ConflictError,
    ExternalBooking,
    MockTwentyFiveLive,
    NotFoundError,
    SyncError,
)

MONDAY = date(2026, 10, 5)
ROOM = "822"  # COMPSI 2120 (real 25Live space_id)
CLOSED_ROOM = "824"  # COMPSI 2205, closed Oct 12-14 in the demo data


def run(coro):
    return asyncio.run(coro)


def at(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=CAMPUS_TZ)


def request(mock, start, end, title="Club", **kw):
    """Submit a booking request; returns its event reference."""
    return run(mock.push_booking(ExternalBooking(ROOM, start, end, title, **kw)))


@pytest.fixture
def mock():
    m = MockTwentyFiveLive(seed=1)
    m.seed_demo_data(MONDAY)
    return m


# ---- rooms ---------------------------------------------------------------
def test_list_spaces_returns_real_sample_rooms(mock):
    spaces = run(mock.list_spaces())
    assert len(spaces) == 12
    assert any(sp.space_id == 822 and sp.space_name == "COMPSI 2120" for sp in spaces)


def test_unknown_room_and_booking(mock):
    with pytest.raises(NotFoundError):
        run(mock.get_availability("NOPE", at(5, 9), at(5, 10)))
    with pytest.raises(NotFoundError):
        run(mock.cancel_booking("2026-ZZZZZZ"))


# ---- availability and registrar data ------------------------------------
def test_availability_shows_registrar_class(mock):
    found = run(mock.get_availability(ROOM, at(5, 9), at(5, 12)))
    assert len(found) == 1 and found[0].source is BookingSource.REGISTRAR


def test_free_window_is_empty(mock):
    assert run(mock.get_availability(ROOM, at(5, 12), at(5, 13))) == []


def test_push_conflicts_with_registrar(mock):
    with pytest.raises(ConflictError):
        request(mock, at(5, 10, 30), at(5, 12))


def test_back_to_back_is_not_a_conflict(mock):
    request(mock, at(5, 11, 20), at(5, 12))  # class ends 11:20


def test_closure_blocks_room(mock):
    with pytest.raises(ConflictError):
        run(mock.push_booking(ExternalBooking(CLOSED_ROOM, at(12, 9), at(12, 10), "Club")))


def test_cannot_cancel_registrar_booking(mock):
    ref = run(mock.get_availability(ROOM, at(5, 10), at(5, 11)))[0].booking_ref
    with pytest.raises(SyncError):
        run(mock.cancel_booking(ref))


# ---- requesting, pending, approval --------------------------------------
def test_reference_looks_like_25live_and_is_unique(mock):
    refs = {request(mock, at(6, h), at(6, h + 1)) for h in range(8, 16)}
    assert len(refs) == 8
    assert all(re.fullmatch(r"2026-[A-Z]{6}", r) for r in refs)


def test_new_booking_starts_pending_and_keeps_our_request_id(mock):
    ref = request(mock, at(5, 12), at(5, 13), client_ref="request-123")
    booking = run(mock.get_booking(ref))
    assert booking.status is BookingStatus.PENDING
    assert booking.client_ref == "request-123"


def test_pending_requests_do_not_block_each_other(mock):
    request(mock, at(5, 12), at(5, 13), "Club A")
    request(mock, at(5, 12), at(5, 13), "Club B")  # no error: both are just requests
    assert run(mock.get_availability(ROOM, at(5, 12), at(5, 13))) == []  # nothing confirmed yet


def test_approve_confirms_and_blocks_the_room(mock):
    ref = request(mock, at(5, 12), at(5, 13))
    mock.approve(ref)
    assert run(mock.get_booking(ref)).status is BookingStatus.CONFIRMED
    assert len(run(mock.get_availability(ROOM, at(5, 12), at(5, 13)))) == 1


def test_two_clubs_one_wins_the_other_is_denied_and_room_is_closed(mock):
    a = request(mock, at(5, 12), at(5, 13), "Club A")
    b = request(mock, at(5, 12, 30), at(5, 13, 30), "Club B")  # overlaps A
    mock.approve(a)
    loser = run(mock.get_booking(b))
    assert loser.status is BookingStatus.DENIED
    assert loser.denial_reason == "Room no longer available"
    with pytest.raises(ConflictError):  # a booked room can't be requested again
        request(mock, at(5, 12), at(5, 13), "Club C")


def test_non_overlapping_pending_request_is_untouched_by_approval(mock):
    a = request(mock, at(5, 12), at(5, 13))
    b = request(mock, at(5, 14), at(5, 15))
    mock.approve(a)
    assert run(mock.get_booking(b)).status is BookingStatus.PENDING


def test_manual_deny_keeps_record_and_reason_and_cannot_be_approved_later(mock):
    ref = request(mock, at(5, 12), at(5, 13))
    mock.deny(ref, "Not an approved event type")
    booking = run(mock.get_booking(ref))
    assert booking.status is BookingStatus.DENIED
    assert booking.denial_reason == "Not an approved event type"
    with pytest.raises(SyncError):
        mock.approve(ref)


def test_setup_and_takedown_block_neighbouring_times(mock):
    ref = request(mock, at(5, 12), at(5, 13), setup=timedelta(minutes=15), takedown=timedelta(minutes=30))
    mock.approve(ref)
    with pytest.raises(ConflictError):
        request(mock, at(5, 13), at(5, 14))  # inside the takedown window
    request(mock, at(5, 13, 30), at(5, 14))  # right after it


def test_cancel_own_booking_frees_room(mock):
    ref = request(mock, at(5, 12), at(5, 13))
    mock.approve(ref)
    run(mock.cancel_booking(ref))
    assert run(mock.get_availability(ROOM, at(5, 12), at(5, 13))) == []


# ---- failures and bad input ---------------------------------------------
def test_forced_failure_then_recovery(mock):
    b = ExternalBooking(ROOM, at(5, 12), at(5, 13), "Club")
    mock.fail_next()
    with pytest.raises(SyncError):
        run(mock.push_booking(b))
    assert mock.all_bookings() == [bk for bk in mock.all_bookings() if bk.source is BookingSource.REGISTRAR]
    assert run(mock.push_booking(b))  # retry works


def test_invalid_window_rejected(mock):
    with pytest.raises(ValueError):
        run(mock.get_availability(ROOM, at(5, 10), at(5, 9)))


def test_naive_datetimes_rejected(mock):
    with pytest.raises(ValueError):
        run(mock.get_availability(ROOM, datetime(2026, 10, 5, 9), datetime(2026, 10, 5, 12)))


def test_status_controls_and_get_reject_unknown_refs(mock):
    for call in (mock.approve, mock.deny):
        with pytest.raises(NotFoundError):
            call("2026-ZZZZZZ")
    with pytest.raises(NotFoundError):
        run(mock.get_booking("2026-ZZZZZZ"))
