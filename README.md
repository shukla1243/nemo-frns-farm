# NEMO FRNS FARM

**Your Rare Friend washes ashore. Keep it alive, grow the island, and gamble on a better life.**

An endless, risk-to-earn pixel island life sim for [Rare Friends](https://rarefriends.com), built on
[FriendSDK 1.0](https://github.com/rarefriends/friendsdk). You play as your own Rare Friends Generations NFT: feed it,
rest it, farm, fish, mine and dive, build a home from a clownfish tent to a Sea Castle, and send it on voyages that last
up to 12 hours.

> **Simulated economy.** This build is SHELL only: every balance, reward, island company share and trade is simulated.
> It declares no paid actions and holds no RF.

- **Game id:** `nemo-farm`, version 0.1.0 (`friendsdk.json`)
- **Builder:** [@mutantonchain](https://x.com/mutantonchain)
- **Vibeathon:** 6th place, Economy Potential ([submission](https://github.com/spokesz/rarefriends-vibeathon/pull/50))
- **Docs:** [Tokenomics](docs/TOKENOMICS.md) · [Lore and how to play](docs/LORE.md) · [Design](docs/DESIGN.md)

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

1. **Enter.** Open NEMO FRNS FARM on rarefriends.com and pick a Rare Friends Generations NFT (generation 1 or higher).
   The website signs you in and checks ownership; the game never touches your wallet.
2. **Move.** Tap or click the ground or a building, or use WASD and the arrow keys. Press **E** or the orange action
   button near a station.
3. **Follow the story.** The note under your needs shows the current chapter goal. Press **Go** to get there and the
   gold **Claim** button to collect the reward.
4. **Open Play.** Every game and place is listed there, with its risk level and a Go button.

The full guide, the lore and every islander are in **[docs/LORE.md](docs/LORE.md)**.

## Built on FriendSDK 1.0

- **Client** (`src/client.tsx`): mounts through `FriendSession`, draws the Friend from `game.art` with `spriteFrame`,
  honors `paused`, fills any box from 320 px wide and keeps the host's top-right corner free.
- **Server** (`server/index.ts`): `defineGame` calls `load`, `act`, `sync` and `prefs`. The server runs the game engine
  at server time, validates every input, rolls value randomness with `ctx.randomInt` and stores one island per Friend.
  The client sends intents only; nothing is kept in browser storage.
- **Family traits** come from `ctx.friend.family`, read on chain.
- No paid actions, items or deployment record in this version.

## Run it

```sh
npm ci
npx friendsdk dev     # http://localhost:4173: simulated chain, Nakama and fixture Friends
npx friendsdk check
npx friendsdk build   # release artifacts in .friendsdk/build
npm test              # engine, server, economy and Monte Carlo tests
npm run test:e2e      # Playwright against friendsdk dev, desktop and phone
```

Requires Node.js 22+.
