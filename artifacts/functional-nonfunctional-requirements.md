# Requirements

As mentioned in the proposal, here are the functional and non functional requirements of this project.

## Functional Requirements

**FR-1 — Search & filter.** Users can search and filter spaces by building, capacity, type, and features relevant to student events.
*Why:* leaders told us 25Live's search is "hard to search and look through" and helpful filtering options are hidden — so we prioritize the filters useful to club events rather than the full academic-scheduling set.

**FR-2 — Real-time room status.** Each space displays a real-time status of available, requested (pending another group's approval), or unbookable, with the reason shown for unbookable spaces.
*Why:* leaders reported — "we booked so many events that got denied because we weren't allowed to book those spaces and had no idea since they were listed as available." Rooms still showed as bookable during building closures in 25Live. A status feature ensures a more efficient booking process for clubs.

**FR-3 — Booking requests.** A club leader can submit a booking request for an available time slot, including setup and cleanup time.
*Why:* leaders said essential options "like setup and cleanup time are hidden" in 25Live; surfacing them in the main booking flow helps the club gauge the time and make a smoother transition of the room.

**FR-4 — Request dashboard.** A club leader can view all of their organization's requests and their statuses in one place.
*Why:* it was a direct request — "one thing that I really do hate is that I can't see all of my requests in one place."

**FR-5 — Approval workflow.** An administrator can approve or deny a request and must provide a reason, which is communicated to the requester.
*Why:* leaders are currently left guessing why events are denied. Requiring a stated reason makes the decision transparent and reduces the back-and-forth that delays events.

**FR-6 — Waitlist.** A leader can join a waitlist for a fully-booked popular space; the next waitlisted (pre-approved) request is promoted automatically when a booking is cancelled.
*Why:* popular spaces sit empty when an event is cancelled because there is no way to claim the freed slot. A pre-approved waitlist means availability is not wasted and the next group can proceed without waiting on another approval cycle.

**FR-7 — Notifications.** Users receive notifications on request approval, denial, waitlist promotion, and new messages (in-app for MVP; email as an enhancement).
*Why:* 25Live has no reliable notification system, which leaders said causes "lack of information and communication," creating delays and unnecessary stress. Timely notifications close that gap.

**FR-8 — Messaging.** Users can message other organizations, venues, and administrators to coordinate shared use of spaces.
*Why:* there is no way to communicate through 25Live, so groups sharing a space "could have resolved issues with planning ahead of time rather than figuring it out during our event time." Direct messaging lets them coordinate.

**FR-9 — Collaboration forum.** Users can post to a forum to propose collaborations and offer or request shared resources and storage.
*Why:* organizations often want to collaborate or share resources and storage, but have no common space to make those requests. The forum creates that space.

**FR-10 — Room detail.** Each space has a detailed view with its features and a visual preview of the room.
*Why:* leaders frequently don't have a full grasp of what a space offers or what events it can support. A detailed view with a visual preview helps them understand what they're working with before they commit.

**FR-11 — 25Live sync.** Confirmed bookings are reconciled with the 25Live system of record through a sync layer.
*Why:* 25Live remains the university's system of record and ties into the Registrar's academic scheduling. Syncing to it — rather than replacing it — means our bookings don't collide with academic reservations and administrators keep one authoritative source of truth.

**FR-12 — Analytics.** Administrators can view analytics on room demand, peak booking times, and usage patterns.
*Why:* requested directly by Student Affairs (Ahmed Belazi, Executive Director for Strategic Analytics and Technologies). Administrators need to see how spaces are used to allocate them well and to confirm that the technology spend is justified. Since SBU is our client, this helps our stakeholders make decisions and feel confident in the platform.

## Non-Functional Requirements

**Security and privacy.** These requirements stem directly from Student Affairs feedback, which prioritizes confidentiality.

- **NFR-1 — Role-based access.** Each role can access only the data and actions its role permits; E-board membership is verified before a leader gains booking rights.
- **NFR-2 — Least privilege.** Access is scoped to what a user needs and for only as long as they need it (e.g., leadership rights tied to a current term).
- **NFR-3 — Credential protection.** Passwords, sessions, and user data are hashed and protected so that confidential information is not exposed across organizations.

**Accessibility.** Student Affairs would like our application to consider identity, linguistic, disability, learning, and neurodivergent needs.

- **NFR-4 — Contrast controls.** Users can choose among color/contrast sets rather than a single fixed theme for visual impairments.
- **NFR-5 — Simplification layer.** A simplified view reduces on-screen complexity for users who need it.
- **NFR-6 — Standards.** The interface incorporates WCAG AA: keyboard navigability, visible focus, screen-reader labels, and sufficient contrast by default.

**Performance and reliability.**

- **NFR-7 — Status latency.** A change in a room's status is reflected to other users within a few seconds.
- **NFR-8 — No false availability.** The system never shows a space as freely bookable when it has a pending request or is closed.