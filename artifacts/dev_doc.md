# CampusReserve — Developer Documentation (Draft)

**CSE-416 Software Engineering | Fall 2026 | Stony Brook University**

CampusReserve is a web application designed to streamline room reservations, campus organization coordination, and administrative approvals for Stony Brook University (SBU) student organizations while maintaining synchronization with SBU's official booking system, **25Live**.

---

## 1. System Architecture

CampusReserve follows a decoupled three-tier architecture deployed on **Render**, backed by **PostgreSQL** (wrapped by **Supabase** for hosted database/realtime APIs):

```
[ React Frontend (Role Views + Accessibility Controls + Campus Map) ]
                                       │
                                 REST / JSON API
                                       │
[ Python / FastAPI Backend ] ──────────┼──► [ Brevo Service (Email Verification & Alerts) ]
  ├── Auth & RBAC (4 Roles + E-Board & Email Verification)
  ├── Real-Time Status Engine
  ├── Transactional Booking & Approval State Machine
  ├── Waitlist Engine
  └── Swappable 25Live Sync Adapter & CSV Exporter
                                       │
                               SQLAlchemy ORM (ACID)
                                       │
[ PostgreSQL / Supabase ] ◄────────────┴──► [ Mock / Production 25Live Target ]
```

### Tech Stack
* **Frontend:** React (responsive mobile-first UI, interactive SBU campus map, WCAG AA accessibility controls with contrast presets and simplification layer).
* **Backend:** Python 3.11+, FastAPI, SQLAlchemy ORM, Pydantic.
* **Database:** PostgreSQL (via Supabase) utilizing ACID transactions and database-level exclusion constraints to prevent double-bookings.
* **External Integrations:**
  * **Brevo API:** Email verification tokens and email notification delivery.
  * **25Live Adapter:** Swappable interface supporting a mock/test 25Live environment and 25Live-compliant CSV exports.
* **Hosting:** Render (frontend static site + FastAPI web service).

---

## 2. Core Engineering Guarantees & Workflows

### A. Role-Based Access Control (RBAC) & Authentication
CampusReserve enforces strict least-privilege access across four roles:
1. **`general_student`**: Authenticates via **username and password** (email optional). Scoped strictly to read-only endpoints (`GET` spaces, booked events, campus map). Can optionally link and verify an email address during account creation.
2. **`club_exec`**: Verified E-board officer of a registered SBU student organization. Leadership permissions are term-scoped. Can create booking requests, join waitlists, message users, and post on the collaboration forum.
3. **`venue_host`**
4. **`admin`**: Student Affairs / USG staff. Can verify leadership roles, approve/deny booking requests (with a required reason), access usage analytics, and trigger 25Live sync/CSV exports.

### B. Email Verification Flow (Brevo)
* Users (including General Students) may attach an email address to their account during account creation.
* Submitting an email generates a time-limited verification token dispatched via **Brevo**.
* `email_verified` defaults to `False`; the notification service filters out unverified addresses so external emails are never sent to unconfirmed recipients.

### C. Transactional Double-Booking Prevention
* PostgreSQL enforces non-overlapping approved bookings at the database level (using `tstzrange` exclusion constraints on `(room_id, time_range)` where `status = 'APPROVED'`).
* Approval endpoints wrap conflict checks and status updates in a single atomic SQLAlchemy transaction so concurrent administrator approvals cannot collide.

### D. Real-Time Room Status Engine
Room statuses evaluate dynamically across building closures, approved bookings, and pending requests:
* `AVAILABLE`: No active closure, approved booking, or pending request in the queried window.
* `REQUESTED`: At least one `PENDING` request exists for the slot.
* `UNBOOKABLE`: Restricted room.

---

## 3. Repository Structure

```text
campusreserve/
├── artifacts/               # Documentation and visual references
│   ├── mock-UI/
|   ├── approval_sequence_flow.png
|   ├── architecture-sketch.png
|   ├── deployed_sites.md
|   ├── design-document.md
|   ├── dev_doc.md
|   ├── frontend_screen_map.png
|   ├── functional-nonfunctional-requirements.md
|   ├── presentations.md
|   ├── proposal.md
|   ├── request_lifecycle_states.png
|   ├── stack-justification.md
|   ├── team-roles.md
|   ├── user_doc.md
│   └── user-quotes.md
├── frontend/
│   ├── public/             # Public resources
│   ├── src/
│   │   ├── a11y/
│   │   ├── components/
│   │   ├── data/
│   │   ├── pages/          # Role-specific dashboards
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   ├── responsive.css
│   │   ├── router.js
│   │   └── useMedia.js
│   ├── .oxlintrc.json
│   ├── index.html
│   ├── mockup.html
│   ├── package-lock.json
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── access_control/
│   ├── models/
│   ├── router/
│   ├── services/
│   ├── tests/
│   ├── tflive_integrations/
│   ├── authentication.py
│   ├── conftest.py
│   ├── create_tables.py
│   ├── database.py
│   ├── dev_rooms.py
│   ├── dev_setup.py
│   ├── main.py
│   └── seed_demo.py
├── CHANGELOG.md
├── README.md
└── WORKFLOW.md
```

---

## 4. Local Development Setup

### Prerequisites
* Node.js 18+ and npm
* Python 3.11+
* PostgreSQL 15+ (or a Supabase project connection string)
* Brevo API key (for testing email verification & alerts)

### 1. Backend Setup
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Set DATABASE_URL, SECRET_KEY, BREVO_API_KEY, and TWENTY_FIVE_LIVE_MODE=mock

# Run database migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Configure environment variables
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000

# Start development server
npm run dev
```

---

## 5. Phased Implementation Roadmap

| Phase | Target | Engineering Deliverables |
| :--- | :--- | :--- |
| **Phase 1 (MVP)** | M3 | 4-role RBAC (including General Student username/password auth); search/filter; real-time status engine; booking requests (with setup/cleanup buffers); admin approval with required reason; club request dashboard. |
| **Phase 2** | M4 | Pre-approved waitlist with automatic promotion on cancellation; Brevo email verification flow; inter-club/host/admin messaging. |
| **Phase 3** | M5 | Collaboration forum; Student Affairs analytics dashboard; WCAG AA contrast & simplification controls; 25Live sync adapter (test environment) & 25Live CSV export. |
| **Enhancements** | Future | Expanded automated email triggers via Brevo; direct production 25Live API integration. |

---

## 6. Team Workstreams

* **Kelly Fung** — *Frontend & Accessibility*: React UI across all four user roles, calendar/map views, WCAG AA contrast sets, and simplification layer.
* **Sarah Julian** — *Backend & Workflow*: Username/password & E-board authentication, RBAC, email verification flow, booking/approval state machine, real-time status engine, and waitlist logic.
* **Susan Qu** — *Data & Integration*: PostgreSQL/Supabase schema, concurrency constraints, swappable 25Live sync adapter, mock 25Live target, and 25Live-compliant CSV export.
* **Sarah Zhang** — *Notifications, Forum & Analytics*: Brevo integration, direct messaging, collaboration forum, and Student Affairs usage analytics.