"""
Add demo data to the database in DATABASE_URL. Safe to run more than once:
anything that already exists is left alone.

Run from server/ with the venv active (after create_tables.py):
    python seed_demo.py

It creates three demo accounts so every role can log in:
  admin@stonybrook.edu   -> administrator
  leader@stonybrook.edu  -> club leader, VERIFIED member of "Robotics Club"
  host@stonybrook.edu    -> venue host for two buildings
Without that verified membership row, POST /requests returns 403 (NFR-1).

Set SEED_PASSWORD in your environment to choose the demo password;
otherwise a random one is generated and printed once.
"""

import os
import secrets
from datetime import datetime

from sqlalchemy.orm import Session

from authentication import hash_password
from database import engine
from models import (
    Organization,
    OrganizationMember,
    Room,
    RoomClosure,
    User,
    UserRole,
    Venue,
)

ROOMS = [
    # (building, room name, type, capacity, features)
    ("Student Activities Center", "SAC Ballroom A", "Rehearsal space", 300,
     ["Stage", "AV - Audio", "AV - Projector", "ADA Station"]),
    ("Student Activities Center", "SAC Auditorium", "Theater", 400,
     ["Stage", "AV - Full Installed AV System", "Chairs - Fixed"]),
    ("Staller Center", "Staller Theater Lobby", "Lounge", 120,
     ["ADA Station", "Cocktail Tables", "String Lights"]),
    ("Staller Center", "Recital Hall", "Theater", 380,
     ["Piano - Grand", "Stage", "Lighting - Dimmer"]),
    ("Melville Library", "Library Room 2404", "Meeting room", 18,
     ["Board - Whiteboard", "AV - Computer Monitor", "Tables"]),
    ("Union", "Union Room 236", "Meeting room", 40,
     ["AV - Projector", "Moveable", "Tables"]),
]


def get_or_create(session, model, defaults=None, **lookup):
    obj = session.query(model).filter_by(**lookup).first()
    if obj is not None:
        return obj, False
    obj = model(**lookup, **(defaults or {}))
    session.add(obj)
    session.flush()
    return obj, True


def main():
    print("Target database:", engine.url.render_as_string(hide_password=True))
    password = os.environ.get("SEED_PASSWORD") or secrets.token_urlsafe(9)
    new_users = False

    with Session(engine) as session:
        def make_user(email, name, role):
            nonlocal new_users
            user, created = get_or_create(
                session, User, email=email,
                defaults={"name": name, "role": role,
                          "password_hash": hash_password(password)},
            )
            new_users = new_users or created
            return user

        admin = make_user("admin@stonybrook.edu", "Demo Admin", UserRole.ADMIN)
        leader = make_user("leader@stonybrook.edu", "Demo Leader", UserRole.CLUB_LEADER)
        host = make_user("host@stonybrook.edu", "Demo Venue Host", UserRole.VENUE_HOST)

        org, _ = get_or_create(session, Organization, name="Robotics Club")
        get_or_create(
            session, OrganizationMember, user_id=leader.id, organization_id=org.id,
            defaults={"position_title": "President",
                      "verified_at": datetime.utcnow(), "verified_by_id": admin.id},
        )

        venues = {}
        for building, name, room_type, cap, features in ROOMS:
            if building not in venues:
                venues[building], _ = get_or_create(session, Venue, name=building)
            get_or_create(
                session, Room, venue_id=venues[building].id, name=name,
                defaults={"room_type": room_type, "capacity": cap, "features": features},
            )

        for building in ("Student Activities Center", "Staller Center"):
            if venues[building] not in host.venues:
                host.venues.append(venues[building])

        recital = session.query(Room).filter_by(name="Recital Hall").first()
        get_or_create(
            session, RoomClosure, room_id=recital.id,
            defaults={"closed_from": datetime(2026, 10, 1),
                      "closed_until": datetime(2026, 10, 14),
                      "reason": "Building closed for maintenance until Oct 14"},
        )
        session.commit()

    print("Seed complete.")
    if new_users:
        print("Demo accounts (all three share this password):", password)
    else:
        print("Demo accounts already existed; their passwords were not changed.")


if __name__ == "__main__":
    main()
