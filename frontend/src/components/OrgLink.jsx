import { CLUBS } from '../data/mock.js';

export default function OrgLink({ name, onOpen }) {
  if (!onOpen || !CLUBS.some(c => c.name === name)) return <>{name}</>;
  return (
    <button onClick={e => { e.stopPropagation(); onOpen(name); }}
      style={{ color:"var(--link)", font:"inherit", fontWeight:"inherit", textAlign:"left", textDecoration:"underline",
        textDecorationColor:"var(--blue-wash)", textUnderlineOffset:3 }}>{name}</button>
  );
}
