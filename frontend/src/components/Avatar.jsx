// person=true shows only the first letter of the first name; clubs show up to two initials
export default function Avatar({ name, size = 44, person = false }) {
  const words = (name || "?").trim().split(/\s+/);
  const initials = person ? words[0][0].toUpperCase() : words.map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:999, background:"var(--blue-wash)", color:"var(--link)", flexShrink:0,
      display:"grid", placeItems:"center", fontWeight:700, fontSize:size * 0.36 }}>{initials}</div>
  );
}
