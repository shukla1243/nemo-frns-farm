/** Hand-authored pixel icons (auto-outlined, padded to 18×18). No emoji anywhere in the game. */
import { Painter, cached, fromMap, type Sprite } from "./pixel";

const FISH = [
  "....AAAA.....",
  "..AAAEAAAA..A",
  ".AAkAEAAAAAAA",
  ".AAAAEAAAAAAA",
  ".DDDDEDDDDD.D",
  "..DDDEDDDD..D",
  "....DDDD.....",
];
const PACKET = [
  "..YYYYYY..",
  ".YYYYYYYY.",
  ".YFFFFFFY.",
  ".YFhFFhFY.",
  ".YFFhhFFY.",
  ".YFFFFFFY.",
  ".YYYYYYYY.",
  "..SSSSSS..",
];

export const CRAB_ROWS = [
  "rr.......rr",
  "rRr.....rRr",
  ".rr.k.k.rr.",
  "..r.r.r.r..",
  ".rrRRRRRrr.",
  "rrRRRRRRRrr",
  ".rrrrrrrrr.",
  "r.r.....r.r",
];

const MAPS: Record<string, readonly string[] | { map: readonly string[]; swap: Record<string, string> }> = {
  wood: ["..WWWWWWWWy.", ".WWwWWWWWyYy", ".WWWWWwWWyKy", ".WwWWWWWWyYy", ".WWWWwWWWyYy", "..wwwwwwwwy."],
  stone: ["...XXXX...", "..XzzXXXx.", ".XzXXXXXxx", ".XXXXXxXxx", "XXXXXXXXxx", ".xXXXXXxx.", "..xxxxxx.."],
  ore: ["...XXXX...", "..XuUXXXx.", ".XXuXXcXxx", ".XXXXXcCxx", "XXcXXXXXxx", ".xXXuUXxx.", "..xxxxxx.."],
  coral: ["..m...m...", ".mMm.mMm.m", "..mMmMm.mM", "...mMMmmM.", "....mMMm..", "....mMm...", "...mmmmm.."],
  glass: ["....cC....", "...cCCc...", "..cCcccB..", ".cCccccBB.", "..cccBBB..", "...cBBB...", "....BB...."],
  pearl: ["...zzzz...", "..zeeCzz..", ".zeCezzzX.", ".zCzzzzzX.", ".zzzzzzXX.", "..zzzzXX..", "...XXXX..."],
  kelp: [".....h....", "....hG..h.", "..h.hG.hG.", "..GhGg.G..", "...GGg.Gg.", "...gGgGg..", "....gGg...", "....gg...."],
  carrot: ["......hG.h", ".....hGhG.", ".....GhG..", "....oOo...", "...oOoo...", "..oOoo....", ".oOoo.....", ".oo......."],
  berry: ["....hG....", "...G.G....", "..pBp.pB..", ".pPBBpPBp.", ".pBBBpBBp.", "..pBp.pp..", "...p......"],
  pumpkin: [".....Gg...", "......g...", "..OoooOoo.", ".OouoOouoo", ".oOoooOooo", ".oOoooOool", "..oloooll."],
  sardine: { map: FISH, swap: { A: "X", D: "z", E: "C" } },
  clownfish: { map: FISH, swap: { A: "o", D: "O", E: "e" } },
  tuna: { map: FISH, swap: { A: "b", D: "z", E: "B" } },
  angler: { map: FISH, swap: { A: "V", D: "p", E: "u" } },
  goldnemo: { map: FISH, swap: { A: "u", D: "U", E: "e" } },
  sushi: ["..OoOoOoO.", ".OoOoOoOoO", ".eeggeeeee", ".eeggeeCee", "..eggeeee."],
  stew: ["..e.e.e...", "...e.e....", ".oOLoOLo..", "yWWWWWWWWy", ".WyyyyyyW.", "..WWWWWW..", "...wwww..."],
  pie: ["...yYyYy...", "..yYyYyYyy.", ".yYpPpPpYy.", ".WyyyyyyyyW", "..WWWWWWWW."],
  feast: ["....oO.u...", "..hoOoOuUu.", ".BBBBoOuu..", "zzzzzzzzzzz", ".xzzzzzzzx."],
  kelpSeed: { map: PACKET, swap: { F: "G" } },
  carrotSeed: { map: PACKET, swap: { F: "o" } },
  berrySeed: { map: PACKET, swap: { F: "p" } },
  pumpkinSeed: { map: PACKET, swap: { F: "u" } },
  coconut: ["...wwww...", "..wWWWww..", ".wWkWkWww.", ".wWWWWWww.", ".wWWkWWww.", "..wwwwww.."],
  bread: ["..yyyyyy..", ".yYyYyYyy.", "yYYYYYYYyy", "yyyyyyyyyW", ".WWWWWWWW."],
  bait: [".......RR.", "......R..R", "..mR..R...", ".m..R.R...", ".m...R....", "..mm......"],
  blessing: ["WyYYYYYYyW", "wyYkkYkYyw", ".yYYYYYYy.", ".yYkYkkYy.", ".yYYYYYYy.", "WyYYYYYYyW", "wwyyyyyyww"],
  energyDrink: ["....zz....", "....XX....", "...GhhG...", "..GGGGGG..", "..GYuYYG..", "..GYuuYG..", "..GYYuYG..", "..GGGGGG..", "..gggggg.."],
  trap: ["..X..X..X.", ".zX.zX.zX.", ".XX.XX.XX.", "wWWWWWWWWw", "wwwwwwwwww"],
  shell: ["....MMMM....", "..MMeMMeMM..", ".MeMMeMMeMM.", ".MMeMMeMMeM.", "MeMMeMMeMMeM", ".MMeMMeMMeM.", "..MMMMMMMM..", "....mmmm...."],
  hunger: ["......eCe", "......eee", ".....yW..", "..WWWWW..", ".WyyWWWW.", ".WyWWWWW.", ".WWWWWWw.", "..wwwww.."],
  energy: [".....uuu.", "....uuU..", "...uuU...", "..uuuuuu.", ".....uU..", "....uU...", "...uU....", "..uU....."],
  bag: ["...wwww...", "..w....w..", ".WWWWWWWW.", ".WyyyyyyW.", ".WyWWWWyW.", ".WyWuuWyW.", ".WyWWWWyW.", ".WWWWWWWW."],
  board: [".wwwwwwww.", ".wYYYYYYw.", ".wYkkkkYw.", ".wYYYYYYw.", ".wYkkkYYw.", ".wYYYYYYw.", ".wwwwwwww.", "..w....w.."],
  emote: [".eeeeeeee.", "eeRReRReee", "eeRRRRRRee", "eeeRRRReee", ".eeeRReee.", "..ee......", ".e........"],
  soundOn: ["...X.....", "..XX..c..", "XXXX.c.c.", "XXXX.c.c.", "..XX..c..", "...X....."],
  soundOff: ["...X.....", "..XX.R.R.", "XXXX..R..", "XXXX.R.R.", "..XX.....", "...X....."],
  lock: ["..XXXX..", ".X....X.", ".X....X.", "uuuuuuuu", "uUUUUUUu", "uUUkkUUu", "uUUkkUUu", "uuuuuuuu"],
  book: [".rrrrrrr.", ".rYYYYYYr", ".rYkkkYYr", ".rYYYYYYr", ".rYkkYYYr", ".rYYYYYYr", ".rrrrrrrr", "..eeeeeee"],
  trophy: ["uu.uuuu.uu", "u.uUUUUu.u", ".uuUUUUuu.", "..uUUUUu..", "...uUUu...", "....uu....", "...uuuu...", "..llllll.."],
  star: ["....u....", "....u....", "...uUu...", "uuuuUuuuu", ".uuUUUuu.", "..uUUUu..", "..uu.uu..", ".uu...uu."],
  sword: [".........zz", "........zez", ".......zez.", "......zez..", "..w..zez...", "...wzez....", "...ywz.....", "..yw.w.....", ".yy........"],
  shield: [".XXXXXXXX.", ".XBBBBBBX.", ".XBBeeBBX.", ".XBeBBeBX.", ".XBBBBBBX.", "..XBBBBX..", "...XBBX...", "....XX...."],
  heart: [".RR..RR.", "RReRRRRR", "RRRRRRRR", ".RRRRRR.", "..RRRR..", "...RR..."],
  fire: ["....o.....", "...oO.....", "...oOo..o.", "..oOUOo.oo", ".oOUUUOoO.", ".oUUUUUOo.", ".oOUUUOo..", "..ooooo..."],
  rod: [".........w", "........w.", ".......w.c", "......w..c", ".....w...c", "....W....c", "...W.....c", "..W......R", ".WW......."],
  pick: [".zzzzzz...", "zz....zzw.", ".......w..", "......w...", ".....w....", "....w.....", "...w......", "..w......."],
  blade: [".........zz", "........zez", ".......zez.", "......zez..", "..m..zez...", "...mzez....", "...Mmz.....", "..Mm.m.....", ".MM........"],
  home: ["....rr....", "...rrrr...", "..rrrrrr..", ".rrrrrrrr.", "..yyyyyy..", "..yWyyWy..", "..yWykky..", "..yyykky.."],
  crown: ["u..u..u", "uu.u.uu", "uuuuuuu", "uRuuuBu", "uuuuuuu"],
  skull: [".zzzzzz.", "zzzzzzzz", "zkkzzkkz", "zkkzzkkz", "zzzzzzzz", ".zzkkzz.", ".zzzzzz.", "..z.z.z."],
  check: [".......G", "......GG", ".G...GG.", ".GG.GG..", "..GGG...", "...G...."],
  close: ["R.....R", ".R...R.", "..R.R..", "...R...", "..R.R..", ".R...R.", "R.....R"],
  help: ["..BBBB..", ".BeeeeB.", "BBeBBeBB", "BBBBeeBB", "BBBeeBBB", "BBBBBBBB", ".BBeeBB.", "..BBBB.."],
  settings: ["...X.X...", ".XXXXXXX.", ".XzzzzzX.", "XXz...zXX", ".Xz...zX.", "XXz...zXX", ".XzzzzzX.", ".XXXXXXX.", "...X.X..."],
  clock: ["..zzzz..", ".zeeeez.", "zeekeeez", "zeekeeez", "zeekkkez", "zeeeeeez", ".zeeeez.", "..zzzz.."],
  zz: ["BBBB.....", "..B......", ".B.......", "BBBB.cccc", ".......c.", "......c..", ".....cccc"],
  globe: ["..BBBB..", ".BGGBBB.", "BGGGBBGB", "BBGBBGGB", "BBBBGGGB", "BGBBBGBB", ".BGBBBB.", "..BBBB.."],
  wave: ["..........", "...CC.....", "..CcBC....", ".CcBBBC...", "CcBBBBBCCC", "BBBBBBBBBB", "bbbbbbbbbb"],
  chest: [".wwwwwwww.", "wWWWWWWWWw", "wWWWuuWWWw", "wwwwuuwwww", "wWWWWWWWWw", "wWWWWWWWWw", "wwwwwwwwww"],
  dice: ["eeeeeee", "ekeeeke", "eeeeeee", "eeekeee", "eeeeeee", "ekeeeke", "eeeeeee"],
  spark: ["...u...", "...U...", ".u.U.u.", "uUUeUUu", ".u.U.u.", "...U...", "...u..."],
  map: ["YYYyYYYy", "YGGyYBBy", "YGGyBBBy", "YYGyBBYy", "YYYyYYYy"],
  swap: ["...o....", "..oo....", ".oooooo.", "..oo..B.", "...o..BB", ".BBBBBBB", "......BB", "......B."],
  flag: ["kRRRR", "kRRRRR", "kRRRR", "k", "k", "k", "k"],
  sub: ["......k...", "......k...", "..uuuuuu..", ".uUUcuuuuu", "uuUcCcuuuu", "uuuUcuuuuk", ".uuuuuuuu.", "..l....l.."],
  anchor: ["...zz...", "..z..z..", "...zz...", "...XX...", "z..XX..z", "zz.XX.zz", ".zzXXzz.", "..zzzz.."],
  pointer: ["kkkkkkk", ".kuUuk.", "..kuk..", "...k..."],
  person: ["..oo..", ".oOOo.", ".oOOo.", "..oo..", ".BBBB.", "BBBBBB", "BBBBBB"],
  crab: CRAB_ROWS,
  crabGold: { map: CRAB_ROWS, swap: { r: "u", R: "U" } },
  clamTrap: ["..ppppppp..", ".pPPpPPpPp.", "pPPpPPpPPpp", "e.e.e.e.e.e", "rrrrrrrrrrr", ".e.e.e.e.e.", "pPPpPPpPPpp", ".ppppppppp."],
};

