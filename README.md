# NEMO FRNS FARM

**Your Rare Friend washes ashore. Keep it alive, grow the island, and gamble on a better life.**

NEMO FRNS FARM is an online, endless, risk-to-earn pixel island life sim. You play as your own verified Rare
Friends Generations NFT. You feed it, rest it, farm, fish, mine and dive, and build a home from a clownfish tent to a
Sea Castle. You also send it on voyages that last up to 12 hours. Every level-up and upgrade is a gamble that spends RF.
**70% of every RF spent flows into a weekly Season Prize Pool that pays back the top 10 players.**

> **Simulated economy.** Every RF and $SHELL balance, reward, prize pool, stock token and trade in this build is
> simulated for the Rare Friends Vibeathon. No transactions, no real funds, no real securities.

- **Play:** https://shukla1243.github.io/nemo-frns-farm/ (desktop and phone, guest mode for judges)
- **Builder:** [@mutantonchain](https://x.com/mutantonchain)
- **Category:** Economy Potential (also built to compete in Token Activity and Character Spotlight)
- **Docs:** [Tokenomics](docs/TOKENOMICS.md) · [Lore and how to play](docs/LORE.md) · [Design](docs/DESIGN.md)

## Why it wins

| Prize category | What NEMO FRNS FARM delivers |
|---|---|
| **Economy Potential** | A complete, testable two-token economy that shows the Rare Friends "Potential" roadmap working today. $SHELL is paired with $RAREFRIENDS in a live constant-product pool, which is the roadmap's market step. Every chance game shows its odds and pays back less than 100%. Every RF sink splits 70% Season Pool, 25% creator and 5% burn, so creator fees arrive as assets trade. Monte Carlo bots prove the loop is net RF-negative for every play style. |
| **Token Activity** | RF is spent constantly, and each spend is a real decision: ascension rolls, forge strikes, land, homes, charms, voyages, rebirths, wheel spins, lost stakes and swap fees. Players get a reason to spend, which is a shot at the weekly pool, and a reason to come back, with daily streaks, 12-hour voyages, a Kraken every 20 minutes and weekly seasons. |
| **Character Spotlight** | Your Friend is the hero, drawn in-world from its canonical on-chain sprite and never recolored. Its family sets 1 of 9 play-style traits. Its family island is the target of the Homeland Voyage. It earns a new hat and title every 10 levels, and a star for every rebirth. Other players see it walking live. |

## What you can do

- **Survive.** Hunger, energy and mood drain in real time. Tap the hunger bar or the flashing **Eat now** button to eat
  your best food. Sleep at home to refill energy.
- **Work.** Chop, quarry, farm (6 crops), fish (timing mini-game), play **Crab Dash** (a
  25-second whack-a-crab arcade with a personal best, no stake), cook, sell at the market, and swap at the Tide Pool.
- **Risk it.** Abyss Dive (crash game), Tide Mines (minesweeper multiplier), double or nothing, raids on real players and
  rival crews, the Kraken world boss (co-op), and the Tide Wheel with a 25 RF jackpot.
- **Voyage.** Send your Friend away for 15 minutes, 1, 6 or 12 hours. Long voyages have low odds and big upside: RF
  hoards, Family Relics (+2% XP forever) from your Friend's own family island, and simulated **stock-token shares** (NVDA,
  TSLA, AAPL, AMZN, MSFT, HOOD, COIN) that you can hold or sell at a live simulated price. While your Friend is away, it
  can't work, so every voyage is a real trade-off.
- **Grow forever.** Ascend with odds that fall as you level up. Forge gear from +1 to +10, build 5 homes and unlock 7
  regions. Rebirth at level 30 for permanent bonuses. 15 milestone tracks have infinite tiers. The daily streak pays out
  automatically, and the story goes on forever: 15 chapters in Act I, 12 in Act II, and an Act III that never ends.
- **Season Journey.** A free 10-tier reward track every week, so every player gets paid for playing, not just the
  top 10.
- **Play together.** Everyone spawns into **one shared island world**. You see other Friends walk and emote live, raid
  real players' vaults, hit the same Kraken, and climb the same weekly leaderboard. Solo play works fully offline with
  simulated rivals, traders and residents who stroll the beach (clearly labelled as residents).

Everything is one tap away. A gold arrow on the map points at your next story goal, and the **Go** button beside the
goal takes you there. The orange **Play** button lists every game and place, plus a **Ready now** list (ripe crops, a
returned voyage, a free spin, gifts, claimable bounties). Coming back after a break opens a **Welcome back** report of
everything that happened. The map fast travels, and the bell keeps a full notification history, so nothing is missed.

## Tokenomics in one picture

```
                earn (play)                      swap (3% fee)
  chop/farm/fish/raid/boss/voyage ──► SHELL ◄══ Tide Pool (x·y=k) ══► RF
                                                                     │  spend: ascend, forge, homes, land,
                                                                     │  charms, voyages, rebirth, wheel, stakes
                                                                     ▼
                                  ┌──────────── RF SINK ─────────────┐
                                  │ 70% Season Prize Pool (weekly)   │──► top 10 players
                                  │ 25% creator treasury             │──► creator revenue on every trade
                                  │  5% burned forever               │
                                  └──────────────────────────────────┘
```

The full breakdown of every faucet and sink, with odds, costs and simulation results, is in
**[docs/TOKENOMICS.md](docs/TOKENOMICS.md)**.

**Simulation evidence** (`npm run sim`, scripted bots, 4 hours of game time each):

