"""
Create any MISSING tables on whatever database DATABASE_URL points to.

Safe for a shared/hosted database: unlike manual_db_check.py, this never
drops anything. It only adds tables that don't exist yet.

Run from server/ with the venv active:
    python create_tables.py

Note: create_all() cannot change a table that already exists, so new columns on
existing tables are added by small idempotent scripts (migrate_request_details.py,
called below). Once the shared database holds real data, consider Alembic.
"""

from sqlalchemy import text

from database import engine
from migrate_request_details import apply_migration
from models import Base  # importing the package registers every model


def main():
    # Show which database we are about to touch (password hidden).
    print("Target database:", engine.url.render_as_string(hide_password=True))

    # The no-double-booking exclusion constraint needs this extension.
    # If this line fails with a permissions error, enable btree_gist in the
    # Supabase dashboard instead (Database -> Extensions) and run this again.
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))

    Base.metadata.create_all(engine)

    # create_all() can't add columns to a table that already exists, so bring an
    # older `requests` table up to date (safe to repeat; see the file for details).
    apply_migration(engine)

    print("Done. Tables defined by the models:")
    for name in sorted(Base.metadata.tables):
        print("  -", name)


if __name__ == "__main__":
    main()
