import { useState } from 'react';

const EXT = ["jpg", "png", "webp"];
const EMOJI = { "Theater":"🎭", "Rehearsal space":"🎤", "Lecture hall":"🎓", "Lounge":"🛋️", "Meeting room":"📚" };

// Looks for public/rooms/<room id>.jpg (then .png, .webp); shows a placeholder until a photo exists.
export default function RoomPhoto({ room }) {
  const [i, setI] = useState(0);
  const box = { width:"100%", height:"100%", minHeight:150, borderRadius:10, border:"2px solid var(--ink)", overflow:"hidden",
    background:"linear-gradient(135deg, #FFE9A6, #FFC9B8)", display:"grid", placeItems:"center" };
  if (i >= EXT.length) {
    return (
      <div style={box} role="img" aria-label={`${room.name} layout photo coming soon`}>
        <div style={{ textAlign:"center", padding:8 }}>
          <div style={{ fontSize:34 }}>{EMOJI[room.type] || "🏫"}</div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--ink-soft)" }}>Layout photo coming soon</div>
        </div>
      </div>
    );
  }
  return (
    <div style={box}>
      <img src={`rooms/${room.id}.${EXT[i]}`} alt={`${room.name} layout`} onError={() => setI(i + 1)}
        style={{ width:"100%", height:"100%", objectFit:"cover" }} />
    </div>
  );
}
