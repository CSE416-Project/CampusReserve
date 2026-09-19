"""Room and Request (booking) models for CampusReserve."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class RequestStatus(str, enum.Enum):
    """Lifecycle of a booking request (Section 3: submitted → pending → decided)."""

    PENDING = "pending"  # submitted, awaiting an admin decision
    APPROVED = "approved"
    DENIED = "denied"
    CANCELLED = "cancelled"  # withdrawn by the requesting organization
    WAITLISTED = "waitlisted"  # queued for a full slot (FR-6)


class SyncStatus(str, enum.Enum):
    """State of pushing an approved booking to 25Live (FR-11)."""

    NOT_SYNCED = "not_synced"  # not yet pushed (e.g. still pending)
    SYNCED = "synced"  # successfully written to 25Live
    FAILED = "failed"  # push attempted but errored — needs reconciliation


class Room(Base):
    """A bookable room within a venue."""

    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    venue_id = Column(
        UUID(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)  # e.g. "Room 236"
    capacity = Column(Integer, nullable=True)
    room_type = Column(
        String(100), nullable=True
    )  # e.g. "Meeting room", "Rehearsal space"
    features = Column(Text, nullable=True)  # freeform for MVP; a linked table later
    media_url = Column(String(512), nullable=True)  # room photo / panorama (FR-10)

    # Maps this room to its identifier in the 25Live system of record (FR-11).
    external_ref = Column(String(255), nullable=True, index=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    venue = relationship("Venue", back_populates="rooms")
    requests = relationship("Request", back_populates="room")

    def __repr__(self) -> str:
        return f"<Room {self.name} @ {self.venue_id}>"


class Request(Base):
    """A booking request for a room over a time window."""

    __tablename__ = "requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    room_id = Column(
        UUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Who submitted it, and on behalf of which organization.
    requester_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Free start/end datetimes for the event itself...
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    # ...plus optional setup/cleanup buffers (FR-3), stored as the padded window.
    setup_start = Column(DateTime, nullable=True)
    cleanup_end = Column(DateTime, nullable=True)

    status = Column(
        Enum(RequestStatus, name="request_status"),
        nullable=False,
        default=RequestStatus.PENDING,
        index=True,
    )

    # Admin decision (FR-5): a denial/approval must carry a reason.
    decision_reason = Column(Text, nullable=True)
    decided_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_at = Column(DateTime, nullable=True)

    # Waitlist ordering (FR-6): position within a contested slot; null if not waitlisted.
    waitlist_position = Column(Integer, nullable=True)

    # 25Live sync bookkeeping (FR-11).
    sync_status = Column(
        Enum(SyncStatus, name="sync_status"),
        nullable=False,
        default=SyncStatus.NOT_SYNCED,
    )
    external_booking_ref = Column(String(255), nullable=True)  # id returned by 25Live

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    room = relationship("Room", back_populates="requests")
    requester = relationship("User", foreign_keys=[requester_id])
    decided_by = relationship("User", foreign_keys=[decided_by_id])
    organization = relationship("Organization")

    __table_args__ = (
        # An event must end after it starts.
        CheckConstraint("end_time > start_time", name="ck_request_time_order"),
        # Speeds up the core query: "what's booked in this room around this time?"
        Index("ix_request_room_time", "room_id", "start_time", "end_time"),
    )

    def __repr__(self) -> str:
        return f"<Request {self.id} room={self.room_id} {self.status.value}>"
