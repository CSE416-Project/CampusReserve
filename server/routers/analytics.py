"""Admin analytics (FR-12): who uses CampusReserve, for what, and how bookings go.

GET /admin/analytics?days=30 returns everything the analytics page shows for the
last `days` days. Usage numbers come from usage_daily (see services/usage.py) and
only start once tracking is deployed; everything else comes from existing tables.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, Query, Security
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from authentication import get_current_user
from database import get_db
from models.organization_and_venue import Organization, OrganizationMember
from models.room import Request, RequestStatus
from models.usage import UsageDaily
from models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])

TOP_N = 8


class DayValue(BaseModel):
    day: dt.date
    value: int


class NameCount(BaseModel):
    name: str
    count: int


class FeatureUse(BaseModel):
    feature: str
    uses: int        # total times used
    users: int       # distinct people who used it


class UsersOut(BaseModel):
    total: int
    by_role: dict[str, int]
    new_in_period: int
    active_in_period: int
    active_last_7_days: int
    daily_active: list[DayValue]
    daily_signups: list[DayValue]


class RequestsOut(BaseModel):
    total: int
    by_status: dict[str, int]
    approval_rate: float | None          # approved / (approved + denied)
    avg_decision_hours: float | None     # submitted -> approved/denied
    avg_attendance: float | None
    upcoming_approved: int
    per_day: list[DayValue]
    top_rooms: list[NameCount]
    top_organizations: list[NameCount]
    by_weekday: list[int]                # Monday..Sunday, by event start
    by_hour: list[int]                   # 0..23, by event start


class OrganizationsOut(BaseModel):
    total: int
    with_verified_members: int
    pending_verifications: int


class AnalyticsOut(BaseModel):
    days: int
    start: dt.date
    end: dt.date
    tracking_since: dt.date | None       # first day of usage data, if any
    users: UsersOut
    features: list[FeatureUse]
    requests: RequestsOut
    organizations: OrganizationsOut


def _series(days: list[dt.date], counts: dict[dt.date, int]) -> list[DayValue]:
    return [DayValue(day=d, value=counts.get(d, 0)) for d in days]


@router.get("/analytics", response_model=AnalyticsOut)
def analytics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: User = Security(get_current_user, scopes=["manage:users"]),
):
    """Site usage and booking statistics for the last `days` days (admins only)."""
    end = dt.date.today()
    start = end - dt.timedelta(days=days - 1)
    since = dt.datetime.combine(start, dt.time())
    day_list = [start + dt.timedelta(days=i) for i in range(days)]
    now = dt.datetime.now()

    # ---- users -----------------------------------------------------------
    total_users = db.query(func.count(User.id)).scalar() or 0
    by_role = {(r.value if hasattr(r, "value") else str(r)): n
               for r, n in db.query(User.role, func.count(User.id)).group_by(User.role).all()}
    signups = Counter(c.date() for (c,) in db.query(User.created_at).filter(User.created_at >= since))

    usage = db.query(UsageDaily).filter(UsageDaily.day >= start).all()
    active_by_day: dict[dt.date, set] = defaultdict(set)
    feature_uses: Counter = Counter()
    feature_users: dict[str, set] = defaultdict(set)
    for u in usage:
        active_by_day[u.day].add(u.user_id)
        feature_uses[u.feature] += u.count
        feature_users[u.feature].add(u.user_id)
    active_all = set().union(*active_by_day.values()) if active_by_day else set()
    week_ago = end - dt.timedelta(days=6)
    active_7 = set().union(*(s for d, s in active_by_day.items() if d >= week_ago)) \
        if active_by_day else set()
    tracking_since = db.query(func.min(UsageDaily.day)).scalar()

    # ---- booking requests --------------------------------------------------
    reqs = (db.query(Request).options(joinedload(Request.room), joinedload(Request.organization))
            .filter(Request.created_at >= since).all())
    by_status = Counter(r.status.value for r in reqs)
    approved = by_status.get(RequestStatus.APPROVED.value, 0)
    denied = by_status.get(RequestStatus.DENIED.value, 0)
    decision_hours = [(r.decided_at - r.created_at).total_seconds() / 3600 for r in reqs
                      if r.decided_at and r.created_at
                      and r.status in (RequestStatus.APPROVED, RequestStatus.DENIED)]
    attendance = [r.expected_attendance for r in reqs if r.expected_attendance]
    by_weekday, by_hour = [0] * 7, [0] * 24
    for r in reqs:
        by_weekday[r.start_time.weekday()] += 1
        by_hour[r.start_time.hour] += 1
    rooms = Counter(r.room.name if r.room else "Unknown room" for r in reqs)
    orgs = Counter(r.organization.name if r.organization else "Unknown club" for r in reqs)
    upcoming = (db.query(func.count(Request.id))
                .filter(Request.status == RequestStatus.APPROVED, Request.start_time >= now).scalar() or 0)

    # ---- organizations -----------------------------------------------------
    total_orgs = db.query(func.count(Organization.id)).scalar() or 0
    current = (OrganizationMember.term_end.is_(None)) | (OrganizationMember.term_end >= end)
    with_verified = (db.query(func.count(func.distinct(OrganizationMember.organization_id)))
                     .filter(OrganizationMember.verified_at.isnot(None), current).scalar() or 0)
    pending = (db.query(func.count()).select_from(OrganizationMember)
               .filter(OrganizationMember.verified_at.is_(None)).scalar() or 0)

    return AnalyticsOut(
        days=days, start=start, end=end, tracking_since=tracking_since,
        users=UsersOut(
            total=total_users, by_role=by_role, new_in_period=sum(signups.values()),
            active_in_period=len(active_all), active_last_7_days=len(active_7),
            daily_active=_series(day_list, {d: len(s) for d, s in active_by_day.items()}),
            daily_signups=_series(day_list, signups),
        ),
        features=sorted((FeatureUse(feature=f, uses=n, users=len(feature_users[f]))
                         for f, n in feature_uses.items()), key=lambda f: -f.uses),
        requests=RequestsOut(
            total=len(reqs), by_status=dict(by_status),
            approval_rate=round(approved / (approved + denied), 3) if approved + denied else None,
            avg_decision_hours=round(sum(decision_hours) / len(decision_hours), 1) if decision_hours else None,
            avg_attendance=round(sum(attendance) / len(attendance), 1) if attendance else None,
            upcoming_approved=upcoming,
            per_day=_series(day_list, Counter(r.created_at.date() for r in reqs)),
            top_rooms=[NameCount(name=n, count=c) for n, c in rooms.most_common(TOP_N)],
            top_organizations=[NameCount(name=n, count=c) for n, c in orgs.most_common(TOP_N)],
            by_weekday=by_weekday, by_hour=by_hour,
        ),
        organizations=OrganizationsOut(total=total_orgs, with_verified_members=with_verified,
                                       pending_verifications=pending),
    )