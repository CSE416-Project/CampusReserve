# CampusReserve

**Design Document**
CSE-416 Software Engineering · Fall 2026

## 1. Overview

CampusReserve is a room-booking platform for Stony Brook University student organizations, built as a friendlier, club-focused interface over the university's 25Live reservation system. This document describes the system design: architecture, data model, API, authorization, the 25Live integration, deployment and testing, and the key design decisions behind them. It builds on the problem, users, and requirements established in the project proposal.

**Design goals.** Three goals drive the design:

- **Correctness** — a room is never double-booked, and availability is never falsely shown.
- **Clear role separation** — each type of user sees and does only what its role and verified memberships permit.
- **Resilience to external dependencies** — the app functions and demonstrates end-to-end, whether or not production 25Live write access is granted.

## 2. System architecture

CampusReserve is a three-tier web application: a React frontend, a Python/FastAPI backend, and a PostgreSQL database, with all 25Live communication isolated behind a service layer and a swappable sync provider.

**Request flow.** The React client calls the FastAPI backend over a REST API secured with token-based authentication. The backend holds all business logic: authentication, role- and membership-based access, the booking and approval workflow, availability checks, closures, the waitlist, and notifications. It persists state in PostgreSQL via SQLAlchemy. When availability must reflect the university system of record, the backend reads 25Live's guest-visible data through the `live25` service; when an approved booking must be written back, it goes through the sync provider rather than calling 25Live directly.

Components:

- **React frontend:** room search and filters, room schedules, booking and request dashboard, waitlist, admin review and sync queues, notifications, messaging, forum; accessibility controls (contrast sets, simplification layer).
- **FastAPI backend:** REST API organized into routers (`auth`, `rooms`, `requests`, `waitlist`, `organizations`, `notifications`, `me`, `admin`); auth and scope enforcement; booking, approval, availability, waitlist, and notification services.
- **PostgreSQL:** relational store for users, organizations and memberships, venues, rooms, closures, requests, notifications, messages, and forum posts.
- **25Live integration:** a read service (`live25`) for rooms, room details, photos, and bookings, backed by a cache with a background refresh; and a sync provider with two interchangeable modes — **manual** (an admin enters the booking in 25Live, guided by generated instructions) and **api** (automatic push once write access is confirmed).

A room request flow diagram is shown in the `artifacts` folder of this GitHub repository (`request_lifecycle_states.png`).

An admin approval flow diagram is shown in the `artifacts` folder of this GitHub repository (`approval_sequence_flow.png`).

## 3. Technology stack and justification

The stack is chosen to match CampusReserve's real demands: transactional booking correctness, a structured relational data model, an external integration, and a REST API serving a React client.

| Layer | Choice | Why |
|---|---|---|
| Frontend | React (Vite) | Multi-view, stateful UI (search, dashboards, approval, forum); ecosystem covers our accessibility commitments. |
| Backend | Python + FastAPI | A REST API is FastAPI's core use case; Pydantic validation guards booking inputs; dependency injection and SecurityScopes map onto our role-based access; auto-generated API docs aid milestone demos; async lets us query 25Live for many rooms concurrently. |
| Database | PostgreSQL | Our most consequential choice, driven by correctness: ACID transactions let us check conflicts and commit an approval atomically, and a Postgres exclusion constraint enforces no-overlap at the database level, so concurrent approvals cannot both double-book. Our data is highly relational. |
| ORM | SQLAlchemy | Pairs idiomatically with FastAPI and Postgres; typed models matching our schema; manages the transactions our booking logic depends on. |
| Hosting | Supabase (database), Render (backend and frontend) | Managed Postgres and Git-based deploys on free tiers, with no servers for the team to maintain. |

We initially considered a document database (MongoDB), but concluded that our data is highly structured and our core needs are transactional, which suits Postgres's strengths more than MongoDB. All of these technologies are well-documented, which is a deliberate criterion given our development approach.

## 4. Data model

The schema is relational. Below are the core entities and their relationships; full column definitions live in the `models/` package in the repository.

### 4.1 Entities and relationships

- **User:** a person with an email, hashed password, name, one role (`club_leader`, `admin`, or `venue_host`), and an active flag (admins deactivate users rather than deleting them). A venue host links to one or more Venues.
- **Organization:** a registered student organization, seeded from the SB Engaged group directory; has many members.
- **OrganizationMember:** links a User to an Organization, with a position title, a term start and optional term end, and verification (when and by which admin). Only verified members whose term has not ended can book for the organization.
- **Venue:** a building or space; has many Rooms; linked to venue hosts.
- **Room:** the bookable unit; belongs to one Venue; carries a 25Live external reference (the 25Live space id), capacity, room type, feature tags (e.g. food allowed, projector), a photo URL, whether clubs may book it, an active flag, and how many days ahead its booking window opens. Rooms are imported from 25Live on demand or in bulk by an admin.
- **RoomClosure:** a period when a single room or a whole venue is closed (maintenance, holidays), with a reason shown to users.
- **Request:** a booking request — a Room, a requesting User and Organization, an event name, expected attendance, free start/end datetimes with optional setup/cleanup buffers, a status, an admin decision with reason, waitlist position, and 25Live sync state with the 25Live booking reference.
- **Notification:** an in-app message to one user (e.g. a decision on a request, or a membership verified), optionally linked to a Request, with a read flag; each is also emailed.
- **Message, ForumPost:** supporting communication features; ForumPost is self-referential for threaded replies.

