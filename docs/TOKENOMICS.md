# NEMO FRNS FARM tokenomics

> Everything below is **simulated** for the Rare Friends Vibeathon. No real funds, transactions or securities.
> Every number here comes straight from `src/engine/config.ts` and `src/engine/voyages.ts` and is covered by tests.

## The short version

- **Two tokens.** `$RAREFRIENDS` (RF) is the premium token. `$SHELL` is the soft token you earn by playing.
- **One market.** SHELL and RF trade in the Tide Pool, a constant-product pool (x·y=k) with a 3% fee.
- **One rule for every RF spent:** 70% goes to the weekly **Season Prize Pool**, 25% to the **creator**, and 5% is
  **burned forever**.
- **One reason to spend:** the top 10 players each week split the Season Prize Pool.
- **One promise:** every chance game shows its odds and pays back less than it takes in, so the pool is funded
  by play rather than printed.

This is the Rare Friends "Potential" roadmap in a playable form. $SHELL is paired with $RAREFRIENDS for a market, luck
comes from shown randomness, and the creator earns fees as assets trade.

## Where tokens come from (faucets)

| Source | Gives | Notes |
|---|---|---|
| Chopping, quarrying, farming, fishing | SHELL (via selling), materials, food | The main income. Hunger below 25 cuts yields 25%. |
| Crab Dash | 3 SHELL per point, bait at 60+, a pearl at 100+ | Skill game, 6 energy per round, never pays RF. |
| Bounties and story chapters | SHELL, items, small RF | Act I to III chapter rewards grow slowly and never end. |
| Milestones (15 tracks, infinite tiers) | SHELL each tier, `0.25 × tier` RF every third tier | Paid automatically. |
| Daily streak | 40 to 280 SHELL, bait, 1 RF + a Charm on day 7 | Paid automatically the first time you play each UTC day. |
| Islander gifts | Small items once a day | 8 NPCs. |
| Chance games | SHELL, RF, loot | Every game pays back less than 100% (see below). |
| Kraken world boss | 30 RF shared by damage | Every 20 minutes, split among all hitters (players and rivals). |
| Voyages | SHELL, RF, relics, stock-token shares | Low odds on the long voyages (see below). |
| Season prizes | RF from the Season Pool | Top 10 each week. |
| Season Journey | SHELL and items on 10 tiers, 3 RF in total | Free for every player, resets weekly. |

## Where tokens go (sinks)

Every RF sink goes through the same split: **70% Season Pool / 25% creator / 5% burn.**

| Sink | RF cost |
|---|---|
| Ascension (level up) | `0.50 + 0.40 × level` RF, plus SHELL and materials |
| Volcano Forge (+1 to +10) | `round(20 × n^1.7)` centi-RF to reach +n, plus SHELL, ore and pearls |
| Homes | 2, 6, 15 and 40 RF for Hut, Cottage, Villa and Sea Castle |
| New regions | 0.5 to 5 RF each |
| Farm plots, Charms, Luck Scrolls | RF each |
| Voyages | 0.5 RF (Homeland), 2 RF (Reef Run), 4 RF (Trench) |
| Rebirth | `10 + 10 × rebirths` RF |
| Paid Tide Wheel spin | 1 RF |
| Lost RF stakes | Whatever you staked in a dive or dig that went wrong |
| Tide Pool swaps | 3% fee on every swap |

SHELL has its own sinks: building costs, bait, seeds, market purchases, the 2% stock-token sell fee and raid losses.
**Prosperity** rewards spending: every 5 RF you've spent adds +1% to SHELL earnings, up to +30%.

## Seasons

- Each season runs Monday 00:00 UTC to the next Monday.
- **Score = XP earned + 20 points per RF spent.**
- The top 10 split the pool 30 / 20 / 12 / 8 / 6 / 5 / 5 / 5 / 5 / 4%. 10% of the pool seeds the next season.
- Simulated island residents compete too, so a solo player always has a real ladder to climb.
- Claim your prize at the Bounty Board after the season ends.
- **Season Journey:** everyone also earns a free 10-tier track from season points (200 to 25,000). It pays SHELL,
  bait, charms, pearls, Luck Scrolls and materials, plus 3 RF in total across the last two tiers, so players outside the
  top 10 still get rewarded every week.

## Odds and costs of every risk

All chance games use a seeded random generator. In the on-chain roadmap they would move to Rare Friends Dice RNG.

**Ascension.** Needs full XP (`30 × level^1.5`). Success = `max(30%, 98% − 2.5% × level)`. Each failure in a row adds
+6% pity. A Luck Scroll adds +12%, being happy adds +5% and the Sparkling family adds +4%. **A failure spends the cost
but never lowers your level.** A Protection Charm refunds half the SHELL and materials.

**Forge.** Success to reach +1 to +10: 100, 95, 88, 78, 66, 55, 44, 33, 22 and 12%. Each failure adds +3% pity and a Luck
Scroll adds +10%. Failures never downgrade gear.

