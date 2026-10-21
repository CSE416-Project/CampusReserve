"""25Live adapter interface (design doc, section 7).

The rest of CampusReserve talks to 25Live ONLY through `TwentyFiveLiveAdapter`.
Implementations: `MockTwentyFiveLive` (development/testing) and, later, a real
API or scraping client. Swapping one for the other must not touch callers.

Time convention: windows are half-open, [start, end). A booking that ends at
10:00 does not conflict with one that starts at 10:00. Pass the *padded*
window (setup_start .. cleanup_end) when the request has buffers, so the
whole blocked time is reserved.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from zoneinfo import ZoneInfo

CAMPUS_TZ = ZoneInfo("America/New_York")

class BookingSource(str, Enum):
    """Who created a booking in 25Live."""

    REGISTRAR = "registrar"  # academic scheduling, closures; we can never modify these
    CAMPUSRESERVE = "campusreserve"  # pushed by us


class BookingStatus(str, Enum):
    """Where a booking stands in 25Live's own approval process."""

    PENDING = "pending"  # requested, waiting for a 25Live scheduler to act
    CONFIRMED = "confirmed"
    DENIED = "denied"


@dataclass(frozen=True)
class Space:
    """A room as 25Live describes it (subset of the real spaces.json fields)."""

    space_id: int  # store str(space_id) in Room.external_ref
    space_name: str  # short code, e.g. "COMPSI 2120"
    formal_name: str
    building_name: str
    max_capacity: int


@dataclass(frozen=True)
class ExternalBooking:
    room_ref: str  # matches Room.external_ref
    start: datetime
    end: datetime
    title: str
    source: BookingSource = BookingSource.CAMPUSRESERVE
    booking_ref: str | None = None  # assigned by 25Live; stored as Request.external_booking_ref
    setup: timedelta = timedelta(0)  # room is blocked this long before start
    takedown: timedelta = timedelta(0)  # ...and this long after end
    status: BookingStatus = BookingStatus.CONFIRMED  # ignored when pushing; new bookings start PENDING
    client_ref: str | None = None  # OUR request id, so both systems can match up (like 25Live's alien_uid)
    denial_reason: str | None = None  # set when status is DENIED (assumption: 25Live may not give one)

    @property

    def blocked_start(self) -> datetime:
        return self.start - self.setup

    @property
    def blocked_end(self) -> datetime:
        return self.end + self.takedown


class SyncError(Exception):
    """Base class for any failure talking to 25Live. Callers should mark the
    request SyncStatus.FAILED when they catch this."""


class ConflictError(SyncError):
    """The requested window overlaps an existing 25Live booking."""


class NotFoundError(SyncError):
    """Unknown room or booking reference."""


class TwentyFiveLiveAdapter(ABC):
    @abstractmethod
    async def list_spaces(self) -> list[Space]:
        """Return the rooms that can be requested."""

    @abstractmethod
    async def get_availability(
        self, room_ref: str, start: datetime, end: datetime
    ) -> list[ExternalBooking]:
        """Return existing bookings overlapping [start, end). Empty list = free."""

    @abstractmethod
    async def push_booking(self, booking: ExternalBooking) -> str:
        """Write a booking to 25Live and return its event reference number.

        The booking starts PENDING; a 25Live scheduler later confirms or denies it.

        Raises ConflictError on overlap, SyncError on any other failure."""

    @abstractmethod
    async def get_booking(self, booking_ref: str) -> ExternalBooking:
        """Read a booking back, mainly to learn its current status (pending/confirmed/denied)."""

    @abstractmethod
    async def cancel_booking(self, booking_ref: str) -> None:
        """Remove a CampusReserve-created booking (used on cancellation / reconciliation)."""
