"""Add club contact emails from a spreadsheet to the organizations in the database.

The sheet needs a "Club Name" column and an "Email" column (other columns are ignored).
Names are matched to organizations ignoring case, spacing and curly quotes. Names the
sheet cut short with "..." match the one organization that starts with that text.

Run from server/ (same folder as dev_setup.py):

    python import_club_emails.py club_emails.csv            # preview: changes nothing
    python import_club_emails.py club_emails.csv --apply    # write the emails

The preview lists every row as matched, a guess, ambiguous, or not found, and writes
club_email_matches.csv so you can check it. "Guesses" are short sheet names such as
"Caribbean" that match exactly one longer club name ("Caribbean Students Organization");
they are only written with --accept-guesses. Clubs that aren't in the sheet are left alone,
so a club without an email keeps showing no email.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CUT = re.compile(r"(\.\.\.|…)\s*$")


def norm(name: str) -> str:
    """Compare names ignoring case, curly quotes and extra spaces."""
    name = (name.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"'))
    return re.sub(r"\s+", " ", name).strip().casefold()


def read_sheet(path: str) -> list[tuple[str, str]]:
    """(club name, email) for every row with both. Rows without an email are skipped."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    if not rows:
        return []
    header = [h.strip().casefold() for h in rows[0]]
    try:
        name_col, email_col = header.index("club name"), header.index("email")
    except ValueError:
        sys.exit('The sheet needs "Club Name" and "Email" columns.')
    out = []
    for r in rows[1:]:
        name = r[name_col].strip() if len(r) > name_col else ""
        email = r[email_col].strip() if len(r) > email_col else ""
        if name and email:
            out.append((name, email))
    return out


def match(sheet_name: str, org_names: list[str]) -> tuple[str, list[str]]:
    """How a sheet name matches the organizations: ("exact" | "cut-short" | "guess" |
    "ambiguous" | "not found", the matching organization names)."""
    by_norm: dict[str, list[str]] = {}
    for n in org_names:
        by_norm.setdefault(norm(n), []).append(n)
    key = norm(sheet_name)
    if key in by_norm:
        return ("exact", by_norm[key]) if len(by_norm[key]) == 1 else ("ambiguous", by_norm[key])
    if CUT.search(sheet_name):
        prefix = norm(CUT.sub("", sheet_name))
        hits = [n for k, ns in by_norm.items() if k.startswith(prefix) for n in ns]
        if len(hits) == 1:
            return "cut-short", hits
        return ("ambiguous", hits) if hits else ("not found", [])
    # A short name like "Caribbean": a club whose name starts with it as a whole word.
    hits = [n for k, ns in by_norm.items() if k.startswith(key + " ") for n in ns]
    if len(hits) == 1:
        return "guess", hits
    return ("ambiguous", hits) if hits else ("not found", [])


def plan(sheet: list[tuple[str, str]], org_names: list[str], accept_guesses: bool = False):
    """Returns (updates {org name: email}, report rows)."""
    updates: dict[str, str] = {}
    report = []
    for name, email in sheet:
        how, hits = match(name, org_names)
        if not EMAIL_RE.match(email):
            how, note = "skipped", "not a valid email"
        else:
            note = ""
        use = how in ("exact", "cut-short") or (how == "guess" and accept_guesses)
        if use:
            org = hits[0]
            if org in updates and updates[org] != email:
                note = f"sheet has two emails for this club; keeping {updates[org]}"
                use = False
            else:
                updates[org] = email
        report.append({"sheet name": name, "email": email, "match": how,
                       "organization": "; ".join(hits), "written": "yes" if use else "no", "note": note})
    return updates, report


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet", help='CSV with "Club Name" and "Email" columns')
    ap.add_argument("--apply", action="store_true", help="write the emails (default: preview only)")
    ap.add_argument("--accept-guesses", action="store_true", help='also write the "guess" matches')
    args = ap.parse_args()

    sheet = read_sheet(args.sheet)
    if not sheet:
        sys.exit("No rows with both a club name and an email.")

    from dotenv import load_dotenv
    load_dotenv()
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    import models  # noqa: F401  (registers every table)
    from models.organization_and_venue import Organization

    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("Set DATABASE_URL first (it's in your .env).")
    # Supabase's transaction pooler (port 6543) can't use prepared statements, so turn them
    # off here the same way the app does. Harmless on any other Postgres.
    engine = create_engine(url, connect_args={"prepare_threshold": None})
    with Session(engine) as db:
        orgs = db.query(Organization).all()
        updates, report = plan(sheet, [o.name for o in orgs], args.accept_guesses)

        with open("club_email_matches.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(report[0]))
            w.writeheader()
            w.writerows(report)
        counts = {}
        for r in report:
            counts[r["match"]] = counts.get(r["match"], 0) + 1
        print(f"{len(sheet)} rows with an email: " + ", ".join(f"{n} {k}" for k, n in sorted(counts.items())))
        for r in report:
            if r["match"] in ("guess", "ambiguous", "not found", "skipped") or r["note"]:
                extra = f" -> {r['organization']}" if r["organization"] else ""
                print(f"  [{r['match']}] {r['sheet name']}{extra}{'  (' + r['note'] + ')' if r['note'] else ''}")
        print("Full list: club_email_matches.csv")

        if not args.apply:
            print(f"\nPreview only. {len(updates)} clubs would get an email. Run again with --apply to write them"
                  + ("" if args.accept_guesses else " (add --accept-guesses to include the guesses)") + ".")
            return
        changed = 0
        for o in orgs:
            if o.name in updates and o.contact_email != updates[o.name]:
                o.contact_email = updates[o.name]
                changed += 1
        db.commit()
        print(f"\nSaved. {changed} clubs updated ({len(updates) - changed} already had that email).")


if __name__ == "__main__":
    main()
