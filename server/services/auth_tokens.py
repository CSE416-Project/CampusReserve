"""Create, check and use the one-time email links (see models/auth_token.py)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.auth_token import KIND_VERIFY, AuthToken
from models.user import User

VERIFY_TTL = timedelta(hours=24)
RESET_TTL = timedelta(hours=1)
RESEND_COOLDOWN = timedelta(seconds=60)   # one email per person per minute


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def recently_sent(db: Session, user: User, kind: str) -> bool:
    """True if we already emailed this person a link of this kind in the last minute."""
    last = (db.query(AuthToken).filter(AuthToken.user_id == user.id, AuthToken.kind == kind)
            .order_by(AuthToken.created_at.desc()).first())
    return bool(last and datetime.utcnow() - last.created_at < RESEND_COOLDOWN)


def create_token(db: Session, user: User, kind: str) -> str:
    """Make a new link for this person (replacing any unused one) and return the secret part."""
    db.query(AuthToken).filter(AuthToken.user_id == user.id, AuthToken.kind == kind,
                               AuthToken.used_at.is_(None)).delete()
    raw = secrets.token_urlsafe(32)
    ttl = VERIFY_TTL if kind == KIND_VERIFY else RESET_TTL
    db.add(AuthToken(user_id=user.id, kind=kind, token_hash=_hash(raw),
                     expires_at=datetime.utcnow() + ttl))
    db.flush()
    return raw


def find_valid(db: Session, raw: str, kind: str) -> AuthToken | None:
    """The token row if the link is real, unused and not expired; otherwise None."""
    if not raw:
        return None
    row = db.query(AuthToken).filter(AuthToken.token_hash == _hash(raw), AuthToken.kind == kind).first()
    if not row or row.used_at is not None or row.expires_at < datetime.utcnow():
        return None
    return row


def is_pending_verification(db: Session, user: User) -> bool:
    """True while a new account has been sent a verify link and hasn't used it.

    People who have no verify link at all (every account made before this
    feature, seeded admins and so on) count as fine, so nobody gets locked out."""
    return db.query(AuthToken.id).filter(AuthToken.user_id == user.id, AuthToken.kind == KIND_VERIFY,
                                         AuthToken.used_at.is_(None)).first() is not None


def mark_verified(db: Session, user: User) -> None:
    db.query(AuthToken).filter(AuthToken.user_id == user.id, AuthToken.kind == KIND_VERIFY,
                               AuthToken.used_at.is_(None)).update({"used_at": datetime.utcnow()})