/** Round icons drawn with the painter. */
const PAINTED: Record<string, () => Sprite> = {
  rf: () => {
    const p = new Painter(16, 16);
    p.ellipse(8, 8, 7, 7, "l").ellipse(8, 8, 6, 6, "u").ellipse(7, 7, 4, 4, "U");
    p.draw(fromMap(["..o..", ".oOo.", ".oOo.", "oOUOo", "oOUOo", ".ooo."]), 6, 5);
    return p.done();
  },
  charm: () => {
    const p = new Painter(14, 14);
    p.ellipse(7, 7, 6, 6, "B").ellipse(7, 7, 4, 4, "e").ellipse(7, 7, 2, 2, "c").px(7, 7, "n").px(6, 6, "e");
    return p.done();
  },
  moodHappy: () => face("u", ["e..e", "....", "k..k", ".kk."]),
  moodOk: () => face("u", ["e..e", "....", "....", "kkkk"]),
  moodSad: () => face("R", ["e..e", "....", ".kk.", "k..k"]),
  coin: () => new Painter(12, 12).ellipse(6, 6, 5, 5, "u").ellipse(5, 5, 3, 3, "U").done(),
};
function face(c: string, mouth: string[]) {
  const p = new Painter(14, 14);
  p.ellipse(7, 7, 6, 6, c).ellipse(6, 6, 4, 4, c === "u" ? "U" : "M");
  p.draw(fromMap(mouth.map(r => r.replace(/e/g, "k"))), 5, 5);
  return p.done();
}

const isMap = (d: unknown): d is readonly string[] => Array.isArray(d);

/** 18×18 icon, centred, with a dark 1px outline. */
export function icon(id: string): Sprite {
  return cached(`icon:${id}`, () => {
    const def = MAPS[id];
    const raw = def ? (isMap(def) ? fromMap(def) : fromMap(def.map, def.swap)) : PAINTED[id]?.() ?? fromMap(["RR", "RR"]);
    const p = new Painter(18, 18);
    p.draw(raw, Math.floor((18 - raw.width) / 2), Math.floor((18 - raw.height) / 2));
    return p.outline("k").done();
  });
}