| Bot | Level | RF spent | RF won | Notes |
|---|---|---|---|---|
| Grinder 1 | 16 | 150.6 | 26.6 | all 7 regions, gear +5/+5/+6 |
| Grinder 2 | 14 | 114.4 | 26.6 | all 7 regions |
| Grinder 3 | 16 | 134.3 | 20.0 | all 7 regions |
| Grinder 4 | 16 | 124.0 | 20.4 | all 7 regions |
| Degen 1 | 8 | 32.6 | 13.1 | ends with 0.5 RF |
| Degen 2 | 9 | 37.3 | 20.1 | ends with 2.8 RF |
| Degen 3 | 7 | 29.4 | 10.3 | ends with 0.9 RF |

Every style spends far more RF than it wins. The economy is a net sink that feeds the Season Pool, while progress
stays fast and rewarding.

## How to play

1. **Enter.** Connect a browser wallet holding a Rare Friends Generations NFT (generation 1 or higher) on Robinhood
   Chain (4663) and pick your Friend. FriendSDK checks ownership on-chain before play. On phones, open the link in your
   wallet app's browser. No wallet? Pick **Try as guest** and play a sample Friend. Guest progress stays on the device
   and never appears on leaderboards.
2. **Move.** Tap or click the ground or a building, or use WASD and the arrow keys. Press **E** or the orange action
   button near a station.
3. **Follow the story.** The note under your needs shows the current chapter goal. Tap it to claim the reward.
4. **Open Play.** Every game and place is listed there, with its risk level and a Go button.

The full guide, the lore and every islander are in **[docs/LORE.md](docs/LORE.md)**.

## Multiplayer and saves (no game server)

- **One shared world.** All players join the same WebRTC room (Trystero, signalled over Nostr) for live positions and
  emotes.
- **Global layer on Nostr relays.** Player profiles (leaderboards, raid targets, season scores), raid notifications,
  Kraken damage per boss epoch, and a live brag feed.
- **Saves.** localStorage autosave every 10 s and when the page is hidden, with timestamps for offline progress (crops
  grow, voyages finish, needs drain at most 50%). Checksummed **save codes** for manual backup. **Cloud save:** sign
  one free message (no gas) to derive a private key from your wallet. Your save is NIP-44 encrypted to that key and synced
  through relays, so the same Friend continues on phone and desktop.
- **Trust model.** The client is authoritative and the economy is simulated. Profiles and raids are signed Nostr
  events, but no server validates them. Real value would need on-chain settlement first (see the roadmap below).

## Rare Friends integration

- FriendSDK v0.1.2 (`@rarefriends/friendsdk`):
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
  saves and reach Nostr relays and WebRTC peers. The wallet and ownership gate stay intact.

## Roadmap to on-chain

This follows the Rare Friends "Potential" roadmap: pair with $RAREFRIENDS for a market, use chance with verifiable
randomness, and earn creator fees on trades.

1. **Sinks.** Route RF sinks through a `SinkRouter` contract (70/25/5) into a `SeasonPool` that pays the top 10 via
   Merkle claims.
2. **Market.** Launch $SHELL as an ERC-20 paired with RF in a real AMM, with creator fees on every swap.
3. **Chance.** Settle chance games and voyages with Rare Friends Dice RNG (`play`/`settle`), with prize reserves
   backing every RF payout.
4. **Items.** Bind homes, gear levels, relics and hats to the Friend's token-bound wallet.
5. **Validation.** Validate raids and boss damage on a server (or with proofs) before real value is at stake.

## Run it

```sh
npm ci
npm run dev        # http://localhost:5173 (also on your LAN for phone testing)
npm run build      # static site in dist/ (GitHub Pages ready, relative base)
npm test           # engine, economy, voyage, world and AMM tests (+ Monte Carlo)
npm run sim        # economy simulation tables
npm run build && npm run test:e2e   # Playwright: full desktop and phone playthrough
```

Requires Node.js 22+. The FriendSDK v0.1.2 package archive is vendored in `vendor/`.

## Checks

- `npm run typecheck`: TypeScript strict, 0 errors. `knip`: no unused files, exports or dependencies.
- `npm test`: all passing. Covers:
  - engine rules and the RTP of every chance game
  - AMM invariants and the 70/25/5 sink split
  - seasons, islanders and the endless story
  - milestones, rebirth and the daily streak
  - voyages: costs, fixed outcomes, recall, odds, a net RF-negative EV at max bonus, and stock sales
  - save codes, map reachability for every station, and economy bots
- `npm run test:e2e`: every check passing on desktop (1280×800) and phone (390×844). Covers guest entry, story, fast
  travel, chop plus autosave, every HUD panel fitting the screen (including Play, Settings and the notification inbox),
  farm, swap, wheel, fishing, NPC gifts and map travel, with zero page errors.
- **Known limitations:** multiplayer and prize pools are client-authoritative and simulated. Public Nostr relays and
  WebRTC can be unreachable on some networks. The game then continues solo with simulated rivals. The wallet flow uses
  the SDK functions directly and was tested through the guest path. A real-wallet playthrough needs a Gen 1+ holder.

## Credits

- **Code, art and music:** original to this project. The pixel art is generated procedurally in `src/art/`, and the
  "Tide Garden" music is generated live with Web Audio in `src/game/music.ts`.
- **Fonts:** [Jersey 15](https://fonts.google.com/specimen/Jersey+15) and [Nunito](https://fonts.google.com/specimen/Nunito) (SIL OFL).
- **FriendSDK** (Apache-2.0) by Rare Friends: wallet, identity, canonical Friend sprites and the sound kit.
- **Libraries:** React, Vite, anime.js, nostr-tools and Trystero.
