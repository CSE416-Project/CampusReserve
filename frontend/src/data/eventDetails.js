// The extra details a booking request carries (what 25Live's request form asks).
// The KEYS below must match EVENT_QUESTIONS in server/services/request_details.py;
// the server rejects any key it doesn't know.
//
// 25Live shows 13 yes/no toggles in one long list. We ask "What will your event
// include?" instead: grouped, all unticked, so a club only touches what applies.

export const DEFAULT_EVENT_TYPE = "Student - Program";   // 25Live's default for club events
export const MAX_CO_HOSTS = 5;                            // server limit (MAX_CO_HOSTS)

export const QUESTION_GROUPS = [
  { title: "Food & sales", items: [
    { key: "selling", label: "Selling anything" },
    { key: "food", label: "Serving food" },
  ]},
  { title: "Tech & performance", items: [
    { key: "av", label: "A/V (projector, screen, sound)" },
    { key: "live_performance", label: "Live performance" },
    { key: "dj", label: "DJ" },
    { key: "special_lighting", label: "Special lighting" },
    { key: "electrical", label: "Electrical access" },
    { key: "photo_booth", label: "Photo booth" },
    { key: "photographer", label: "Photographer or videographer" },
  ]},
  { title: "Activities & setup", items: [
    { key: "guest_speaker", label: "Guest speaker" },
    { key: "art_crafts", label: "Art or crafting activities" },
    { key: "special_setup", label: "Special room setup" },
  ]},
  { title: "Safety", items: [
    { key: "minors", label: "Minors from off-campus (16 and under)" },
  ]},
];

export const QUESTION_LABELS = Object.fromEntries(QUESTION_GROUPS.flatMap(g => g.items.map(i => [i.key, i.label])));

// Everything unticked: sent as {} / all false.
export const emptyQuestions = () => Object.fromEntries(Object.keys(QUESTION_LABELS).map(k => [k, false]));

// What a request shows on My requests / Approvals. `d` is the drawer's details object
// (see BookingDrawer) -- used for mock mode; api.adaptRequest produces the same shape from the server.
export function displayDetails(d = {}) {
  return {
    answered: true,   // the requester filled in the "What will your event include?" questions
    headcount: d.headcount || null,
    description: d.description || "",
    eventType: d.eventType || DEFAULT_EVENT_TYPE,
    includes: Object.keys(QUESTION_LABELS).filter(k => d.questions?.[k]).map(k => QUESTION_LABELS[k]),
    coHosts: d.coHostNames || [],
    advisor: d.advisor || "",
  };
}

// ---- the booking form's state --------------------------------------------------------------
export const emptyDetails = () => ({ headcount: "", description: "", questions: emptyQuestions(), coHosts: [], advisor: "", advisorTouched: false, policyAgreed: false });

// What still blocks sending the request (empty string = nothing). cap = the room's capacity.
export function detailsBlocker(d, cap) {
  const hc = /^\d+$/.test(d.headcount.trim()) ? Number(d.headcount.trim()) : NaN;
  if (!(hc >= 1)) return "Add the expected attendance";
  if (cap > 0 && hc > cap) return `Lower the attendance: this room holds ${cap}`;
  if (!d.description.trim()) return "Describe your event";
  if (!d.policyAgreed) return "Agree to the building policies";
  return "";
}

// The shape api.requestBody() and displayDetails() take. A club can't co-host with itself.
export function detailsPayload(d, org) {
  const hosts = d.coHosts.filter(c => c.name !== org);
  return { headcount: Number(d.headcount.trim()) || null, description: d.description.trim(), questions: d.questions,
    coHostIds: hosts.map(c => c.id).filter(Boolean), coHostNames: hosts.map(c => c.name), advisor: d.advisor.trim(), policyAgreed: d.policyAgreed };
}
