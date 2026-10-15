/**
 * End-to-end play in `friendsdk dev` (Playwright). Plays two fixture Friends of different generations through the
 * host exactly as the website mounts the game: #117713 (Skeleton, generation 1) on desktop and #172863 (Mask,
 * generation 2) on a phone. Covers the first chapters of the story (grove, farm, fishing, Rock Cove, the hut), a
 * SHELL voyage with the dev clock, reloads and a second browser reading the island back from the server, the
 * host's top-right corner and page errors. Screenshots go to artifacts/t5-7-*.png.
 *   npm run test:e2e                          starts its own dev server on fresh state and closes it
 *   npm run test:e2e -- --prepare             only writes fresh dev state, for a dev server started next
 *   npm run test:e2e -- http://localhost:4173 plays a running `friendsdk dev` started on prepared state
 *
 * The dev panel's server clock control only works once dev state has a record, and `friendsdk dev` writes one only
 * for a game with actions. Until the economy lands (T8), fresh state gets a dev.json without a record so the
 * clock control (`clockOffsetMs`) works.
 */
import { chromium } from "playwright";
import { mkdir, rm, writeFile } from "node:fs/promises";

async function prepare() {
  await rm(".friendsdk/dev", { recursive: true, force: true });
  await mkdir(".friendsdk/dev", { recursive: true });
  await writeFile(".friendsdk/dev/dev.json", JSON.stringify({ fingerprint: "", record: null, keeperOffline: false, clockOffsetMs: 0 }));
}
if (process.argv[2] === "--prepare") { await prepare(); process.exit(0); }
// FriendSDK 1.0 has no public programmatic dev API; this is the module `friendsdk dev` runs (its own e2e tests use it).
const devModule = new URL("../../node_modules/@rarefriends/friendsdk/dist/dev/server.js", import.meta.url);
if (!process.argv[2]) await prepare();
const dev = process.argv[2] ? null : await (await import(devModule.href)).startDev({ dir: process.cwd(), port: 4310, host: "127.0.0.1", reset: false, tokenExpirySec: 60, portExplicit: true });
const base = process.argv[2] ?? dev.hostUrl;
await mkdir("artifacts", { recursive: true });

const browser = await chromium.launch();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok:", msg); };
const MIN = 60_000;
const FOODS = ["bread", "kelp", "coconut", "carrot", "berry", "sardine", "clownfish", "pumpkin", "tuna", "sushi", "stew", "pie", "feast", "angler"];
let clockOffset = 0;

async function open(friendId, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(id => { if (window === window.top) try { localStorage.setItem("friendsdk-dev:friend", id); } catch { /* private mode */ } }, friendId);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  await page.goto(base);
  const ui = page.frameLocator("iframe");
  await ui.locator(".world canvas").waitFor({ timeout: 30000 });
  const frame = () => page.frames().find(f => f !== page.mainFrame());
  const state = () => frame().evaluate(() => window.__nff.state());
  const act = a => frame().evaluate(x => window.__nff.act(x), a);
  const panel = p => frame().evaluate(x => window.__nff.open(x), p);
  const shot = name => page.screenshot({ path: `artifacts/t5-7-${name}.png` });
  const close = async () => { const b = ui.getByRole("button", { name: "Close" }); if (await b.isVisible().catch(() => false)) await b.click(); await page.waitForTimeout(250); };
  const travel = async place => {
    await ui.getByRole("button", { name: "Island map and fast travel" }).click();
    await ui.getByRole("dialog", { name: "Island Map" }).getByRole("button", { name: place, exact: true }).click();
    await page.waitForTimeout(500);
  };
  const reload = async () => { await page.reload(); await ui.locator(".world canvas").waitFor({ timeout: 30000 }); await page.waitForTimeout(600); await close(); };
  const claim = async () => {
    await panel("story");
    const done = ui.getByRole("button", { name: "Complete chapter", exact: true });
    await done.waitFor({ timeout: 5000 });
    await done.click();
    await page.waitForTimeout(400);
    await close();
  };
  /** Keep the Friend fed and rested between actions, the way a player would. */
  const care = async () => {
    const s = await state();
    const food = FOODS.find(k => s.inv[k] > 0);
    if (s.hunger < 45 && food) await act({ type: "eat", item: food });
    if ((await state()).hunger < 45) await act({ type: "forage" });
  };
  const gather = async (kind, until) => {
    for (let i = 0; i < 60 && !(await until(await state())); i++) {
      await care();
      if ((await state()).energy < 8) { await setClock(clockOffset + 20 * MIN); await reload(); await travel(kind === "chop" ? "Palm Grove" : "Rock Cove"); }
      await ui.locator(".action-btn").click();
      await page.waitForTimeout(1300);
    }
  };
  const setClock = async ms => {
    clockOffset = ms;
    await page.evaluate(body => fetch("/__friendsdk/controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { clockOffsetMs: ms });
  };
  /** The host's full-screen button owns the top-right 52 x 52 px of the game box. */
  const cornerFree = () => frame().evaluate(() => {
    const W = innerWidth;
    const hits = [...document.querySelectorAll(".hud button, .hud .coin, .hud .sim-flag, .hud .toast")].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.right > W - 52 && r.top < 52;
    });
    return hits.map(el => el.className);
  });
  const hudFits = () => frame().evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll(".hud *")) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1)) bad.push(String(el.className));
    }
    return bad.slice(0, 5);
  });
  const storageKeys = () => frame().evaluate(() => Object.keys(localStorage));
  return { ctx, page, ui, errors, state, act, panel, shot, close, travel, reload, claim, gather, setClock, cornerFree, hudFits, storageKeys };
}

