# Base scopes for actions that guests could theoretically do.
BASE_SCOPES = ["read:requests", "read:rooms", "read:waitlist", "read:forum"]

ROLES = {
    "club_leader": BASE_SCOPES
    + [
        "create:requests",
        "cancel:requests",
        "join:waitlist",
        "read:messages",
        "send:messages",
        "post:forum",
    ],
    "admin": BASE_SCOPES
    + [
        "handle:requests",
        "manage:rooms",
        "read:messages",
        "send:messages",
        "post:forum",
        "read:analytics",
        "read:external-availability",
        "sync:external-bookings",
        "manage:users",
    ],
    "venue_host": BASE_SCOPES
    + [
        "manage:rooms",
        "read:messages",
        "send:messages",
    ],
}
