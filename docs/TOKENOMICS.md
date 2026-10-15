# NEMO FRNS FARM tokenomics

> Everything below is **simulated**. No real funds, transactions or securities. The game holds no RF.
> Every number here comes straight from `src/engine/config.ts` and `src/engine/voyages.ts` and is covered by tests.

## The short version

- **One currency.** `$SHELL` is the island currency you earn and spend by playing. The game keeps no RF balance:
  real RF cannot live in a game server ledger, so every former RF price and prize became SHELL at 1 RF = 150 SHELL.
- **Spending pays you back.** SHELL you spend on purchases and upgrades raises your Prosperity (more SHELL from sales
  and bounties) and your weekly season score.
- **One promise:** every chance game shows its odds and pays back less than it takes in.
- **Real RF later.** Paid charters, a paid Tide Wheel and cosmetics are planned on the Rare Friends platform contracts.
  They are not implemented in this build.

## Where SHELL comes from (faucets)

| Source | Gives | Notes |
|---|---|---|
| Start | 3,120 SHELL, 4 kelp seeds, 5 bait, 2 bread | Includes the old 20 RF starting grant. |
| Chopping, quarrying, farming, fishing | SHELL (via selling), materials, food | The main income. Hunger below 25 cuts yields 25%. |
| Crab Dash | 3 SHELL per point, bait at 60+, a pearl at 100+ | Skill game, 6 energy per round. |
| Bounties and story chapters | SHELL and items | Act I to III chapter rewards grow slowly and never end. |
| Milestones (15 tracks, infinite tiers) | `25 × tier^1.6` SHELL, plus `37.5 × tier` every third tier | Paid automatically. |
| Daily streak | 40 to 280 SHELL, bait, +150 SHELL and a Charm on day 7 | The first time you play each UTC day. |
| Islander gifts | Small items once a day | 8 NPCs. |
| Chance games | SHELL and loot | Every game pays back less than 100% (see below). |
| Kraken world boss | 4,500 SHELL shared by damage, plus 50 SHELL and damage / 20 | Every 20 minutes. |
| Voyages | SHELL, items, relics, island company shares | Low odds on the long voyages (see below). |
| Season Journey | SHELL and items on 10 tiers | Free for every player, resets weekly. |

## Where SHELL goes (sinks)

| Sink | SHELL cost |
|---|---|
| Ascension (level up) | `75 + 90 × level`, plus materials |
| Volcano Forge (+1 to +10) | `round(30 × n^1.7) + 25 × n` to reach +n, plus ore and pearls |
| Homes | 400, 1,300, 3,450 and 10,000 for Hut, Cottage, Villa and Sea Castle, plus materials |
| New regions | 175 to 1,950 each |
| Farm plots | `round(60 × n^1.5) + 45 × n` for the nth extra plot |
| Charms, Luck Scrolls | 225 and 150 |
| Voyages | 30 (Scout), 195 (Homeland), 600 (Salvage Run), 1,100 (Trench) |
| Rebirth | `1,500 + 1,500 × rebirths` |
| Seeds, bait, bread, Kelp Brew, traps | Market prices |
| Losses | Lost stakes, raid clinic fees, rival raids, tent crabs (at most 75 a night), lost at sea |

**Prosperity:** every 2,000 SHELL spent on purchases and upgrades adds +1% to SHELL from sales and bounties, up to +30%.

## Seasons

- Each season runs Monday 00:00 UTC to the next Monday.
- **Score = XP earned + 1 point per 20 SHELL spent.**
- Simulated island residents compete on the board, so a solo player always has a ladder to climb. There is no
  prize pool.
- **Season Journey:** everyone earns a free 10-tier track from season points (200 to 25,000). It pays SHELL, bait,
  charms, pearls, Luck Scrolls, materials and a feast.

## Odds and costs of every risk

All chance games use a seeded random generator that mixes in server time and the action, and every roll happens when
its outcome is revealed, so stored state never holds a hidden result.

**Ascension.** Needs full XP (`30 × level^1.5`). Success = `max(30%, 98% − 2.5% × level)`. Each failure in a row adds
+6% pity. A Luck Scroll adds +12%, being happy adds +5% and the Sparkling family adds +4%. **A failure spends the cost
but never lowers your level.** A Protection Charm refunds half the SHELL and materials.

**Forge.** Success to reach +1 to +10: 100, 95, 88, 78, 66, 55, 44, 33, 22 and 12%. Each failure adds +3% pity and a Luck
Scroll adds +10%. Failures never downgrade gear.

**Abyss Dive (crash).** Rolled when you cash out: at multiplier m you survive with chance `(1 − edge) / m` and win
`stake × m`. The edge is 4%, and the Coral Blade lowers it by 0.2% per level down to a 2% floor. Payback is 96% at
base. Every full 1× of depth adds a loot roll that lands with chance `stake / 4,000` (capped at 1), so loot never
beats the edge at any stake.

