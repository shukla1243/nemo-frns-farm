import { useEffect, useState } from "react";
import { loadSprites, portrait } from "../game/sprites";
import { TRAITS } from "../engine/config";

/** A pickable Friend: canonical portrait, label and family trait. */
export function FriendCard({ id, label, sub, onPick, busy }: { id: string; label: string; sub: string; onPick: () => void; busy: boolean }) {
  const [img, setImg] = useState<string | null>(null);
  const [family, setFamily] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    loadSprites(id).then(s => { if (live) { setImg(portrait(s, 72)); setFamily(s.familyId); } }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  const trait = family === null ? null : TRAITS[family % TRAITS.length];
  return (
    <button type="button" className="friend-card pbtn" onClick={onPick} disabled={busy}>
      <span className="friend-card-art frame-slot">{img ? <img src={img} alt="" /> : <span className="spinner" aria-hidden />}</span>
      <span className="friend-card-text">
        <strong>{label}</strong>
        <small>{sub}</small>
        {trait && <small className="trait-chip">{trait.family} · {trait.name}</small>}
      </span>
    </button>
  );
}
