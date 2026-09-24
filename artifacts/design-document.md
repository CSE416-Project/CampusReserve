# CampusReserve

**Design Document**
Milestone 2 — Design & Setup
CSE-416 Software Engineering · Fall 2026

## 1. Overview

CampusReserve is a room-booking platform for Stony Brook University student organizations, built as a friendlier, club-focused interface over the university's 25Live reservation system. This document describes the system design: architecture, data model, API, authorization, the 25Live integration, and the key design decisions behind them. It builds on the problem, users, and requirements established in the project proposal.

**Design goals.** Three goals drive the design:

- **Correctness** — a room is never double-booked, and availability is never falsely shown.
- **Clear role separation** — each type of user sees and does only what its role permits.
- **Resilience to external dependencies** — the app functions and demonstrates end-to-end, whether or not production 25Live access is granted.

## 2. System architecture

CampusReserve is a three-tier web application: a React frontend, a Python/FastAPI backend, and a PostgreSQL database, with all 25Live communication isolated behind a swappable adapter.

**Request flow.** The React client calls the FastAPI backend over a REST API secured with token-based authentication. The backend holds all business logic: authentication and role-based access, booking and approval workflow, the room-status engine, and the waitlist. It persists state in PostgreSQL via SQLAlchemy. When availability must reflect the university system of record, or an approved booking must be written back, the backend calls the 25Live adapter rather than an external system directly.

Components:

- **React frontend:** search, booking, request dashboard, admin approval, messaging, forum; accessibility controls (contrast sets, simplification layer).
- **FastAPI backend:** REST API; auth and scope enforcement; booking, approval, status, and waitlist services.
- **PostgreSQL:** relational store for users, organizations, venues, rooms, requests, messages, forum posts, and notifications.
- **25Live adapter:** an interface with interchangeable implementations — a mock/test target for development, and a real API or scraping implementation once access is confirmed.

A room request flow diagram is shown in the `artifacts` folder of this GitHub repository (`request_lifecycle_states.png`).

An admin approval flow diagram is shown in the `artifacts` folder of this GitHub repository (`approval_sequence_flow.png`).

## 3. Technology stack and justification

The stack is chosen to match CampusReserve's real demands: transactional booking correctness, a structured relational data model, an external integration, and a REST API serving a React client.

| Layer | Choice | Why |
|---|---|---|
| Frontend | React | Multi-view, stateful UI (search, dashboards, approval, forum); ecosystem covers our accessibility commitments. |
| Backend | Python + FastAPI | A REST API is FastAPI's core use case; Pydantic validation guards booking inputs; dependency injection and SecurityScopes map onto our role-based access; auto-generated API docs aid milestone demos; async suits the 25Live calls. |
| Database | PostgreSQL | Our most consequential choice, driven by correctness: ACID transactions let us check conflicts and commit an approval atomically, so concurrent approvals cannot both double-book. Our data is highly relational, and Postgres offers exclusion constraints to enforce no-overlap at the database level. |
| ORM | SQLAlchemy | Pairs idiomatically with FastAPI and Postgres; typed models matching our schema; manages the transactions our booking logic depends on. |

We initially considered a document database (MongoDB), but concluded that our data is highly structured and our core needs are transactional, which suits Postgres's strengths more than MongoDB. All four technologies are well-documented, which is a deliberate criterion given our development approach.

## 4. Data model

The schema is relational. Below are the core entities and their relationships; full column definitions live in the `models/` package in the repository.

### 4.1 Entities and relationships

- **User:** a person with an email, hashed password, name, and one role (`club_leader`, `admin`, or `venue_host`). A club leader links to one or more Organizations; a venue host links to one or more Venues.
- **Organization:** a registered student organization; has many leaders.
- **Venue:** a building or space; has many Rooms; linked to venue hosts.
- **Room:** the bookable unit; belongs to one Venue; carries a 25Live external reference.
- **Request:** a booking request — a Room, a requesting User and Organization, free start/end datetimes with optional setup/cleanup buffers, a status, an admin decision with reason, waitlist position, and 25Live sync state.
- **Message, ForumPost, Notification:** supporting communication features; ForumPost is self-referential for threaded replies.

### 4.2 Request lifecycle

