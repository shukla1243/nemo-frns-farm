import { homeIsle } from "../../engine/voyages";
import { TRAITS } from "../../engine/config";
import { sound } from "../../game/sound";
import { Panel, SimTag, useG } from "../common";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { s, prefs, setPrefs, reducedMotion, setReducedMotion } = useG();
  return (
    <Panel title="Settings" icon="settings" onClose={onClose}>
      <section className="section">
        <h3>Accessibility</h3>
        <label className="check"><input type="checkbox" checked={!prefs.muted} onChange={e => { setPrefs({ muted: !e.target.checked }); if (e.target.checked) { sound.setMuted(false); sound.play("select"); } }} /> Sound effects</label>
        <label className="check"><input type="checkbox" checked={prefs.music} onChange={e => setPrefs({ music: e.target.checked })} /> Music (the calm island theme)</label>
        <label className="check"><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} /> Reduce motion (no shake, confetti or wave animation)</label>
      </section>
      <section className="section">
        <h3>Your island</h3>
        <p className="fineprint">Your island is kept on the Rare Friends game server for Friend #{s.friendId} and follows it to every device. Time away counts: crops keep growing and your Friend rests at home (needs drain at most 50% while away).</p>
      </section>
      <p className="fineprint"><SimTag /> Every SHELL balance, reward and trade here is simulated. The game holds no RF.</p>
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
        <p><b>Earn:</b> chop, quarry, farm, fish, fill bounties, sell at the Market, and sell island company shares at the Tide Pool.</p>
        <p><b>Risk:</b> Abyss Dive (cash out before the shark), Tide Mines (dig safe tiles), double or nothing, raids, the Kraken world boss and the Tide Wheel. Every game shows its odds before you play.</p>
        <p><b>Voyages:</b> at the Voyage Pier, send your Friend away for 15 minutes to 12 hours. Long voyages have low odds but can bring back SHELL hoards, Family Relics or simulated island company shares (FINX, URCH, GULL and more) that you can sell for SHELL. While your Friend is away it can't work.</p>
        <h3>Grow forever</h3>
        <p>Level up by <b>Ascending</b> at the Coral Shrine (a chance roll that spends SHELL, never loses a level). Forge gear +1 to +10. Build from a Tent to a Sea Castle. Unlock 7 regions. At level 30 you can <b>Rebirth</b> for permanent XP and SHELL bonuses. Milestones and daily streak rewards arrive on their own.</p>
        <h3>Where SHELL goes</h3>
        <p>SHELL you spend on upgrades and the market raises your Prosperity (up to +30% SHELL from sales and bounties) and your weekly season score. All balances are simulated.</p>
        <p><b>Your Friend:</b> {trait.family} family, trait <b>{trait.name}</b>: {trait.blurb} It gets a new hat and title every 10 levels.</p>
        <p><b>Rivals:</b> your island is solo. Rival islands, residents and Kraken hunters are simulated.</p>
      </div>
    </Panel>
  );
}
