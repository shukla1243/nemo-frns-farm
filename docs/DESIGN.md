# NEMO FRNS FARM: Design Spec

An online, risk-to-earn island life sim starring your Rare Friends Generations NFT.
Solo-playable offline; multiplayer layers on top (one shared world with live presence, async PvP
raids, shared Kraken world boss, weekly season leaderboards). Endless by design: an infinite
story act, infinite milestone tiers, rebirth, daily streaks and timed voyages.

All RF and $SHELL balances, rewards and burns are **SIMULATED** for the vibeathon MVP.

## Pillars (mapped to vibeathon prize categories)

| Category | How we compete |
|---|---|
| Character Spotlight | The verified Friend *is* the hero: canonical on-chain sprite rendered in-world and never recolored, family-specific trait (9 families → 9 play styles), a Homeland Voyage to its own family island, hats and titles every 10 levels, rebirth stars, other players see your Friend live. |
| Token Activity | RF is spent by every progression step: Ascension, Forge, land, homes, charms, scrolls, voyages, rebirth, the Tide Wheel and swap fees. Every spend splits 70% Season Pool / 25% creator / 5% burn, and prosperity buffs scale with RF spent. |
| Economy Potential | Two-token design: RF (premium) + $SHELL (soft) paired in a constant-product Tide Pool, weekly seasons that pay back the top 10, simulated stock-token shares from voyages. Documented faucets and sinks ([TOKENOMICS.md](TOKENOMICS.md)), RTP < 100% on every chance game, Monte Carlo economy simulation in the test suite. |

## Architecture

```
src/engine/   pure TypeScript game rules: no DOM, seeded RNG, fully unit-tested
src/net/      online layer: Nostr (profiles, raids, boss damage) + Trystero WebRTC (live presence/emotes)
src/identity/ FriendSDK wallet session, owned-Friend discovery, fresh eligibility check, guest demo
src/world/    island map, tile grid, NPCs and the pixel canvas renderer
src/art/      procedural pixel art: palette, sprites, tiles, icons, 9-slice UI frames
src/game/     Friend sprite drawing, sound (FriendSDK sound kit) and generative music
src/ui/       React HUD, Play hub, panels and minigames
```

The engine is a reducer: `dispatch(state, action, now) -> { state, events }`, plus
`tick(state, now)` for time-based systems. UI renders state and emits actions.
The net layer never mutates state directly; it produces actions (e.g. `raidReceived`).

## Core loop

Needs (Hunger, Energy, Mood) drain → work (gather, farm, fish) → earn $SHELL/materials
→ risk it (Abyss Dive crash, Tide Mines, raids, Kraken, Tide Wheel, Double-or-Nothing, voyages)
→ spend RF + materials to Ascend (level), Forge gear, build Home, expand the island
→ stronger Friend, bigger risks, bigger rewards, higher season rank → Rebirth and repeat.

## Numbers
All tunables live in `src/engine/config.ts` and are documented in the README economy tables.
RF is stored as integer centi-RF (1 RF = 100) to avoid float drift.

## Persistence
localStorage per Friend (autosave 10 s + on hide), exportable save code (base64 + checksum,
bound to Friend ID), optional wallet-derived NIP-44 encrypted cloud save. Offline progress: crops
grow, voyages finish, needs decay (capped), sleep regen at home.

## Identity
Wallet via FriendSDK `createFriendWalletSession`, discovery via `readOwnedFriends`,
play gate via fresh `readGenerationEligibility` (gen ≥ 1, owned). Guest demo mode is
clearly labelled, uses a sample Friend's public artwork, and never publishes to
leaderboards.

## Multiplayer
- Nostr kind 30078 replaceable profile events (`d=nemo-frns-farm:profile`): level, power,
  defense, vault, spent, season score, friendId. Drives leaderboards and raid targets.
- Nostr kind 7078 raid events tagged with the victim pubkey; victims apply capped losses.
- Nostr kind 7079 Kraken damage events tagged with the epoch; boss HP is shared.
- Trystero (Nostr signalling) WebRTC room `nemo-world`: one shared world, positions, emotes.
- Simulated rivals fill the world so solo play always has targets.
Trust model: client-authoritative, simulated economy only. Documented as a known limitation.

## Testing
- Vitest unit tests per engine module.
- Economy simulation: RTP of every chance game, bot playthroughs (no NaN, no negatives,
  progression reachable, RF net-burn positive).
- Playwright e2e: guest flow on desktop + phone viewports, panels, minigames, screenshots.
