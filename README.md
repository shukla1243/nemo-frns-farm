# NEMO FRNS FARM

**Your Rare Friend washes ashore. Keep it alive, grow the island, and gamble on a better life.**

NEMO FRNS FARM is an endless, risk-to-earn pixel island life sim. You play as your own verified Rare
Friends Generations NFT. You feed it, rest it, farm, fish, mine and dive, and build a home from a clownfish tent to a
Sea Castle. You also send it on voyages that last up to 12 hours. Every level-up and upgrade is a gamble that spends
$SHELL, the island currency.

> **Simulated economy.** Every $SHELL balance, reward, island company share and trade in this build is simulated. The
> game holds no RF. No transactions, no real funds, no real securities.

- **Play:** https://shukla1243.github.io/nemo-frns-farm/ (desktop and phone; needs a browser wallet holding a Rare
  Friends Generations NFT, generation 1 or higher, on Robinhood Chain 4663)
- **Builder:** [@mutantonchain](https://x.com/mutantonchain)
- **Category:** Economy Potential (also built to compete in Token Activity and Character Spotlight)
- **Docs:** [Tokenomics](docs/TOKENOMICS.md) · [Lore and how to play](docs/LORE.md) · [Design](docs/DESIGN.md)

## Why it wins

| Prize category | What NEMO FRNS FARM delivers |
|---|---|
| **Economy Potential** | A complete, testable SHELL economy with documented faucets and sinks. Every chance game shows its odds and pays back less than 100%, and Monte Carlo bots check that the chance games net every play style negative. Real RF is planned only through the Rare Friends platform contracts (paid charters, a paid wheel and cosmetics), not through the game ledger. |
| **Token Activity** | SHELL is spent constantly, and each spend is a real decision: ascension rolls, forge strikes, land, homes, charms, voyages and rebirths. Spending raises Prosperity and the weekly season score, and players come back for daily streaks, 12-hour voyages, a Kraken every 20 minutes and weekly seasons. |
| **Character Spotlight** | Your Friend is the hero, drawn in-world from its canonical on-chain sprite and never recolored. Its family sets 1 of 9 play-style traits. Its family island is the target of the Homeland Voyage. It earns a new hat and title every 10 levels, and a star for every rebirth. Simulated rivals and residents share its island. |

## What you can do

- **Survive.** Hunger, energy and mood drain in real time. Tap the hunger bar or the flashing **Eat now** button to eat
  your best food. Sleep at home to refill energy.
- **Work.** Chop, quarry, farm (6 crops), fish (timing mini-game), play **Crab Dash** (a
  25-second whack-a-crab arcade with a personal best, no stake), cook, sell at the market, and sell island company shares at the Tide Pool.
- **Risk it.** Abyss Dive (crash game), Tide Mines (minesweeper multiplier), double or nothing, raids on simulated
  rival crews, the Kraken world boss, and the free Tide Wheel with a 3,750 SHELL jackpot.
- **Voyage.** Send your Friend away for 15 minutes, 1, 6 or 12 hours. Long voyages have low odds and big upside: SHELL
  hoards, Family Relics (+2% XP forever) from your Friend's own family island, and simulated **island company shares** in
  fictional NEMO sea companies (FINX, URCH, CLAM, KRLL, KELP, GULL, DUBL) that you can hold or sell at a live simulated price. While your Friend is away, it
  can't work, so every voyage is a real trade-off. The Voyage Pier opens once the story chapter "A Roof Over Fins" is
  done.
- **Grow forever.** Ascend with odds that fall as you level up. Forge gear from +1 to +10, build 5 homes and unlock 7
  regions. Rebirth at level 30 for permanent bonuses. 15 milestone tracks have infinite tiers. The daily streak pays out
  automatically, and the story goes on forever: 15 chapters in Act I, 12 in Act II, and an Act III that never ends.
- **Season Journey.** A free 10-tier reward track every week, so every player gets paid for playing.
- **Rivals.** Your island is solo. Simulated rivals, traders and residents who stroll the beach (clearly labelled as
  residents) fill the sea, the leaderboard and the Kraken fight.

Everything is one tap away. A gold arrow on the map points at your next story goal and labels it with its name and
distance. The **Go** button beside the goal takes you there, turns into a gold **Claim** button when the goal is met,
and counts down ("Back in 12:34") while your Friend is on a voyage, so there is always a next step. The orange **Play** button lists every game and place, plus a **Ready now** list (ripe crops, a
returned voyage, a free spin, gifts, claimable bounties). Coming back after a break opens a **Welcome back** report of
everything that happened. The map fast travels, and the bell keeps a full notification history, so nothing is missed.

## Tokenomics in one picture

```
                earn (play)
  chop/farm/fish/raid/boss/voyage/shares ──► SHELL
                                               │  spend: ascend, forge, homes, land,
                                               │  charms, voyages, rebirth, market
                                               ▼
                                  ┌──────── SHELL SPENT ────────┐
                                  │ Prosperity: +1% per 2,000   │──► more SHELL from sales and bounties
                                  │ Season score: 1 pt per 20   │──► weekly board and Season Journey
                                  └─────────────────────────────┘
```

The full breakdown of every faucet and sink, with odds, costs and simulation results, is in
**[docs/TOKENOMICS.md](docs/TOKENOMICS.md)**.

**Simulation evidence** (`npm run sim`, scripted bots): grinders reach level 15 to 17 in 4 hours, degens 18 to 20,
and new players level 6 to 8 with a hut in their first half hour. The chance games net every style negative overall.
The tables are in [docs/TOKENOMICS.md](docs/TOKENOMICS.md#simulation-results).

## How to play

1. **Enter.** Connect a browser wallet holding a Rare Friends Generations NFT (generation 1 or higher) on Robinhood
   Chain (4663) and pick your Friend. FriendSDK checks ownership on-chain before play. On phones, open the link in your
   wallet app's browser. Every playable build requires this check; there is no guest mode.
2. **Move.** Tap or click the ground or a building, or use WASD and the arrow keys. Press **E** or the orange action
   button near a station.
3. **Follow the story.** The note under your needs shows the current chapter goal. Press **Go** to get there and the
   gold **Claim** button to collect the reward.
4. **Open Play.** Every game and place is listed there, with its risk level and a Go button.

The full guide, the lore and every islander are in **[docs/LORE.md](docs/LORE.md)**.

## Solo island and saves

- **Solo island.** Rival islands, residents and Kraken hunters are simulated. The FriendSDK v0.2 sandbox blocks the
  former Nostr and WebRTC layer, so this port removed it.
- **Saves.** localStorage autosave every 10 s and when the page is hidden, with timestamps for offline progress (crops
  grow, voyages finish, needs drain at most 50%). Checksummed **save codes** for manual backup.
- **Trust model.** The client is authoritative and the economy is simulated. Real value would need on-chain
  settlement first (see the roadmap below).

## Rare Friends integration

- FriendSDK v0.2.3 (`@rarefriends/friendsdk`, vendored archive in `vendor/`):
  - `createFriendWalletSession` for EIP-6963 and injected wallets.
  - `readOwnedFriends` for owned-Friend discovery.
  - `readGenerationEligibility` for a fresh gen ≥ 1 ownership check before play.
  - `createFriendReader` and `spriteFrame` for canonical sprites.
  - `createFriendSoundKit` for the sound kit.
- The Friend's family selects its trait: Skeleton **Bone Diver**, Mask **Trickster**, Family **Homebody**, Cellular
  **Green Cells**, Asymmetry **Chaos Engine**, Hoverer **Glider**, Colossus **Titan**, Sparkling **Sparkle Luck** and
  Hollow **Hollow Belly**.
- The Friend is drawn exactly as minted, with a thin outline so it reads on sand and grass. Hats, dust puffs, titles
  and rebirth stars are added around it, never painted over it.
- The FriendSDK sandbox is optional for vibeathon entries. This build runs as a standalone host, so it can keep real
  local saves. The wallet and ownership gate stay intact.

## Roadmap to on-chain

Real RF moves only through the Rare Friends platform contracts, never through a game ledger. Planned, not implemented:

1. **Paid charters and a paid Tide Wheel** as Draw actions with published odds and RF prize rows, settled by Dice.
2. **Cosmetics** (flags, hats, sails, pets) as one-row Draw actions that mint Friend-bound GameItems.
3. **Server rules** in a FriendSDK `server.ts`, so SHELL, items and timers are decided by the game server.

## Run it

```sh
npm ci
npm run dev        # http://localhost:5173 (also on your LAN for phone testing)
npm run build      # static site in dist/ (GitHub Pages ready, relative base)
npm test           # engine, economy, voyage and world tests (+ Monte Carlo)
npm run sim        # economy simulation tables
npm run test:e2e   # Playwright: builds the e2e test build (dist-e2e) and plays it on desktop and phone
```

Requires Node.js 22+. The FriendSDK v0.2.3 package archive is vendored in `vendor/`.

## Checks

- `npm run typecheck`: TypeScript strict, 0 errors. `knip`: no unused files, exports or dependencies.
- `npm test`: all passing. Covers:
  - engine rules and the RTP of every chance game
  - a SHELL-only economy (no RF anywhere in state, prices or prizes) and a server-safe engine (no clock, ambient
    randomness or browser globals)
  - late randomness: dive survival, mines trap rate and voyage odds rolled at reveal, checked by distribution tests
  - the story guide (never blank, voyage countdown, wood and stone before Home), the voyage gate and the Welcome back
    report
  - seasons, islanders and the endless story
  - milestones, rebirth and the daily streak
  - voyages: costs, locked odds, recall, a net SHELL-negative EV at max bonus, and island share sales
  - save codes, map reachability for every station, and economy bots
- `npm run test:e2e`: every check passing on desktop (1280×800) and phone (390×844). Covers entry, story, fast
  travel, chop plus autosave, every HUD panel fitting the screen (including Play, Settings and the notification inbox),
  farm, the island share market, wheel, fishing, NPC gifts and map travel, with zero page errors.
- **Known limitations:** the economy is client-authoritative and simulated until the game server lands. Rivals are simulated. The wallet flow uses
  the SDK functions directly. Automated tests enter through sample Friends that exist only in the e2e test build
  (`vite build --mode e2e`, output `dist-e2e/`); `npm run build` contains none of that code. A real-wallet playthrough
  needs a Gen 1+ holder.

## Credits

- **Code, art and music:** original to this project. The pixel art is generated procedurally in `src/art/`, and the
  "Tide Garden" music is generated live with Web Audio in `src/game/music.ts`.
- **Fonts:** [Jersey 15](https://fonts.google.com/specimen/Jersey+15) and [Nunito](https://fonts.google.com/specimen/Nunito) (SIL OFL).
- **FriendSDK** (Apache-2.0) by Rare Friends: wallet, identity, canonical Friend sprites and the sound kit.
- **Libraries:** React, Vite and anime.js.