**Tide Mines.** A 5×5 grid with 1, 3, 5, 10 or 20 traps. Each dig is a trap with chance traps / hidden tiles. The
multiplier after k safe tiles is `0.97 × Π (25−i)/(25−traps−i)`, for a payback of 97%. Each safe dig drops loot with chance `stake / 10,000`. The
Hollow Belly safe hint is left out of the odds: a hint run prices only the other tiles, on a 24-tile board.

**Double or nothing.** 48% to double (50% for the Asymmetry family), up to 5 flips. The win must still be in your
wallet, and a loss takes all of it.

**Fishing.** 6 SHELL bait and 5 energy. Base odds are 50% sardine, 26% clownfish, 15% tuna, 7% angler and **2% Golden
Nemo**. The Reef Rod and luck shift the odds toward rare fish.

**Tide Wheel.** One free spin every 8 hours.

| Prize | Chance |
|---|---|
| 40 SHELL | 33% |
| 90 SHELL | 21% |
| 6 ore + 3 coral | 18% |
| 150 SHELL | 10% |
| Protection Charm | 7% |
| 2 pearls | 6% |
| 450 SHELL | 4% |
| **Jackpot 3,750 SHELL** | 1% |

**Raids.** Simulated rivals only. Cost 15 energy. Win chance = `0.5 + 0.5 × (power − defense) / (power + defense)`,
limited to 8 to 92%. A win steals 10 to 22% of the rival's vault, with a 15% chance of 30 to 120 bonus SHELL. A loss
costs a 5% clinic fee and 15 mood.

**Kraken.** Rises every 20 minutes for 12 minutes with 60,000 HP shared with simulated hunters. A hit costs 10 energy
and deals power × 3 (±20%) damage. 15% of hits crit. Hitters split 4,500 SHELL by damage share.

## Voyages

Send your Friend away. The Voyage Pier opens once the story chapter "A Roof Over Fins" is done. The odds lock when
you set sail and the outcome is rolled when you open the chest. Level, gear, rebirths and a good mood add up to +10
percentage points to the good outcomes. Recalling early returns nothing and costs mood.

| Voyage | Time | Cost | Base odds |
|---|---|---|---|
| Tide Scout | 15 min | 30 SHELL, 1 food | 50% wood and stone, 30% 60 to 140 SHELL, 10% coral and glass, 10% nothing |
| Homeland Voyage | 1 h | 195 SHELL, 2 food, level 3 | 30% pearls, 15% Luck Scrolls, **10% Family Relic**, 5% 225 to 600 SHELL, 40% storm (nothing) |
| Shipwreck Salvage Run | 6 h | 600 SHELL, 3 food, level 6 | 22% 0.1 to 0.6 shares, 6% 0.8 to 2 shares, **2% a full FINX share**, 15% salvage, 55% nothing |
| Abyssal Trench | 12 h | 1,100 SHELL, 4 food, level 12 | **14% hoard of 1,200 to 3,600 SHELL**, 4% relic, 74% nothing, 8% lost at sea (lose 10% SHELL) |

- **Family Relic:** +2% XP forever, and relics stack. The Homeland Voyage sails to your Friend's own family island
  (Skeleton Isle, Mask Atoll, Cellular Reef and so on).
- **Island company shares:** simulated shares in fictional NEMO sea companies: Finlight Lanterns (FINX), Urchin
  Motorworks (URCH), Clamshell Devices (CLAM), Krill Freight Co. (KRLL), Kelpsoft Systems (KELP), Gullwing Traders (GULL)
  and Doubloon Bay Mint (DUBL). The price is a deterministic formula that changes every hour and is the same for every
  player. Sell any time at the Tide Pool for SHELL with a 2% fee. They are game collectibles, not securities.
- **Tested:** a test rolls 20,000 voyages at the maximum bonus and checks that the long voyages return less SHELL than
  they cost. Voyages are a sink with a lottery upside, not a faucet.

## Simulation results

`npm run sim` plays scripted bots. Risk net is the SHELL plus loot (at sell price) the bot gained or lost at the chance
games.

| Bot | Hours | Level | Home | SHELL spent | Prosperity | Risk net |
|---|---|---|---|---|---|---|
| Grinder 1 | 4 | 15 | Hut | 44,791 | 22% | -1,149 |
| Grinder 2 | 4 | 15 | Hut | 45,683 | 22% | +811 |
| Grinder 3 | 4 | 15 | Hut | 51,685 | 25% | +1,418 |
| Grinder 4 | 4 | 17 | Hut | 47,230 | 23% | -6,951 |
| Degens (9 bots) | 4 | 18 to 20 | Cottage or Villa | 49,278 to 61,452 | 24 to 30% | median -12,206 |
| New players (8 bots) | 0.5 | 6 to 8 | Hut | 8,060 to 11,617 | 4 to 5% | |

The chance games net every style negative overall; a single degen can run hot because stakes scale with the balance.
New players reach level 6 to 8 and a hut in the first half hour, as fast as the RF-era economy (level 5 to 7).

## Going on-chain

Real RF moves only through the Rare Friends platform contracts, never through the game server. The port plan maps paid
voyage charters and a paid Tide Wheel onto Draw actions with RF prize rows, and cosmetics onto one-row Draw actions that
mint GameItems. None of that is implemented in this build.
