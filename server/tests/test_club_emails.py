"""Club contact emails: shown by the organizations API, and matched from the sheet by
import_club_emails.py. Uses the fixtures in conftest.py."""

from import_club_emails import match, plan


def test_api_shows_the_club_email(client, auth, leader, org, db):
    org.contact_email = "club@example.com"
    db.flush()
    listed = {o["id"]: o for o in client.get("/organizations", headers=auth(leader)).json()}
    assert listed[str(org.id)]["contact_email"] == "club@example.com"
    assert client.get(f"/organizations/{org.id}", headers=auth(leader)).json()["contact_email"] == "club@example.com"


def test_api_contact_email_is_null_without_one(client, auth, leader, org):
    assert client.get(f"/organizations/{org.id}", headers=auth(leader)).json()["contact_email"] is None


ORGS = ["International Law Society", "American Association for Men in Nursing at Stony Brook University",
        "Caribbean Students Organization", "Caribbean Dance Club", "Japanese Student Organization",
        "Wolfie’s Big Band", "Jewish Student Association", "Jewish Student Association (RSOM)"]


def test_exact_names_match_ignoring_case_spaces_and_curly_quotes():
    assert match("international  law society", ORGS) == ("exact", ["International Law Society"])
    assert match("Wolfie's Big Band", ORGS) == ("exact", ["Wolfie’s Big Band"])
    assert match("Jewish Student Association", ORGS) == ("exact", ["Jewish Student Association"])


def test_names_cut_short_with_dots_match_the_one_club_they_start():
    assert match("American Association for Men in Nursing at...", ORGS)[0] == "cut-short"


def test_short_names_are_guesses_or_ambiguous():
    assert match("Japanese", ORGS) == ("guess", ["Japanese Student Organization"])
    assert match("Caribbean", ORGS)[0] == "ambiguous"
    assert match("Nope Club", ORGS) == ("not found", [])


def test_plan_writes_only_sure_matches_unless_guesses_are_accepted():
    sheet = [("International Law Society", "ils@example.com"), ("Japanese", "jso@example.com"),
             ("Caribbean", "cso@example.com"), ("Nope Club", "x@example.com"), ("Jewish Student Association", "bad")]
    updates, report = plan(sheet, ORGS)
    assert updates == {"International Law Society": "ils@example.com"}
    assert [r["written"] for r in report] == ["yes", "no", "no", "no", "no"]
    updates, _ = plan(sheet, ORGS, accept_guesses=True)
    assert updates["Japanese Student Organization"] == "jso@example.com"