### 4.2 Request lifecycle

A request moves through explicit states: `pending → approved / denied → (optionally) cancelled`, with a separate `waitlisted` state for contested slots. A request joins the waitlist when its slot is taken and the requester opts in, or automatically when an admin approves an overlapping request. When an approved booking is cancelled, the waitlist is promoted. A separate sync-status field (`not_synced` / `synced` / `failed`) tracks whether an approved booking reached 25Live. This is kept distinct from the request status, so "approved locally" and "written to 25Live" remain separate states.

## 5. API design

The backend exposes a REST API. Representative endpoints (full set documented via FastAPI's generated OpenAPI docs at `/docs`):

| Method & path | Purpose | Required scope |
|---|---|---|
| POST /auth/register | Create an account (starts as an unverified club leader) | — |
| POST /auth/token | Log in, receive an access token | — |
| GET /rooms | List rooms (25Live and ours, merged) with pending and waitlist counts | read:rooms |
| GET /rooms/search | Rooms free for a time window that match capacity and feature filters | read:rooms |
| GET /rooms/{id}/schedule | A room's 25Live bookings plus our requests, waitlist, and closures | read:rooms |
| POST /organizations/{id}/join | Ask to be verified as an organization's E-board member | — |
| POST /requests/check | Dry run: would this booking work, and why not | read:rooms |
| POST /requests | Submit a booking request (optionally joining the waitlist if taken) | create:requests |
| GET /requests | List your organizations' requests and your own | read:requests |
| POST /requests/{id}/approve | Approve a request; overlapping requests move to the waitlist | handle:requests |
| POST /requests/{id}/deny | Deny a request with a required reason | handle:requests |
| POST /requests/{id}/waitlist | Join the waitlist for a taken slot | join:waitlist |
| GET /waitlist/mine | Your place in each line | read:waitlist |
| GET /notifications | Your notifications, newest first | — |
| GET /admin/requests | Review queue, with a fresh conflict check per request | handle:requests |
| GET /admin/sync | Approved bookings not yet in 25Live, with entry instructions | sync:external-bookings |
| POST /admin/closures | Close a room or building for a period | manage:rooms |
| POST /admin/organizations/{org}/members/{user}/verify | Verify an E-board member | manage:users |
| GET /analytics | Room demand and usage | read:analytics |

Every protected endpoint declares the scope it requires; the backend checks the caller's scopes (derived from their role) before the handler runs, then checks membership or venue rules where they apply. See Section 6.

A role-based user journey diagram is shown in the `artifacts` folder of this GitHub repository (`frontend_screen_map.png`).

## 6. Authentication and authorization

**Authentication.** Users register and log in with email and password; passwords are stored only as hashes. A successful login issues a signed access token carrying the user's identity and scopes. Each user has their own account, registered with their Stony Brook University email. A new account starts as an unverified club leader: the user asks to join their organization, admins are notified, and once an admin verifies them (with an optional term end), they can book rooms on behalf of that organization. Role changes take effect at the user's next login, and deactivated users are locked out.

**Authorization is scope-based.** Actions are gated by fine-grained scopes (e.g. `handle:requests`), and each role is granted a set of scopes. Endpoints declare the scope they need; the backend expands the caller's role into its scopes and checks the requirement. This indirection means endpoints never hard-code "admin only" and instead they require a scope, and which roles hold that scope is policy we can change centrally.

Scopes are combined with two data-level checks:

- **Membership:** a club leader can submit, edit, cancel, or waitlist requests only for organizations where they are a verified member whose term has not ended. Requests from other organizations are not visible (they return 404, so their existence isn't revealed).
- **Venue hosting:** a venue host's `manage:rooms` applies only to rooms in venues they host.

Roles and representative scopes:

| Role | Representative scopes beyond the shared read baseline |
|---|---|
| Club leader | create:requests, cancel:requests, join:waitlist, send:messages, post:forum |
| Venue host | manage:rooms (own venues only), send:messages |
| Administrator | handle:requests, manage:rooms, manage:users, read:analytics, read:external-availability, sync:external-bookings |

The shared read baseline includes `read:rooms`, `read:requests`, and `read:waitlist`.

**Calendar feed.** Users can subscribe to their organizations' approved bookings in Google or Apple Calendar through a private `.ics` link. Because calendar apps cannot log in, the link carries its own signed key, which is accepted only by the calendar feed and stops working if the user is deactivated.

This realizes the proposal's security requirements: role-based access with verified E-board membership (NFR-1), least privilege with term-limited access (NFR-2) (reads from a shared baseline while create/decide/manage powers are granted per role and membership), and credential protection (NFR-3).

## 7. 25Live integration

All communication with 25Live is isolated behind two pieces — a read service for availability and room data, and a sync provider for writing bookings — so the rest of the system never depends on how that communication happens.

**Reading.** The `live25` service reads 25Live's guest-visible data: rooms, room details (equipment, hours, rules, location, photos), and bookings. Room lists merge 25Live's rooms with our own configuration (feature tags, bookability, booking windows), so admins can adjust rooms without changing 25Live. Rooms are imported into our database on first use or in bulk by an admin; existing rooms and admins' edits are never overwritten by a re-import.

**Availability strategy.** We favor querying 25Live for availability rather than mirroring all of its data, to avoid the sync-drift that causes the very "misleading availability" problem CampusReserve aims to fix. A background refresh caches the next month of bookings so searches stay fast. A room is shown as unavailable for a window if it overlaps a 25Live event (including setup and teardown) or closed hours, one of our approved bookings that has not reached 25Live yet, or a room or building closure, or if the room's booking window hasn't opened. Pending requests don't block a room; they are reported so users know they may be competing for it. If 25Live can't be checked for a room, that room is left out rather than shown as free. At the moment of approval, we re-verify strictly against 25Live and our own bookings — the one point where being wrong causes a double-booking.

**Writing.** Approved bookings and cancellations go through the sync provider. In **manual** mode (the default while write access is pending), the provider returns step-by-step instructions; an admin enters the booking in 25Live and records its 25Live reference, which marks it synced. In **api** mode, the provider pushes automatically. Both modes return the same result shape, so switching modes requires no other changes.

**Failure handling.** If an approval succeeds locally but the push to 25Live fails, the request is marked with a failed sync state rather than silently diverging. The admin sync queue lists every approved booking that is not yet synced or failed, soonest first, and an admin can retry or confirm each one. Approving locally and writing externally are kept as distinct, individually-tracked outcomes.

## 8. Key design decisions

- **No double-booking.** Overlap prevention is enforced in two layers. At approval time, within a database transaction, the booking service checks for conflicting bookings (ours and 25Live's) and commits the check and the approval together, moving overlapping pending requests to the waitlist. Underneath, a Postgres exclusion constraint (using the `btree_gist` extension) rejects any two approved requests for the same room whose padded time windows overlap, so even concurrent approvals or a bug in the service cannot double-book.
- **Rooms, not venues, are the bookable unit.** A venue (building) contains rooms; bookings target rooms. This matches how organizations actually reserve space and keeps availability granular. Closures can target either level.
- **Free datetimes, not fixed slots.** Requests carry free start/end times plus optional setup/cleanup buffers, so events of any length are expressible and the room can be blocked for the padded window.
- **Single users table, with memberships as their own table.** All three roles share one users table with a role field, keeping authentication uniform. Organization membership lives in a separate table because one user can belong to several organizations, and each membership has its own verification and term.
- **Verification separate from role.** Being a club leader grants the ability to request rooms in general; being a verified, current member of a specific organization grants the ability to book for it. Ended terms keep their history but stop granting access.
- **Database rules back up the application.** Check constraints require, for example, that denied requests carry a reason and waitlisted requests carry a position, so invalid states can't be written even by code paths that skip the service layer.
- **Closures don't cancel bookings automatically.** Creating a closure lists the bookings it affects so an admin can contact or cancel them, rather than silently cancelling events.
- **Private waitlists.** Anyone can see how long a room's line is and when people are waiting, but other organizations' event names and identities stay hidden.

## 9. Deployment and testing

**Deployment.** The database is a managed Supabase Postgres instance, reached through its session pooler. The backend runs as a Render web service started with Uvicorn, and the React frontend is built with Vite and served as a Render static site, configured with the backend's URL and allowed through the backend's CORS settings. Secrets (the database URL and JWT signing key) are set as environment variables on Render and never committed. Render redeploys automatically from `main`.

**Testing.** A pytest suite covers every router — authentication, rooms, requests, waitlist, organizations, notifications, the calendar feed, and admin functions — including permission rules, conflict handling, and the 25Live integration (with 25Live replaced by test fakes). Tests run against a real, throwaway Postgres database, because the exclusion constraint and other Postgres features are part of what's being tested, and each test is rolled back so tests don't affect each other. GitHub Actions runs linting (ruff), the test suite against a fresh Postgres service container, and the frontend build on every push to `main` and every pull request.
