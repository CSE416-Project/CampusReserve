"""User model and role definitions for CampusReserve."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base  # your declarative Base lives here


class UserRole(str, enum.Enum):
    """The three user types in CampusReserve."""
    CLUB_LEADER = "club_leader"
    ADMIN = "admin"
    VENUE_HOST = "venue_host"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)

    role = Column(
        Enum(UserRole, name="user_role"),
        nullable=False,
        default=UserRole.CLUB_LEADER,
    )

    # E-board membership is verified before a leader gains booking rights (NFR-1).
    is_verified = Column(Boolean, nullable=False, default=False)

    # Access can be scoped to a term / deactivated (NFR-2, least privilege).
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


    # TODO update below, want organization and venue as well.
    # --- relationships (defined on the related models via back_populates) ---
    # requests = relationship("Request", back_populates="requester")
    # A club leader belongs to one organization (nullable — admins/hosts have none).
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )
    organization = relationship("Organization", back_populates="leaders")

    # Venue hosts ↔ venues (many-to-many via the venue_hosts table).
    venues = relationship("Venue", secondary="venue_hosts", back_populates="hosts")

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role.value})>"