import asyncio
import json
import random
import string
from dataclasses import replace
from datetime import date, datetime, time, timedelta
from pathlib import Path

from .base import (
    CAMPUS_TZ,
    BookingSource,
    BookingStatus,
    ConflictError,
    ExternalBooking,
    NotFoundError,
    Space,
    SyncError,
    TwentyFiveLiveAdapter,
)

SAMPLE_SPACES_PATH = Path(__file__).parent / "data" / "sample_spaces.json"


def load_sample_spaces() -> list[Space]:
    """Real 25Live room records saved in data/sample_spaces.json."""
    raw = json.loads(SAMPLE_SPACES_PATH.read_text())["spaces"]
    return [
        Space(r["space_id"], r["space_name"], r["formal_name"], r["building_name"], r["max_capacity"])
        for r in raw
    ]


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


class MockTwentyFiveLive(TwentyFiveLiveAdapter):
    def __init__(
        self,
        latency: float = 0.0,
        failure_rate: float = 0.0,
        seed: int | None = None,
        spaces: list[Space] | None = None,
    ):
        """`spaces` defaults to the real sample rooms. Pass [] to accept any room ref."""
        self.latency = latency  # seconds added to every call
        self.failure_rate = failure_rate  # 0.0-1.0 chance a push/cancel fails randomly
        self._rng = random.Random(seed)
        self._forced_failures = 0
        self._bookings: dict[str, ExternalBooking] = {}
        self._spaces = load_sample_spaces() if spaces is None else list(spaces)

    @property
    def known_rooms(self) -> set[str]:
        """Room refs (str(space_id)). Empty set means any room ref is accepted."""
        return {str(sp.space_id) for sp in self._spaces}

    # For testing
    def fail_next(self, n: int = 1) -> None:
        """Make the next n push/cancel calls raise SyncError."""
        self._forced_failures = n

    def reset(self) -> None:
        self._bookings.clear()
        self._forced_failures = 0


    def all_bookings(self) -> list[ExternalBooking]:
        return list(self._bookings.values())

    def approve(self, booking_ref: str) -> None:
        """Pretend a 25Live scheduler confirmed the booking.

        Assumption (to verify): once a room is booked it can't be requested again, so any
        other PENDING request for an overlapping time is automatically denied."""
        booking = self._get(booking_ref)
        if booking.status is BookingStatus.DENIED:
            raise SyncError("A denied booking cannot be confirmed")
        for other in self._blocking():
            if (other.booking_ref != booking_ref and other.room_ref == booking.room_ref
                    and _overlaps(booking.blocked_start, booking.blocked_end,
                                  other.blocked_start, other.blocked_end)):
                raise ConflictError(f"{booking.room_ref} conflicts with '{other.title}'")
        self._bookings[booking_ref] = replace(booking, status=BookingStatus.CONFIRMED)
        for other in list(self._bookings.values()):
            if (other.status is BookingStatus.PENDING and other.booking_ref != booking_ref
                    and other.room_ref == booking.room_ref
                    and _overlaps(booking.blocked_start, booking.blocked_end,
                                  other.blocked_start, other.blocked_end)):
                self.deny(other.booking_ref, "Room no longer available")

    def deny(self, booking_ref: str, reason: str | None = None) -> None:
        """Pretend a 25Live scheduler denied the booking."""
        booking = self._get(booking_ref)
        self._bookings[booking_ref] = replace(
            booking, status=BookingStatus.DENIED, denial_reason=reason)


    # Fake Registrar Data
    def add_registrar_booking(
        self, room_ref: str, start: datetime, end: datetime, title: str
    ) -> str:
        """Insert a booking that CampusReserve is not allowed to cancel."""
        return self._store(ExternalBooking(room_ref, start, end, title, BookingSource.REGISTRAR))

    def add_weekly_class(
        self,
        room_ref: str,
        first_day: date,
        start: time,
        end: time,
        weeks: int,
        title: str = "Academic class",
    ) -> None:
        """A recurring class, e.g. every Monday 10:00-11:20 for 15 weeks."""
        for w in range(weeks):
            day = first_day + timedelta(weeks=w)
            self.add_registrar_booking(
                room_ref, datetime.combine(day, start, CAMPUS_TZ), datetime.combine(day, end, CAMPUS_TZ), title
            )

    def add_closure(self, room_ref: str, start: datetime, end: datetime, reason: str) -> str:
        return self.add_registrar_booking(room_ref, start, end, f"CLOSED: {reason}")

    def seed_demo_data(self, anchor: date) -> None:
        """Deterministic demo data relative to `anchor` (pass a Monday).

        Uses real sample rooms: 822 = COMPSI 2120, 821 = COMPSI 2114, 824 = COMPSI 2205."""
        self.add_weekly_class("822", anchor, time(10, 0), time(11, 20), weeks=15)
        self.add_weekly_class("821", anchor + timedelta(days=2), time(14, 0), time(15, 20), weeks=15)
        self.add_closure(
            "824",
            datetime.combine(anchor + timedelta(days=7), time(0, 0), CAMPUS_TZ),
            datetime.combine(anchor + timedelta(days=9), time(0, 0), CAMPUS_TZ),
            "building maintenance",
        )


    # Adapter interface
    async def list_spaces(self) -> list[Space]:
        await self._delay()
        return list(self._spaces)

    async def get_availability(
        self, room_ref: str, start: datetime, end: datetime
    ) -> list[ExternalBooking]:
        self._validate(room_ref, start, end)
        await self._delay()
        return sorted(
            (b for b in self._blocking()
             if b.room_ref == room_ref and _overlaps(start, end, b.blocked_start, b.blocked_end)),
            key=lambda b: b.start,
        )

    async def push_booking(self, booking: ExternalBooking) -> str:
        self._validate(booking.room_ref, booking.start, booking.end)
        await self._delay()
        self._maybe_fail("push")
        clashes = [
            b for b in self._blocking()
            if b.room_ref == booking.room_ref
            and _overlaps(booking.blocked_start, booking.blocked_end, b.blocked_start, b.blocked_end)
        ]
        if clashes:
            raise ConflictError(f"{booking.room_ref} conflicts with '{clashes[0].title}'")
        return self._store(
            replace(booking, source=BookingSource.CAMPUSRESERVE, status=BookingStatus.PENDING)
        )

    async def get_booking(self, booking_ref: str) -> ExternalBooking:
        await self._delay()
        return self._get(booking_ref)

    async def cancel_booking(self, booking_ref: str) -> None:
        await self._delay()
        self._maybe_fail("cancel")
        existing = self._bookings.get(booking_ref)
        if existing is None:
            raise NotFoundError(f"Unknown event reference {booking_ref}")
        if existing.source is BookingSource.REGISTRAR:
            raise SyncError("Registrar bookings cannot be cancelled from CampusReserve")
        del self._bookings[booking_ref]


    def _new_ref(self, year: int) -> str:
        """Mimics 25Live's event reference number: year, hyphen, 6 letters (e.g. 2026-ABCDEF)."""
        while True:
            ref = f"{year}-" + "".join(self._rng.choices(string.ascii_uppercase, k=6))
            if ref not in self._bookings:
                return ref

    def _store(self, booking: ExternalBooking) -> str:
        ref = self._new_ref(booking.start.year)
        self._bookings[ref] = replace(booking, booking_ref=ref)
        return ref

    def _blocking(self) -> list[ExternalBooking]:
        """Only CONFIRMED bookings (and registrar entries) block a room or show in availability.
        Pending requests don't: several clubs can request the same slot."""
        return [b for b in self._bookings.values() if b.status is BookingStatus.CONFIRMED]

    def _get(self, booking_ref: str) -> ExternalBooking:
        existing = self._bookings.get(booking_ref)
        if existing is None:
            raise NotFoundError(f"Unknown event reference {booking_ref}")
        return existing

    def _validate(self, room_ref: str, start: datetime, end: datetime) -> None:
        if start.tzinfo is None or end.tzinfo is None:
            raise ValueError("datetimes must be timezone-aware (use CAMPUS_TZ)")
        if end <= start:
            raise ValueError("end must be after start")
        if self.known_rooms and room_ref not in self.known_rooms:
            raise NotFoundError(f"Unknown room {room_ref}")

    async def _delay(self) -> None:
        if self.latency:
            await asyncio.sleep(self.latency)

    def _maybe_fail(self, op: str) -> None:
        if self._forced_failures > 0:
            self._forced_failures -= 1
            raise SyncError(f"Simulated 25Live {op} failure")
        if self.failure_rate and self._rng.random() < self.failure_rate:
            raise SyncError(f"Random simulated 25Live {op} failure")
