"""Add the event-details columns to an EXISTING `requests` table.

Why this exists: `create_tables.py` uses create_all(), which creates tables that
are missing but never changes one that already exists. The shared (Supabase)
database already has a `requests` table, so the new columns have to be added
with ALTER TABLE. Every statement is IF NOT EXISTS, so this is safe to run any
number of times, and it never drops or rewrites data. Existing rows get the
defaults (event_type "Student - Program", event_questions {}).

Run from server/ with the venv active:
    python migrate_request_details.py

(`python create_tables.py` runs this too, so a fresh setup needs only that.)
"""

from sqlalchemy import text

from database import engine
from models import Base  # importing the package registers every model

STATEMENTS = [
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS event_type VARCHAR(100) "
    "NOT NULL DEFAULT 'Student - Program'",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS event_questions JSONB "
    "NOT NULL DEFAULT CAST('{}' AS JSONB)",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS program_advisor VARCHAR(255)",
    "ALTER TABLE requests ADD COLUMN IF NOT EXISTS policy_agreed_at TIMESTAMP",
]


def apply_migration(eng=engine) -> None:
    # The new request_co_hosts table is created by create_all() (it only adds
    # what's missing). It points at requests and organizations, which exist.
    Base.metadata.create_all(eng)
    with eng.begin() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))


def main():
    print("Target database:", engine.url.render_as_string(hide_password=True))
    apply_migration()
    print("Done. `requests` now has: event_type, description, event_questions,")
    print("program_advisor, policy_agreed_at; and request_co_hosts exists.")


if __name__ == "__main__":
    main()
