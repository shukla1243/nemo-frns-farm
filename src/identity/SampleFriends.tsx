/**
 * TEST FIXTURE. Unverified sample Friends for the automated e2e suite. Loaded only when the app is
 * built or served with `--mode e2e` (VITE_SAMPLE_FRIENDS=1 in .env.e2e); production builds never
 * include this file. Sample progress is marked guest: it stays on the device and never publishes.
 */
import { useState } from "react";
import { loadSprites } from "../game/sprites";
import { FriendCard } from "./FriendCard";
import type { Identity } from "./Gate";

const SAMPLE_FRIENDS = ["1", "2", "100", "1000", "5000"];

export default function SampleFriends({ onEnter, onBack }: { onEnter: (id: Identity) => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(id: string) {
    setBusy(true); setError("");
    try {
      const sprites = await loadSprites(id);
      onEnter({ friendId: id, name: `Guest #${id}`, family: sprites.familyId, guest: true, account: null, provider: null });
    } catch {
      setError("Could not load artwork from Robinhood Chain. Check your connection and retry.");
    } finally { setBusy(false); }
  }
  return (
    <div className="gate-friends">
      <h2>Sample Friends (test build)</h2>
      <p className="hint">Automated test fixture. This build skips the wallet and ownership check and is never published.</p>
      <div className="friend-grid">{SAMPLE_FRIENDS.map(id => <FriendCard key={id} id={id} label={`Sample Friend #${id}`} sub="Test fixture · unverified" busy={busy} onPick={() => void pick(id)} />)}</div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn ghost" onClick={onBack}>Back</button>
    </div>
  );
}
