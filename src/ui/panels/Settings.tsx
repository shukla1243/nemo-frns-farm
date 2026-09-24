import { useState } from "react";
import { homeIsle } from "../../engine/voyages";
import { exportSave, importSave, clearLocal } from "../../engine/save";
import { TRAITS, SINK } from "../../engine/config";
import { sound } from "../../game/sound";
import { Panel, SimTag, useG } from "../common";
import { music } from "../../game/music";

export function SettingsPanel({ onClose, onReplace }: { onClose: () => void; onReplace: (code: string) => string | null }) {
  const { s, reducedMotion, setReducedMotion, cloud, identity } = useG();
  const [musicOn, setMusicOn] = useState(music.on);
  const [muted, setMuted] = useState(sound.muted);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const exported = exportSave(s);
  return (
    <Panel title="Settings & Saves" icon="settings" onClose={onClose}>
      <section className="section">
        <h3>Accessibility</h3>
        <label className="check"><input type="checkbox" checked={!muted} onChange={e => { sound.setMuted(!e.target.checked); setMuted(!e.target.checked); if (e.target.checked) sound.play("select"); }} /> Sound effects</label>
        <label className="check"><input type="checkbox" checked={musicOn} onChange={e => { music.setOn(e.target.checked); setMusicOn(e.target.checked); }} /> Music (the calm island theme)</label>
        <label className="check"><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} /> Reduce motion (no shake, confetti or wave animation)</label>
      </section>
      <section className="section">
        <h3>Cloud save (cross-device)</h3>
        {identity.guest ? <p className="muted">Guests save on this device only. Connect a wallet to sync between phone and computer.</p> : <>
          <p className="muted">Sign one free message (no gas, no transaction) to derive a private key from your wallet. Your save is encrypted to that key and synced through Nostr relays, so the same Friend picks up where you left off on any device.</p>
          <p>Status: <b>{cloud.status}</b> {cloud.message && <span className="muted">({cloud.message})</span>}</p>
          <div className="btn-row">
            {cloud.status === "off" || cloud.status === "error" ? <button type="button" className="btn primary" onClick={() => void cloud.enable()}>Enable cloud save</button>
              : <button type="button" className="btn" onClick={() => void cloud.pull()}>Pull latest from cloud</button>}
          </div>
        </>}
        <p className="fineprint">Local autosave runs every 10 s and when you leave the page. Time away counts: crops keep growing and your Friend rests at home (needs drain at most 50% while offline).</p>
      </section>
      <section className="section">
        <h3>Save code</h3>
        <p className="muted">Copy this to back up or move your island by hand. It's bound to Friend #{s.friendId} and checksummed.</p>
        <textarea readOnly className="code" value={exported} onFocus={e => e.currentTarget.select()} rows={3} />
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => { void navigator.clipboard?.writeText(exported).then(() => setMsg("Copied!"), () => setMsg("Select the text and copy it manually.")); }}>Copy</button>
        </div>
        <textarea className="code" placeholder="Paste a save code to restore…" value={code} onChange={e => setCode(e.target.value)} rows={3} />
        <button type="button" className="btn" disabled={!code.trim()} onClick={() => {
          try { importSave(code, s.friendId); const err = onReplace(code); setMsg(err ?? "Save restored!"); } catch (e) { setMsg(e instanceof Error ? e.message : "Invalid code."); }
        }}>Restore from code</button>
        {msg && <p className="muted" role="status">{msg}</p>}
      </section>
      <section className="section">
        <h3>Danger zone</h3>
        {!confirmReset ? <button type="button" className="btn ghost" onClick={() => setConfirmReset(true)}>Reset this island…</button> : (
          <div className="btn-row">
            <span className="warn">Erase all progress for Friend #{s.friendId} on this device?</span>
            <button type="button" className="btn hot" onClick={() => { clearLocal(s.friendId, s.guest); location.reload(); }}>Yes, reset</button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
      </section>
      <p className="fineprint"><SimTag /> Every RF balance, reward, prize pool and trade here is simulated for the Rare Friends Vibeathon. RF sinks split {SINK.pool * 100}% Season Pool / {SINK.creator * 100}% creator / {SINK.burn * 100}% burned.</p>
    </Panel>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const { s } = useG();
  const trait = TRAITS.find(t => t.id === s.trait)!;
  return (
    <Panel title="How to play" icon="help" onClose={onClose} wide>
      <div className="help">
        <h3>The story so far</h3>
        <p>A storm tossed your Rare Friend onto a tiny sandbar with nothing but palms. Eight islanders live here: Mayor Clam, Old Salt the fisherman, Coral the shopkeeper, Pip the island kid, Miner Moe, Captain Rook, Smith Ember and Seer Anemone. Help them, grow the island, and one day sail back to your Friend's own family island, <b>{homeIsle(s.family)}</b>, to recover its lost relics.</p>
        <h3>Quick start</h3>
        <p><b>Move:</b> tap or click the ground or a building, or use WASD and the arrow keys. Press <kbd>E</kbd> or the big orange button when you stand near something.</p>
        <p><b>Find everything:</b> the orange <b>Play</b> button lists every game and place with a Go button that takes you there. The map button fast travels. The bell keeps every notification.</p>
        <p><b>Follow the story:</b> the note under your needs shows your current chapter goal. Tap it to claim the reward. Act III never ends.</p>
        <h3>Stay alive</h3>
        <p><b>Eat:</b> tap the hunger bar (or the flashing "Eat now" button) to eat your best food. Get food from the Farm, the Dock, the Market or cook at Home. Below 25 hunger your yields drop 25% and energy stops refilling.</p>
        <p><b>Rest:</b> tap the energy bar to drink or go to sleep at Home. Bigger homes restore more. <b>Mood:</b> tap it for a treat. Above 75 you get luck and bonus XP.</p>
        <h3>Earn and risk</h3>
        <p><b>Earn:</b> chop, quarry, farm, fish, fill bounties, sell at the Market, and swap SHELL and RF at the Tide Pool.</p>
        <p><b>Risk:</b> Abyss Dive (cash out before the shark), Tide Mines (dig safe tiles), double or nothing, raids, the Kraken world boss and the Tide Wheel. Every game shows its odds before you play.</p>
        <p><b>Voyages:</b> at the Voyage Pier, send your Friend away for 15 minutes to 12 hours. Long voyages have low odds but can bring back RF, Family Relics or simulated stock-token shares (NVDA, TSLA, HOOD and more) that you can sell for SHELL. While your Friend is away it can't work.</p>
        <h3>Grow forever</h3>
        <p>Level up by <b>Ascending</b> at the Coral Shrine (a chance roll that spends RF, never loses a level). Forge gear +1 to +10. Build from a Tent to a Sea Castle. Unlock 7 regions. At level 30 you can <b>Rebirth</b> for permanent XP and SHELL bonuses. Milestones and daily streak rewards arrive on their own.</p>
        <h3>Where RF goes</h3>
        <p>Every RF you spend splits <b>70%</b> into the weekly Season Prize Pool, <b>25%</b> to the creator and <b>5%</b> is burned forever. The top 10 of each week split the pool. All balances are simulated.</p>
        <p><b>Your Friend:</b> {trait.family} family, trait <b>{trait.name}</b>: {trait.blurb} It gets a new hat and title every 10 levels.</p>
        <p><b>Online:</b> everyone shares one island world. You see other Friends walking live, raid real players, fight the Kraken together and climb the leaderboards. No game server (Nostr and WebRTC). Solo works too.</p>
      </div>
    </Panel>
  );
}
