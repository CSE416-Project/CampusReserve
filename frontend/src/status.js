// Label and colors for each room / request status. App settings, not data, so it lives outside mock.js.
export const STATUS = {
  available:{ label:"Available", fg:"var(--green)", bg:"var(--green-wash)" },
  requested:{ label:"Requested by another club", fg:"var(--amber)", bg:"var(--amber-wash)" },
  unavailable:{ label:"Not bookable", fg:"var(--slate)", bg:"var(--slate-wash)" },
  waitlisted:{ label:"On waitlist", fg:"var(--link)", bg:"var(--blue-wash)" },
  pending:{ label:"Pending review", fg:"var(--amber)", bg:"var(--amber-wash)" },
  approved:{ label:"Approved", fg:"var(--green)", bg:"var(--green-wash)" },
  denied:{ label:"Denied", fg:"var(--red)", bg:"var(--red-wash)" },
  cancelled:{ label:"Cancelled", fg:"var(--ink-soft)", bg:"var(--slate-wash)" },
};