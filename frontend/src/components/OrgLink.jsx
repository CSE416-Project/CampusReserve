import { CLUBS } from '../data/mock.js';

// names of clubs that have a profile page (App keeps this in sync with the clubs it loaded)
let known = new Set(CLUBS.map(c => c.name));
export const setKnownClubs = names => { known = new Set(names); };

export default function OrgLink({ name, onOpen }) {
  if (!onOpen || !known.has(name)) return <>{name}</>;
  return (
    <button onClick={e => { e.stopPropagation(); onOpen(name); }}
      style={{ color:"var(--link)", font:"inherit", fontWeight:"inherit", textAlign:"left", textDecoration:"underline",
        textDecorationColor:"var(--blue-wash)", textUnderlineOffset:3 }}>{name}</button>
  );
}
