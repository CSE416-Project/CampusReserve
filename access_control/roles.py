# TODO: update roles with proper scopes
ROLES = {
    "club_leader": ["read:requests", "create:requests", "cancel:requests",
                    "join:waitlist", "read:rooms", "send:messages", "post:forum"],
    "admin": ["handle:requests", "manage:rooms"],
    "venue_host": ["manage:rooms"],   
}