A request moves through explicit states: `pending → approved / denied → (optionally) cancelled`, with a separate `waitlisted` state for contested slots. A separate sync-status field (`not_synced` / `synced` / `failed`) tracks whether an approved booking reached 25Live. This is kept distinct from the request status, so "approved locally" and "written to 25Live" remain separate states.

## 5. API design

The backend exposes a REST API. Representative endpoints (full set documented via FastAPI's generated OpenAPI docs):

| Method & path | Purpose | Required scope |
|---|---|---|
| POST /token | Log in, receive an access token | — |
| GET /rooms | Search and filter rooms with status | read:rooms |
| POST /requests | Submit a booking request | create:requests |
| GET /requests | List the user's organization's requests | read:requests |
| POST /requests/{id}/approve | Approve/deny with a reason | handle:requests |
| POST /rooms/{id}/waitlist | Join a room's waitlist | join:waitlist |
| GET /analytics | Room demand and usage | read:analytics |

Every protected endpoint declares the scope it requires; the backend checks the caller's scopes (derived from their role) before the handler runs. See Section 6.

A role-based user journey diagram is shown in the `artifacts` folder of this GitHub repository (`frontend_screen_map.png`).

## 6. Authentication and authorization

**Authentication.** Users log in with email and password; passwords are stored only as hashes. A successful login issues a signed access token carrying the user's identity. Each user has their own account that they log in with using their Stony Brook University email. An admin can assign the user to an organization that they are a leader of, in which users can book rooms on behalf of their organization.

**Authorization is scope-based.** Actions are gated by fine-grained scopes (e.g. `handle:requests`), and each role is granted a set of scopes. Endpoints declare the scope they need; the backend expands the caller's role into its scopes and checks the requirement. This indirection means endpoints never hard-code "admin only" and instead they require a scope, and which roles hold that scope is policy we can change centrally.

Roles and representative scopes:

| Role | Representative scopes beyond the shared read baseline |
|---|---|
| Club leader | create:requests, cancel:requests, join:waitlist, send:messages, post:forum |
| Venue host | manage:rooms, send:messages |
| Administrator | handle:requests, manage:rooms, manage:users, read:analytics, read:external-availability, sync:external-bookings |

This realizes the proposal's security requirements: role-based access (NFR-1), least privilege (NFR-2) (reads from a shared baseline while create/decide/manage powers are granted per role), and credential protection (NFR-3).

## 7. 25Live integration

All communication with 25Live is isolated behind an adapter interface with two core operations — read current availability, and push an approved booking — so the rest of the system never depends on how that communication happens.

**Access strategy.** We do not depend on production access for development. We build against a mock/test 25Live and treat a real API (or, if permitted, scraping) as a swappable implementation behind the same interface. This lets us build and demo the full application regardless of access, and swap in real integration without touching the rest of the codebase.

**Availability strategy.** We favor querying 25Live for availability rather than mirroring all of its data, to avoid the sync-drift that causes the very "misleading availability" problem CampusReserve aims to fix. Where performance requires caching, we re-verify against 25Live at the moment of approval — the one point where being wrong causes a double-booking.

**Failure handling.** If an approval succeeds locally but the push to 25Live fails, the request is marked with a failed sync state rather than silently diverging; those records are the target of a reconciliation step. Approving locally and writing externally are kept as distinct, individually-tracked outcomes.

## 8. Key design decisions

- **No double-booking.** Overlap prevention lives in the booking service, not just the schema. At approval time, within a database transaction, we check for any approved requests for the same room whose time window overlaps the new one, and commit the conflict check and the approval together. Postgres transactions make this atomic, so two administrators approving overlapping requests concurrently cannot both succeed. A database-level exclusion constraint is a planned hardening.
- **Rooms, not venues, are the bookable unit.** A venue (building) contains rooms; bookings target rooms. This matches how organizations actually reserve space and keeps availability granular.
- **Free datetimes, not fixed slots.** Requests carry free start/end times plus optional setup/cleanup buffers, so events of any length are expressible and the room can be blocked for the padded window.
- **Single users table with role-specific links.** All three roles share one users table with a role field; role-specific relationships (organization for leaders, venues for hosts) are nullable links rather than separate user tables, keeping authentication uniform.