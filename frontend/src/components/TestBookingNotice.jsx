import { createPortal } from 'react-dom';
import ConfirmModal from './ConfirmModal.jsx';

// While CampusReserve can't write to 25Live, bookings made here are for testing only.
// Set this to false once we have write access and the notice disappears everywhere.
export const TEST_BOOKINGS_ONLY = true;
export const LIVE25_URL = "https://25live.collegenet.com/stonybrook";

// Shown every time someone sends a booking or joins a waitlist. "Continue test booking"
// still sends it to CampusReserve; nothing is reserved in 25Live.
export default function TestBookingNotice({ waitlist = false, onContinue, onCancel }) {
  return createPortal(
    <ConfirmModal title="Heads up: this is a test booking" confirmLabel={waitlist ? "Continue test waitlist" : "Continue test booking"}
      cancelLabel="Go back" onConfirm={onContinue} onCancel={onCancel}>
      <p style={{ margin:0, lineHeight:1.55 }}>
        CampusReserve doesn't have write access to 25Live yet, so this {waitlist ? "waitlist spot" : "booking"} won't
        reserve the room. You can still go ahead to try out how booking works here.</p>
      <p style={{ margin:"12px 0 0", lineHeight:1.55 }}>
        Keep using CampusReserve to search for spaces, then make the real reservation in 25Live.</p>
      <a href={LIVE25_URL} target="_blank" rel="noopener noreferrer"
        style={{ display:"inline-block", marginTop:12, color:"var(--link)", fontWeight:700, textDecoration:"underline" }}>
        Book in 25Live ↗<span className="sr-only"> (opens in a new tab)</span></a>
    </ConfirmModal>,
    document.body);
}
