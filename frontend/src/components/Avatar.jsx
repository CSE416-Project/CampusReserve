export default function Avatar({ name, size = 44 }) {
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:999, background:"var(--blue-wash)", color:"var(--blue)", flexShrink:0,
      display:"grid", placeItems:"center", fontWeight:700, fontSize:size * 0.36 }}>{initials}</div>
  );
}
