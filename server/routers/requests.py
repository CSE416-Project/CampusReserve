"""Booking request endpoints: submit, list, approve, deny."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Security, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.room import Request
from models.user import User
from models.organization_and_venue import OrganizationMember
from authentication import get_current_user
from services import booking

router = APIRouter(prefix="/requests", tags=["requests"])


class RequestCreate(BaseModel):
    room_id: str
    start_time: datetime
    end_time: datetime


class DecisionBody(BaseModel):
    reason: str


class RequestResponse(BaseModel):
    id: str
    room_id: str
    organization_id: str
    start_time: datetime
    end_time: datetime
    status: str

    class Config:
        from_attributes = True


def _primary_organization_id(user: User, db: Session) -> str:
    """
    CHANGED: `user.organization_id` was removed when OrganizationMember was
    introduced -- a user can belong to several organizations now, not just
    one, so there's no single column to read. This looks up their
    membership instead.

    While we're here, this also enforces NFR-1 (only a *verified* E-board
    member can book) and the term dates from NFR-2 -- neither was being
    checked anywhere before. An unverified "leader," or one whose term has
    ended, gets a clear 403 instead of silently being allowed to book.

    Assumes one active org per user for now, matching the original scope.
    Letting a user pick which org when they lead more than one is a good
    follow-up, not needed for the MVP.
    """
    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user.id,
            OrganizationMember.verified_at.isnot(None),
        )
        .filter(
            (OrganizationMember.term_end.is_(None))
            | (OrganizationMember.term_end >= date.today())
        )
        .first()
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a verified, active member of any organization.",
        )
    return str(membership.organization_id)


@router.post("", response_model=RequestResponse, status_code=201)
def create_request(
    body: RequestCreate,
    db: Session = Depends(get_db),
    user: User = Security(get_current_user, scopes=["create:requests"]),
):
    org_id = _primary_organization_id(user, db)
    req = booking.submit_request(
        db,
        room_id=body.room_id,
        organization_id=org_id,
        requester_id=str(user.id),
        start_time=body.start_time,
        end_time=body.end_time,
    )
    return RequestResponse.model_validate(req)


@router.get("", response_model=list[RequestResponse])
def list_my_requests(
    db: Session = Depends(get_db),
    user: User = Security(get_current_user, scopes=["read:requests"]),
):
    """List the caller's organization's requests."""
    org_id = _primary_organization_id(user, db)
    reqs = db.query(Request).filter(Request.organization_id == org_id).all()
    return [RequestResponse.model_validate(r) for r in reqs]


@router.post("/{request_id}/approve", response_model=RequestResponse)
def approve(
    request_id: str,
    body: DecisionBody,
    db: Session = Depends(get_db),
    user: User = Security(get_current_user, scopes=["handle:requests"]),
):
    req = booking.approve_request(db, request_id=request_id, admin_id=str(user.id), reason=body.reason)
    return RequestResponse.model_validate(req)


@router.post("/{request_id}/deny", response_model=RequestResponse)
def deny(
    request_id: str,
    body: DecisionBody,
    db: Session = Depends(get_db),
    user: User = Security(get_current_user, scopes=["handle:requests"]),
):
    req = booking.deny_request(db, request_id=request_id, admin_id=str(user.id), reason=body.reason)
    return RequestResponse.model_validate(req)
