# NEMO FRNS FARM: Design Spec

A risk-to-earn island life sim starring your Rare Friends Generations NFT.
Solo-playable offline; multiplayer layers on top (one shared world with live presence, async PvP
raids, shared Kraken world boss, weekly season leaderboards). Endless by design: an infinite
story act, infinite milestone tiers, rebirth, daily streaks and timed voyages.

All $SHELL balances and rewards are **SIMULATED**. The game holds no RF.

## Pillars (mapped to vibeathon prize categories)

| Category | How we compete |
|---|---|
| Character Spotlight | The verified Friend *is* the hero: canonical on-chain sprite rendered in-world and never recolored, family-specific trait (9 families → 9 play styles), a Homeland Voyage to its own family island, hats and titles every 10 levels, rebirth stars, other players see your Friend live. |
| Token Activity | SHELL is spent by every progression step: Ascension, Forge, land, homes, charms, scrolls, voyages and rebirth. Prosperity buffs and the weekly season score scale with SHELL spent. |
| Economy Potential | One-currency design: $SHELL, weekly seasons with a free Season Journey, and simulated island company shares from voyages traded at the Tide Pool. Documented faucets and sinks ([TOKENOMICS.md](TOKENOMICS.md)), RTP < 100% on every chance game, Monte Carlo economy simulation in the test suite. Real RF is planned only through the Rare Friends platform contracts. |

## Architecture

```
src/engine/   pure TypeScript game rules: server-safe (no DOM, clock or ambient randomness), seeded RNG, fully unit-tested
src/identity/ FriendSDK wallet session, owned-Friend discovery, fresh eligibility check
src/world/    island map, tile grid, NPCs and the pixel canvas renderer
src/art/      procedural pixel art: palette, sprites, tiles, icons, 9-slice UI frames
src/game/     Friend sprite drawing, local saves, sound (FriendSDK sound kit) and generative music
src/ui/       React HUD, Play hub, panels and minigames
```

The engine is a reducer: `dispatch(state, action, now) -> { state, events }`, plus
`tick(state, now)` for time-based systems. UI renders state and emits actions.

## Core loop

Needs (Hunger, Energy, Mood) drain → work (gather, farm, fish) → earn $SHELL/materials
→ risk it (Abyss Dive crash, Tide Mines, raids, Kraken, Tide Wheel, Double-or-Nothing, voyages)
→ spend SHELL + materials to Ascend (level), Forge gear, build Home, expand the island
→ stronger Friend, bigger risks, bigger rewards, higher season rank → Rebirth and repeat.

## Numbers
All tunables live in `src/engine/config.ts` and are documented in the README economy tables.

## Persistence
localStorage per Friend (autosave 10 s + on hide), exportable save code (base64 + checksum,
bound to Friend ID). Offline progress: crops
grow, voyages finish, needs decay (capped), sleep regen at home.

## Identity
Wallet via FriendSDK `createFriendWalletSession`, discovery via `readOwnedFriends`,
play gate via fresh `readGenerationEligibility` (gen ≥ 1, owned). Every playable build
requires the gate. Sample Friends are a test fixture that exists only in the e2e test
build (`vite build --mode e2e`); production builds contain none of that code.

## Rivals
The island is solo. Simulated rivals, residents and Kraken hunters fill the world so play
always has targets. Trust model: client-authoritative, simulated economy only.

## Testing
- Vitest unit tests per engine module.
- Economy simulation: RTP of every chance game, bot playthroughs (no NaN, no negatives,
  progression reachable, chance games net negative, early wins for new players).
- Playwright e2e (test build with sample Friends): desktop + phone viewports, panels, minigames, screenshots.
