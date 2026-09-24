"""Organization and Venue models for CampusReserve."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


# --- Many-to-many: a venue host can manage several venues,
#     and a venue can have several hosts. ---
venue_hosts = Table(
    "venue_hosts",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "venue_id",
        UUID(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Organization(Base):
    """A registered student organization (club)."""

    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # One org, many leaders (E-board). The FK lives on User.organization_id.
    leaders = relationship("User", back_populates="organization")

    def __repr__(self) -> str:
        return f"<Organization {self.name}>"


class Venue(Base):
    """A physical space or building that can be booked."""

    __tablename__ = "venues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    building = Column(String(255), nullable=True)
    capacity = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Many hosts per venue, and a host can manage several venues.
    hosts = relationship("User", secondary=venue_hosts, back_populates="venues")

    rooms = relationship("Room", back_populates="venue", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Venue {self.name}>"