**Abyss Dive (crash).** Crash point = `(1 − edge) / U`. The edge is 4%, and the Coral Blade lowers it by 0.2% per level
down to a 2% floor. Payback is 96% at base. Every full 1× of depth adds a loot roll.

**Tide Mines.** A 5×5 grid with 1, 3, 5, 10 or 20 traps. The multiplier after k safe tiles is
`0.97 × Π (25−i)/(25−traps−i)`, for a payback of 97%.

**Double or nothing.** 48% to double (50% for the Asymmetry family), up to 5 flips.

**Fishing.** 6 SHELL bait and 5 energy. Base odds are 50% sardine, 26% clownfish, 15% tuna, 7% angler and **2% Golden
Nemo**. The Reef Rod and luck shift the odds toward rare fish.

**Tide Wheel.** One free spin every 8 hours, or 1 RF per spin.

| Prize | Chance |
|---|---|
| 40 SHELL | 33% |
| 90 SHELL | 21% |
| 6 ore + 3 coral | 18% |
| 1 RF | 10% |
| Protection Charm | 7% |
| 2 pearls | 6% |
| 3 RF | 4% |
| **Jackpot 25 RF** | 1% |

Expected RF back per paid spin is 0.47 RF.

**Raids.** Cost 15 energy. Win chance = `0.5 + 0.5 × (power − defense) / (power + defense)`, limited to 8 to 92%. A win
steals 10 to 22% of the target's unprotected vault. A loss costs a 5% clinic fee and 15 mood. Online victims lose at
most 10% and get an 8-minute shield.

**Kraken.** Rises every 20 minutes for 12 minutes with 60,000 shared HP. A hit costs 10 energy and deals power × 3
(±20%) damage. 15% of hits crit. Hitters split 30 RF by damage share.

## Voyages

Send your Friend away. The outcome is rolled when you set sail, so reloading can't change it. Level, gear, rebirths and
a good mood add up to +10 percentage points to the good outcomes. Recalling early returns nothing and costs mood.

| Voyage | Time | Cost | Base odds |
|---|---|---|---|
| Tide Scout | 15 min | 30 SHELL, 1 food | 50% wood and stone, 30% 60 to 140 SHELL, 10% coral and glass, 10% nothing |
| Homeland Voyage | 1 h | 0.5 RF, 120 SHELL, 2 food, level 3 | 30% pearls, 15% Luck Scrolls, **10% Family Relic**, 5% 1.5 to 4 RF, 40% storm (nothing) |
| Robinhood Reef Run | 6 h | 2 RF, 300 SHELL, 3 food, level 6 | 22% 0.1 to 0.6 shares, 6% 0.8 to 2 shares, **2% a full NVDA share**, 15% salvage, 55% nothing |
| Abyssal Trench | 12 h | 4 RF, 500 SHELL, 4 food, level 12 | **14% hoard of 8 to 24 RF**, 4% relic, 74% nothing, 8% lost at sea (lose 10% SHELL) |

- **Family Relic:** +2% XP forever, and relics stack. The Homeland Voyage sails to your Friend's own family island
  (Skeleton Isle, Mask Atoll, Cellular Reef and so on).
- **Stock tokens:** simulated shares themed on tokenized stocks trending on Robinhood Chain (NVDA, TSLA, AAPL, AMZN, MSFT,
  HOOD, COIN). The price is a deterministic formula that changes every hour and is the same for every player. Sell any
  time for SHELL with a 2% fee. They are game collectibles, not securities.
- **Tested:** a test rolls 20,000 voyages at the maximum bonus and checks that the RF voyages still return less RF than
  they cost. Voyages are a sink with a lottery upside, not a faucet.

## Simulation results

`npm run sim` plays scripted bots for 4 hours of game time each.

| Bot | Level | RF spent | RF won |
|---|---|---|---|
| Grinder 1 | 16 | 150.6 | 26.6 |
| Grinder 2 | 14 | 114.4 | 26.6 |
| Grinder 3 | 16 | 134.3 | 20.0 |
| Grinder 4 | 16 | 124.0 | 20.4 |
| Degen 1 | 8 | 32.6 | 13.1 |
| Degen 2 | 9 | 37.3 | 20.1 |
| Degen 3 | 7 | 29.4 | 10.3 |

Every style spends more RF than it wins (grinders about five times more). 70% of everything spent lands in the Season Pool, so players
can win it back.

## Going on-chain

1. A `SinkRouter` contract splits RF sinks 70/25/5 into a `SeasonPool` that pays the top 10 through Merkle claims.
2. $SHELL becomes an ERC-20 paired with RF in a real AMM, with creator fees on every swap.
3. Chance games and voyages settle through Rare Friends Dice RNG, with prize reserves backing every RF payout.
4. Homes, gear, relics and hats are bound to the Friend's token-bound wallet.
5. Raids and boss damage are validated by a server or by proofs before real value is at stake.