async function desktop() {
  const g = await open("117713", { width: 1280, height: 800 }, false);
  const { ui, page } = g;
  const story = ui.getByRole("dialog", { name: "Story Mode" });
  check(await story.isVisible(), "desktop: a new island opens on the story");
  await g.shot("desktop-1-story");
  await g.close();
  let s = await g.state();
  check(s.friendId === "117713" && s.family === 0 && s.trait === "bonediver" && s.name === "Friend #117713", "desktop: the server created the island with the on-chain family (Skeleton)");
  check((await g.cornerFree()).length === 0, `desktop: HUD keeps the top-right 52 x 52 free ${await g.cornerFree()}`);

  // Chapter 1: driftwood in the Palm Grove.
  await g.travel("Palm Grove");
  for (let i = 0; i < 3; i++) { await ui.locator(".action-btn").click(); await page.waitForTimeout(1300); }
  s = await g.state();
  check(s.stats.gathered >= 3 && s.inv.wood >= 3, `desktop: chopped driftwood on the server (wood ${s.inv.wood})`);
  await g.shot("desktop-2-grove");
  await g.claim();

  // Chapter 2: plant, come back later, harvest.
  await g.panel("farm");
  await ui.getByRole("button", { name: "Plant", exact: true }).first().click();
  await page.waitForTimeout(500);
  check(await ui.locator(".plot .bar").first().isVisible(), "desktop: a crop is growing");
  await g.shot("desktop-3-farm");
  await g.close();
  await g.setClock(2 * MIN);
  await g.reload();
  await g.panel("farm");
  await ui.getByRole("button", { name: "Harvest", exact: true }).first().click();
  await page.waitForTimeout(500);
  check((await g.state()).stats.harvests >= 1, "desktop: the crop ripened on server time and was harvested");
  await g.close();
  await g.claim();

  // Chapter 3: fishing.
  await g.panel("dock");
  await ui.getByRole("button", { name: "Cast", exact: true }).click();
  await ui.getByRole("button", { name: /REEL/ }).waitFor({ timeout: 6000 });
  await ui.getByRole("button", { name: /REEL/ }).click();
  await ui.locator(".fishing.done").waitFor({ timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  await g.shot("desktop-4-fishing");
  await g.close();
  for (let i = 0; i < 6 && (await g.state()).stats.fish < 1; i++) {
    await g.act({ type: "fishCast" });
    await g.act({ type: "fishReel", hit: true });
  }
  check((await g.state()).stats.fish >= 1, "desktop: caught a fish");
  await g.claim();

  // Chapter 4: Rock Cove.
  await g.panel("unlock:cove");
  await ui.getByRole("button", { name: "Unlock Rock Cove", exact: true }).click();
  await page.waitForTimeout(500);
  check((await g.state()).zones.cove, "desktop: Rock Cove unlocked");
  await g.claim();

  // Chapter 5: the Driftwood Hut (30 wood, 10 stone).
  await g.travel("Palm Grove");
  await g.gather("chop", st => st.inv.wood >= 30);
  await g.travel("Rock Cove");
  await g.gather("quarry", st => st.inv.stone >= 10);
  s = await g.state();
  check(s.inv.wood >= 30 && s.inv.stone >= 10, `desktop: gathered materials (wood ${s.inv.wood}, stone ${s.inv.stone})`);
  await g.panel("home");
  await ui.getByRole("button", { name: "Build Driftwood Hut", exact: true }).click();
  await page.waitForTimeout(600);
  check((await g.state()).home === 1, "desktop: built the Driftwood Hut");
  await g.shot("desktop-5-hut");
  await g.close();
  await g.claim();

  // Chapter 6: a SHELL voyage, back after the dev clock moves 20 minutes.
  const before = await g.state();
  await g.panel("pier");
  await ui.getByRole("button", { name: /Set sail \(15 min\)/ }).first().click();
  await page.waitForTimeout(600);
  s = await g.state();
  check(s.voyage?.id === "scout" && s.shell < before.shell, "desktop: a Tide Scout voyage left and SHELL was paid");
  await g.shot("desktop-6-voyage");
  await g.close();
  await g.setClock(clockOffset + 20 * MIN);
  await g.reload();
  await g.panel("pier");
  await ui.getByRole("button", { name: "Open the voyage chest", exact: true }).click();
  await page.waitForTimeout(800);
  s = await g.state();
  check(s.voyage === null && s.stats.voyages >= 1, "desktop: the voyage chest opened on the server");
  await g.shot("desktop-7-voyage-chest");
  await g.close();
  await g.claim();

  // Progress comes back from the server: after a reload and in a second browser with empty storage.
  const saved = await g.state();
  await g.reload();
  const again = await g.state();
  check(again.story === saved.story && again.home === saved.home && again.inv.wood === saved.inv.wood && again.stats.voyages === saved.stats.voyages, `desktop: a reload shows the same island (chapter ${again.story}, hut ${again.home})`);
  await g.shot("desktop-8-reloaded");
  check((await g.storageKeys()).length === 0, `desktop: nothing is kept in the game's localStorage (${await g.storageKeys()})`);
  const other = await open("117713", { width: 1280, height: 800 }, false);
  const remote = await other.state();
  check(remote.story === saved.story && remote.home === 1 && remote.stats.voyages === saved.stats.voyages, "desktop: a second browser reads the same island from the server");
  check(other.errors.length === 0, `desktop (second browser): no page errors ${other.errors.slice(0, 3).join(" | ")}`);
  await other.ctx.close();
  check(g.errors.length === 0, `desktop: no page errors ${g.errors.slice(0, 3).join(" | ")}`);
  await g.ctx.close();
}

async function phone() {
  const g = await open("172863", { width: 390, height: 844 }, true);
  const { ui, page } = g;
  check(await ui.getByRole("dialog", { name: "Story Mode" }).isVisible(), "phone: a new island for another generation opens on the story");
  await g.shot("phone-1-story");
  await g.close();
  const s = await g.state();
  check(s.friendId === "172863" && s.family === 1 && s.trait === "trickster" && s.inv.wood === 0 && s.story === 0, "phone: #172863 (Mask, generation 2) has its own island");
  check((await g.hudFits()).length === 0, `phone: HUD fits the viewport ${await g.hudFits()}`);
  check((await g.cornerFree()).length === 0, `phone: HUD keeps the top-right 52 x 52 free ${await g.cornerFree()}`);
  await g.shot("phone-2-world");
  await g.travel("Palm Grove");
  for (let i = 0; i < 3; i++) { await ui.locator(".action-btn").click(); await page.waitForTimeout(1300); }
  check((await g.state()).stats.gathered >= 3, "phone: chopped driftwood");
  await g.shot("phone-3-grove");
  await g.claim();
  await ui.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(400);
  await g.shot("phone-4-play");
  await g.close();
  await ui.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = ui.getByRole("dialog", { name: "Settings" });
  await settings.getByLabel("Reduce motion (no shake, confetti or wave animation)").check();
  await page.waitForTimeout(500);
  await g.shot("phone-5-settings");
  await g.close();
  await g.reload();
  await ui.getByRole("button", { name: "Settings", exact: true }).click();
  check(await ui.getByRole("dialog", { name: "Settings" }).getByLabel("Reduce motion (no shake, confetti or wave animation)").isChecked(), "phone: settings come back from the server after a reload");
  await g.close();
  check((await g.state()).story === 1, "phone: the story chapter persists");
  check(g.errors.length === 0, `phone: no page errors ${g.errors.slice(0, 3).join(" | ")}`);
  await g.ctx.close();
}

try {
  await desktop();
  await phone();
} finally {
  await browser.close();
  await dev?.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll e2e checks passed");
process.exit(failures ? 1 : 0);
