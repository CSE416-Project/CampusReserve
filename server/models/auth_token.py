"""One-time links we email to people: "verify your email" and "reset your password".

A separate table (not extra columns on users) so adding this feature never
needs a change to the existing users table. Only a hash of the token is stored,
so a leaked database can't be used to take over accounts.
"""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from .base import Base

KIND_VERIFY = "verify"   # confirm a new account's email address
KIND_RESET = "reset"     # choose a new password
KIND_ADD_EMAIL = "add_email"  # confirm an email a general account added (stored in `email` until confirmed)


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    kind = Column(String(20), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    # Only for KIND_ADD_EMAIL: the address waiting to be confirmed. It's copied to
    # users.email when the link is opened, so nobody can claim an address they don't own.
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
