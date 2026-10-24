"""Daily feature-use counts per user, for the admin analytics page.

One row per (user, day, feature) with how many times that user used that feature
that day. Only these four values are stored: no URLs, IP addresses, or request
contents. Written by services/usage.py.
"""

from sqlalchemy import Column, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from models.base import Base


class UsageDaily(Base):
    __tablename__ = "usage_daily"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day = Column(Date, primary_key=True)
    feature = Column(String(40), primary_key=True)
    count = Column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<UsageDaily {self.user_id} {self.day} {self.feature}={self.count}>"