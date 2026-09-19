"""Message, ForumPost, and Notification models for CampusReserve."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class Message(Base):
    """A direct message between users (FR-8), grouped into conversations."""

    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # All messages in one back-and-forth share a conversation_id, so a thread
    # can be fetched without a separate Conversation table for MVP.
    conversation_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    sender_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recipient_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    body = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

    __table_args__ = (
        # Fetch a conversation's messages in order.
        Index("ix_message_conversation_time", "conversation_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message {self.id} conv={self.conversation_id}>"


class ForumPost(Base):
    """A collaboration-forum post or reply (FR-9). Self-referential for threading."""

    __tablename__ = "forum_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    author_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Null parent = a top-level post; a set parent = a reply to that post.
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("forum_posts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    title = Column(
        String(255), nullable=True
    )  # top-level posts have a title; replies usually don't
    body = Column(Text, nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    author = relationship("User")
    organization = relationship("Organization")
    # A post's direct replies; each reply's `parent` points back up.
    replies = relationship(
        "ForumPost",
        backref="parent",
        remote_side=[id],
        cascade="all, delete-orphan",
        single_parent=True,
    )

    def __repr__(self) -> str:
        kind = "reply" if self.parent_id else "post"
        return f"<ForumPost {self.id} ({kind})>"


class NotificationType(str, enum.Enum):
    """What a notification is about (FR-7)."""

    REQUEST_APPROVED = "request_approved"
    REQUEST_DENIED = "request_denied"
    WAITLIST_PROMOTED = "waitlist_promoted"
    NEW_MESSAGE = "new_message"


class Notification(Base):
    """An in-app notification for a user (FR-7). Email delivery is a later enhancement."""

    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type = Column(Enum(NotificationType, name="notification_type"), nullable=False)
    message = Column(
        String(512), nullable=False
    )  # human-readable text shown to the user

    # Optional link to the request this notification is about.
    request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("requests.id", ondelete="CASCADE"),
        nullable=True,
    )

    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User")
    request = relationship("Request")

    __table_args__ = (
        # Fetch a user's unread notifications quickly.
        Index("ix_notification_user_read", "user_id", "is_read"),
    )

    def __repr__(self) -> str:
        return f"<Notification {self.type.value} -> {self.user_id}>"
