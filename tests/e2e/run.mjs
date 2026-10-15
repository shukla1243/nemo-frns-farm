/**
 * End-to-end play in `friendsdk dev` (Playwright). Starts the public CLI (`npx friendsdk dev --port 4310`) as a
 * child process, plays two fixture Friends of different generations through the host exactly as the website mounts
 * the game, and always kills the child's process tree at the end. #117713 (Skeleton, generation 1) on desktop plays
 * the first chapters (grove, farm, fishing, Rock Cove, the hut) and a SHELL voyage, with reloads and a second browser
 * reading the island back from the server; #172863 (Mask, generation 2) plays on a phone. Also checks the host's
 * top-right corner and page errors. Screenshots go to artifacts/t5-7-*.png.
 *   npm run test:e2e
 *
 * Time moves with the dev panel's documented "+1 hour" control. That control only works once the dev state has a
 * dev.json, which `friendsdk dev` writes only for a game with actions, and "Reset all dev state" deletes it. Until
 * the economy lands (T8), the test starts from fresh state of its own: it empties .friendsdk/dev and writes a dev.json
 * without a record, then checks after every click (through the dev page's status read) that the clock moved.
 */
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

const PORT = 4310;
await rm(".friendsdk/dev", { recursive: true, force: true });
await mkdir(".friendsdk/dev", { recursive: true });
await writeFile(".friendsdk/dev/dev.json", JSON.stringify({ fingerprint: "", record: null, keeperOffline: false, clockOffsetMs: 0 }));
await mkdir("artifacts", { recursive: true });

const child = spawn(`npx friendsdk dev --port ${PORT} --host 127.0.0.1`, { shell: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
function killDev() {
  if (child.exitCode !== null || !child.pid) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch { /* already gone */ }
}
process.on("exit", killDev);
process.on("SIGINT", () => { killDev(); process.exit(130); });
const base = await new Promise((resolve, reject) => {
  let out = "";
  const timer = setTimeout(() => reject(new Error(`friendsdk dev did not start within 90 s:
${out}`)), 90_000);
  const read = chunk => {
    out += chunk;
    const m = /Dev host: (http:\/\/\S+)/.exec(out);
    if (m) { clearTimeout(timer); resolve(m[1]); }
  };
  child.stdout.on("data", read);
  child.stderr.on("data", read);
  child.on("exit", code => { clearTimeout(timer); reject(new Error(`friendsdk dev exited (${code}) before it started:
${out}`)); });
});

const browser = await chromium.launch();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok:", msg); };
const FOODS = ["bread", "kelp", "coconut", "carrot", "berry", "sardine", "clownfish", "pumpkin", "tuna", "sushi", "stew", "pie", "feast", "angler"];

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
      if ((await state()).energy < 8) { await laterBy1h(); await reload(); await travel(kind === "chop" ? "Palm Grove" : "Rock Cove"); }
      await ui.locator(".action-btn").click();
      await page.waitForTimeout(1300);
    }
  };
  /** The dev panel's "+1 hour" server clock control, checked through the dev page's status read. */
  const laterBy1h = async () => {
    const offset = async () => {
      const res = await page.evaluate(() => fetch("/__friendsdk/status").then(r => ({ ok: r.ok, body: r.ok ? r.json() : null })).then(async r => ({ ok: r.ok, body: await r.body })));
      if (!res.ok || typeof res.body?.controls?.clockOffsetMs !== "number") throw new Error("The dev page's status read is missing; cannot verify the server clock.");
      return res.body.controls.clockOffsetMs;
    };
    const before = await offset();
    const button = page.getByRole("button", { name: "+1 hour", exact: true });
    if (!(await button.count())) throw new Error('The dev panel has no "+1 hour" server clock control.');
    await button.click();
    for (let i = 0; i < 50 && (await offset()) === before; i++) await page.waitForTimeout(100);
    const after = await offset();
    if (after !== before + 3_600_000) throw new Error(`The dev clock did not move (${before} -> ${after}): friendsdk dev ignores it without a dev.json.`);
  };
  /** Cast and press REEL while the hook sits in the green, the way a player times it. */
  const fish = async () => {
    await ui.getByRole("button", { name: "Cast", exact: true }).click();
    const pressed = await frame().evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const reel = () => [...document.querySelectorAll("button")].find(b => /REEL/.test(b.textContent ?? ""));
      for (let i = 0; i < 300 && !reel(); i++) await sleep(20);
      let since = null;
      for (let i = 0; i < 1200; i++) {
        const z = document.querySelector(".reel-zone"), m = document.querySelector(".reel-marker");
        if (!z || !m || !reel()) return false;
        const left = parseFloat(z.style.left), width = parseFloat(z.style.width), at = parseFloat(m.style.left);
        const t = performance.now();
        if (at > left + width * 0.2 && at < left + width * 0.8) { since ??= t; if (t - since > 60) { reel().click(); return true; } } else since = null;
        await new Promise(r => requestAnimationFrame(r));
      }
      return false;
    });
    await ui.locator(".fishing.done").waitFor({ timeout: 8000 });
    return pressed;
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
  return { ctx, page, ui, errors, state, act, panel, shot, close, travel, reload, claim, gather, laterBy1h, fish, cornerFree, hudFits, storageKeys };
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
  await g.laterBy1h();
  await g.reload();
  await g.panel("farm");
  await ui.getByRole("button", { name: "Harvest", exact: true }).first().click();
  await page.waitForTimeout(500);
  check((await g.state()).stats.harvests >= 1, "desktop: the crop ripened on server time and was harvested");
  await g.close();
  await g.claim();

  // Chapter 3: fishing.
  await g.panel("dock");
  for (let i = 0; i < 4 && (await g.state()).stats.fish < 1; i++) {
    check(await g.fish(), "desktop: the REEL button came up and was pressed in the green");
    if (i === 0) await g.shot("desktop-4-fishing");
  }
  await g.close();
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
  await g.laterBy1h();
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
  killDev();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll e2e checks passed");
process.exit(failures ? 1 : 0);
