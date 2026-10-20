# Technology Stack Justification

Our stack is chosen to match CampusReserve's actual demands: transactional booking correctness, a structured data model, an external system integration, and a REST API serving a React client.

## Frontend: React. 

CampusReserve is a multi-view application (search, booking, request dashboard, admin approval, forum) with interactive, stateful UI. React's component model suits this, is a widely supported frontend framework, and its ecosystem covers the accessibility controls we commit to (contrast sets, keyboard navigation) without custom infrastructure.

## Backend: Python with FastAPI.

Our backend is a REST API, which is FastAPI's core use case. We chose it over alternatives for three project-specific reasons: its Pydantic-based validation gives us automatic, declarative validation of booking inputs (dates, capacities, roles) - important for a system where malformed requests cause real conflicts; its dependency-injection and SecurityScopes support map directly onto our role-based access requirements (NFR-1, NFR-2); and its auto-generated interactive API documentation lets us demonstrate working endpoints at milestone reviews before the frontend is complete. Its async support also benefits our 25Live integration, where we wait on an external system.

## Database: PostgreSQL. 

We chose this database due to our emphasis on correctness. CampusReserve's core value is that a room is never double-booked and that availability is never falsely shown; these are transactional guarantees. Postgres's strong ACID transactions let us check for booking conflicts and commit an approval atomically, so two administrators approving overlapping requests concurrently cannot both succeed. Our data is also highly relational (users, organizations, venues, rooms, requests, waitlists), which fits a relational schema naturally, and Postgres offers advanced features we can grow into (exclusion constraints to enforce no-overlap at the database level). We considered a document database but concluded our data is structured and our correctness needs are transactional (Postgres's strengths, not a document store's).

## ORM: SQLAlchemy.

SQLAlchemy pairs idiomatically with FastAPI and Postgres, gives us typed model definitions matching our schema, and manages the transactions our booking logic depends on.

## External integration: a swappable 25Live adapter. 

Rather than committing to one access method to the university's system of record, we isolate all 25Live communication behind an adapter interface with interchangeable implementations (a mock/test target for development, and a real API or scraping implementation once access is confirmed). This lets us build and demo the full application regardless of whether production access is granted, and it keeps an unstable external dependency out of the rest of the codebase.

## Why this stack for this team. 

All four core technologies (React, FastAPI, Postgres, SQLAlchemy) are mature and heavily documented, which is a deliberate criterion given our development approach. These technologies do not lock us to a single platform or vendor. The stack lets each team member own a demonstrable layer (frontend, backend/workflow, data/integration, supporting services) and ship incrementally across the six milestones.
