import { useState } from 'react';

const API = import.meta.env.VITE_API_URL;
const EXT = ["jpg", "png", "webp"];
const EMOJI = { "Theater":"🎭", "Rehearsal space":"🎤", "Lecture hall":"🎓", "Lounge":"🛋️", "Meeting room":"📚" };

// Tries public/rooms/<id>.jpg/.png/.webp, then the room's 25Live photo from the API,
// then shows a placeholder.
export default function RoomPhoto({ room }) {
  const sources = [
    ...EXT.map(ext => `/rooms/${room.id}.${ext}`),
    ...(/^\d+$/.test(room.id) ? [`${API}/rooms/${room.id}/photo`] : []),  // 25Live rooms only
  ];
  const [i, setI] = useState(0);
  const box = { width:"100%", height:"100%", minHeight:150, borderRadius:10, border:"2px solid var(--ink)", overflow:"hidden",
    background:"linear-gradient(135deg, #FFE9A6, #FFC9B8)", display:"grid", placeItems:"center" };

  if (i >= sources.length) {
    return (
      <div style={box} role="img" aria-label={`${room.name} layout photo coming soon`}>
        <div style={{ textAlign:"center", padding:8 }}>
          <div style={{ fontSize:34 }}>{EMOJI[room.room_type ?? room.type] || "🏫"}</div>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--ink-soft)" }}>Layout photo coming soon</div>
        </div>
      </div>
    );
  }
  return (
    <div style={box}>
      <img key={sources[i]} src={sources[i]} alt={`${room.name} layout`} loading="lazy"
        onError={() => setI(i + 1)} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
    </div>
  );
}