/**
 * Entry gate. Uses FriendSDK for wallet discovery/connection, owned-Friend discovery and the
 * fresh on-chain eligibility check (generation >= 1 hardwired Generations NFT on Robinhood 4663).
 * Guest demo mode is clearly labelled and never publishes to leaderboards.
 */
import { useEffect, useMemo, useState } from "react";
import { createFriendPublicClient, createFriendWalletSession, type FriendWalletSnapshot } from "@rarefriends/friendsdk/wallet";
import { readOwnedFriends, type OwnedFriend } from "@rarefriends/friendsdk/owned";
import { readGenerationEligibility } from "@rarefriends/friendsdk/identity";
import { loadSprites, portrait } from "../game/sprites";
import { TRAITS } from "../engine/config";
import { Icon, SpriteImg } from "../ui/Icon";
import { home, palm, shrine } from "../art/sprites";
import { waterPattern } from "../art/tiles";

export type Identity = {
  friendId: string; name: string; family: number; guest: boolean;
  account: string | null; provider: { request(args: { method: string; params?: unknown[] | object }): Promise<unknown> } | null;
};

const GUEST_FRIENDS = ["1", "2", "100", "1000", "5000"];
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function FriendCard({ id, label, sub, onPick, busy }: { id: string; label: string; sub: string; onPick: () => void; busy: boolean }) {
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

export function Gate({ onEnter }: { onEnter: (id: Identity) => void }) {
  const session = useMemo(() => createFriendWalletSession(), []);
  const publicClient = useMemo(() => createFriendPublicClient(), []);
  const [snap, setSnap] = useState<FriendWalletSnapshot>(session.getSnapshot());
  const [friends, setFriends] = useState<readonly OwnedFriend[] | null>(null);
  const [hidden, setHidden] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const off = session.subscribe(() => setSnap(session.getSnapshot()));
    const t = setTimeout(() => setSnap(session.getSnapshot()), 300); // EIP-6963 announcements
    return () => { off(); clearTimeout(t); };
  }, [session]);

  // Discover owned Friends whenever the account changes.
  useEffect(() => {
    setFriends(null); setError("");
    if (!snap.account) return;
    const ctrl = new AbortController();
    setStatus("Finding your Rare Friends on Robinhood Chain…");
    readOwnedFriends(publicClient, snap.account, { signal: ctrl.signal })
      .then(r => { setFriends(r.friends); setHidden(r.hiddenCount); setStatus(""); })
      .catch(e => { if (!ctrl.signal.aborted) { setStatus(""); setError(`Could not load your Friends: ${e?.shortMessage ?? e?.message ?? e}`); } });
    return () => ctrl.abort();
  }, [snap.account, snap.revision, publicClient, retry]);

  async function pick(f: OwnedFriend) {
    if (!snap.account) return;
    setBusy(true); setError(""); setStatus(`Verifying Friend #${f.id} ownership at the latest block…`);
    try {
      const check = await readGenerationEligibility(publicClient, f.id, snap.account);
      if (check.eligible !== true) throw new Error(check.hardwired ? "This wallet no longer owns that Friend." : "Only hardwired Friends (generation 1+) can play.");
      const sprites = await loadSprites(f.id.toString());
      onEnter({ friendId: f.id.toString(), name: f.label || `Friend #${f.id}`, family: sprites.familyId, guest: false, account: snap.account, provider: session.getProvider() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed. Try again.");
    } finally { setBusy(false); setStatus(""); }
  }

  async function pickGuest(id: string) {
    setBusy(true); setError(""); setStatus("Loading guest Friend artwork…");
    try {
      const sprites = await loadSprites(id);
      onEnter({ friendId: id, name: `Guest #${id}`, family: sprites.familyId, guest: true, account: null, provider: null });
    } catch {
      setError("Could not load artwork from Robinhood Chain. Check your connection and retry.");
    } finally { setBusy(false); setStatus(""); }
  }

  const connecting = snap.status === "connecting" || snap.status === "switching-network";
  return (
    <main className="gate">
      <div className="gate-sea" aria-hidden style={{ backgroundImage: `url(${waterPattern()})` }}>{Array.from({ length: 8 }, (_, i) => <span key={i} className="gate-fish" style={{ top: `${6 + i * 12}%`, animationDuration: `${11 + (i % 4) * 3}s`, animationDelay: `${-i * 2.3}s` }}><Icon id={["clownfish", "sardine", "tuna", "clownfish", "goldnemo", "sardine", "clownfish", "angler"][i]} size={40} /></span>)}</div>
      <section className="gate-card frame-panel">
        <div className="logo-art" aria-hidden><SpriteImg sprite={palm(0)} name="palm0" height={64} /><SpriteImg sprite={home(0)} name="home0" height={48} /><SpriteImg sprite={shrine()} name="shrine" height={52} /><SpriteImg sprite={palm(1)} name="palm1" height={60} /></div>
        <h1 className="logo">NEMO<span>FRNS FARM</span></h1>
        <p className="tagline">Raise your Rare Friend, grow a pixel island, and risk it all with players online.</p>
        <ul className="gate-pills" aria-label="Features">
          <li className="frame-paper"><Icon id="home" size={22} />Build & expand</li><li className="frame-paper"><Icon id="rod" size={22} />Fish, mine, dive</li><li className="frame-paper"><Icon id="sword" size={22} />Raid real players</li><li className="frame-paper"><Icon id="angler" size={22} />World boss</li><li className="frame-paper"><Icon id="trophy" size={22} />Weekly prize pool</li>
        </ul>

        {!guestMode && !snap.account && (
          <div className="gate-actions">
            {snap.wallets.length > 1 ? snap.wallets.map(w => (
              <button key={w.id} type="button" className="btn primary" disabled={connecting} onClick={() => void session.connect(w.id)}>Connect {w.name}</button>
            )) : (
              <button type="button" className="btn primary big" disabled={connecting} onClick={() => void session.connect()}>
                {connecting ? "Check your wallet…" : "Connect wallet"}
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => setGuestMode(true)}>Try as guest (demo)</button>
            {snap.status === "unavailable" && <p className="hint">No wallet found. On phones, open this page inside your wallet app's browser (MetaMask, Rabby, Coinbase Wallet…).</p>}
          </div>
        )}

        {snap.error && <p className="error" role="alert">{snap.error}</p>}

        {!guestMode && snap.account && (
          <div className="gate-friends">
            <p className="hint">Connected {short(snap.account)} {snap.status === "wrong-network" && <>· <button type="button" className="link" onClick={() => void session.switchNetwork()}>Switch to Robinhood</button></>} · <button type="button" className="link" onClick={() => session.disconnect()}>Disconnect</button></p>
            {friends === null && !error && <p className="status"><span className="spinner" /> {status || "Loading…"}</p>}
            {friends && friends.length === 0 && <p className="error">No playable Friends in this wallet{hidden ? ` (${hidden} generation-0 Friend${hidden > 1 ? "s are" : " is"} hidden: play needs a hardwired generation 1+ Friend)` : ""}.</p>}
            {friends && friends.length > 0 && <>
              <h2>Choose your Friend</h2>
              {hidden > 0 && <p className="hint">{hidden} generation-0 Friend{hidden > 1 ? "s" : ""} hidden (not hardwired).</p>}
              <div className="friend-grid">{friends.map(f => <FriendCard key={f.id.toString()} id={f.id.toString()} label={f.label || `Friend #${f.id}`} sub={`Generation ${f.generation}`} busy={busy} onPick={() => void pick(f)} />)}</div>
            </>}
            {error && <button type="button" className="btn" onClick={() => setRetry(r => r + 1)}>Retry</button>}
          </div>
        )}

        {guestMode && (
          <div className="gate-friends">
            <h2>Guest demo</h2>
            <p className="hint">Play with a sample Friend. Guest progress saves on this device only and never appears on online leaderboards. Connect a wallet holding a generation 1+ Rare Friend for the real thing.</p>
            <div className="friend-grid">{GUEST_FRIENDS.map(id => <FriendCard key={id} id={id} label={`Sample Friend #${id}`} sub="Guest · unverified" busy={busy} onPick={() => void pickGuest(id)} />)}</div>
            <button type="button" className="btn ghost" onClick={() => setGuestMode(false)}>← Back</button>
          </div>
        )}

        {status && friends !== null && <p className="status"><span className="spinner" /> {status}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="fineprint">All RF, $SHELL, rewards and prize pools are <b>SIMULATED</b> for the Rare Friends Vibeathon. Connecting never asks for a transaction.</p>
      </section>
    </main>
  );
}
