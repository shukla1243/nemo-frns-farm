/**
 * End-to-end browser check (Playwright). Serves the production build and plays the guest flow on
 * desktop and phone viewports: title → Friend → story → walk → chop → panels → farm → swap →
 * wheel → fishing → NPC dialogue → map fast travel. Fails on page errors and layout overflow.
 *   npm run build && npm run test:e2e
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve("dist");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const body = await readFile(join(root, path === "/" ? "index.html" : path));
    res.writeHead(200, { "content-type": types[extname(path)] ?? "text/html" });
    res.end(body);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise(r => server.listen(4180, "127.0.0.1", r));
await mkdir("artifacts", { recursive: true });

const browser = await chromium.launch();
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok:", msg); };

async function scenario(name, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/WebSocket|wss:|net::|Failed to load resource|ICE|RTCPeer|relay|fonts/i.test(m.text())) errors.push(`console: ${m.text()}`); });

  await page.goto("http://127.0.0.1:4180/");
  await page.getByRole("button", { name: /Try as guest/ }).click();
  await page.getByRole("button", { name: /Sample Friend #1\b/ }).click();
  await page.waitForSelector(".world canvas", { timeout: 20000 });
  await page.getByRole("dialog", { name: "Story Mode" }).waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "Close" }).click();
  await page.waitForTimeout(800);

  const overflow = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    for (const el of document.querySelectorAll(".hud *")) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1)) bad.push(`${el.className || el.tagName}`);
    }
    return bad.slice(0, 5);
  });
  check(overflow.length === 0, `${name}: HUD fits viewport ${overflow.join(" | ")}`);

  const canvas = page.locator(".world canvas");
  const box = await canvas.boundingBox();
  const pos = () => page.evaluate(() => { const c = document.querySelector(".world canvas"); return { x: +c.dataset.x, y: +c.dataset.y }; });
  const toScreen = async (wx, wy) => {
    const d = await page.evaluate(() => { const c = document.querySelector(".world canvas"); return { cx: +c.dataset.camx, cy: +c.dataset.camy, k: +c.dataset.scale }; });
    return { x: box.x + (wx / 2.5 - d.cx) * d.k, y: box.y + (wy / 2.5 - d.cy) * d.k };
  };
  const clampTap = async (wx, wy) => {
    // Step toward the target but only tap inside a safe central area (never on HUD widgets).
    const p = await toScreen(wx, wy);
    const cx = box.x + box.width / 2, cy = box.y + box.height * (mobile ? 0.6 : 0.55);
    const hw = box.width * 0.28, hh = box.height * (mobile ? 0.14 : 0.2);
    let dx = p.x - cx, dy = p.y - cy;
    const k = Math.min(1, hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
    dx *= k; dy *= k;
    await page.mouse.click(cx + dx, cy + dy);
  };
  const travel = async place => {
    await page.getByRole("button", { name: "Island map and fast travel" }).click();
    await page.getByRole("dialog", { name: "Island Map" }).getByRole("button", { name: place, exact: true }).click();
    await page.waitForTimeout(500);
  };
  const visit = async (wx, wy, dialog) => {
    for (let i = 0; i < 14; i++) {
      if (await page.getByRole("dialog", { name: dialog }).isVisible().catch(() => false)) return true;
      await clampTap(wx, wy);
      await page.waitForTimeout(1300);
      if (process.env.DEBUG_WALK) console.log("walk", dialog, JSON.stringify(await pos()));
    }
    return page.getByRole("dialog", { name: dialog }).isVisible();
  };

  // Fast travel to the Palm Grove and chop wood.
  await travel("Palm Grove");
  const p0 = await pos();
  check(Math.hypot(p0.x - 560, p0.y - 1240) < 60, `${name}: map fast travel to Palm Grove`);
  const chop = page.locator(".action-btn");
  check(await chop.isVisible(), `${name}: action button near the woodpile`);
  for (let i = 0; i < 4; i++) { await chop.click(); await page.waitForTimeout(1300); }
  await page.waitForTimeout(10500); // autosave interval
  const saved = await page.evaluate(() => {
    const c = localStorage.getItem("nemo-frns-farm:save:guest-1");
    if (!c) return null;
    const b = atob(c.split(".")[2]);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, ch => ch.charCodeAt(0))));
  });
  check(saved && saved.inv.wood >= 4, `${name}: chopped wood is saved (${saved?.inv?.wood})`);

  // HUD panels open and fit.
  for (const [label, dialog, viaPlay] of [["Backpack", "Backpack"], ["Season and leaderboards", "Bounty Board", true], ["Settings", "Settings & Saves"], ["How to play and lore", "How to play", true], ["Notifications", "Notifications"]]) {
    if (viaPlay) await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByRole("button", { name: label, exact: !viaPlay && label !== "Notifications" }).click();
    const d = page.getByRole("dialog", { name: dialog });
    check(await d.isVisible(), `${name}: open ${dialog}`);
    await page.waitForTimeout(350);
    const bad = await d.evaluate(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || el.scrollWidth > el.clientWidth + 1; });
    check(!bad, `${name}: ${dialog} fits the screen`);
    await page.getByRole("button", { name: "Close" }).click();
  }

  // Story chapter 1 is complete after chopping: claim it.
  await page.locator(".quest-note").click({ force: true });
  await page.getByRole("button", { name: /Complete chapter/ }).click();
  await page.waitForTimeout(300);
  check(await page.getByText("Chapter 2 of 15").isVisible(), `${name}: story advances to chapter 2`);
  await page.getByRole("button", { name: "Close" }).click();

  // Back home: farm, pool swap, wheel, fishing, NPC.
  await travel("Home Beach");
  check(await visit(1990, 1340, "Farm"), `${name}: walk to the Farm`);
  await page.getByRole("button", { name: "Plant", exact: true }).first().click();
  await page.waitForTimeout(300);
  check(await page.locator(".plot .bar").first().isVisible(), `${name}: a crop is growing`);
  await page.getByRole("button", { name: "Close" }).click();

  check(await visit(1680, 1540, /Tide Pool/), `${name}: walk to the Tide Pool`);
  const rfBefore = await page.locator(".coin").first().innerText();
  await page.locator(".swap input").fill("100");
  await page.getByRole("button", { name: /^Swap$/ }).click();
  await page.waitForTimeout(900);
  check((await page.locator(".coin").first().innerText()) !== rfBefore, `${name}: swap changed the RF balance`);
  await page.getByRole("button", { name: "Close" }).click();

  check(await visit(1150, 1250, "Tide Wheel"), `${name}: walk to the Tide Wheel`);
  await page.getByRole("button", { name: /Free spin/ }).click();
  await page.waitForTimeout(3600);
  check(await page.locator(".result-pop").isVisible(), `${name}: the wheel shows a prize`);
  await page.getByRole("button", { name: "Close" }).click();

  check(await visit(1560, 1700, "Fishing Dock"), `${name}: walk to the Fishing Dock`);
  await page.getByRole("button", { name: /Cast/ }).click();
  await page.getByRole("button", { name: /REEL/ }).waitFor({ timeout: 6000 });
  await page.getByRole("button", { name: /REEL/ }).click();
  await page.waitForTimeout(300);
  check(await page.locator(".fishing.done").isVisible(), `${name}: fishing resolves`);
  await page.screenshot({ path: `artifacts/e2e-${name}-fishing.png` });
  await page.getByRole("button", { name: "Close" }).click();

  check(await visit(1460, 1700, /Old Salt says/), `${name}: talk to Old Salt`);
  for (let i = 0; i < 12 && !(await page.getByRole("button", { name: "Bye" }).isVisible().catch(() => false)); i++) { const n = page.getByRole("button", { name: /^(Next|Skip)$/ }); if (await n.isVisible().catch(() => false)) await n.click(); await page.waitForTimeout(150); }
  const giftBtn = page.getByRole("button", { name: /Accept gift/ });
  check(await giftBtn.isVisible(), `${name}: Old Salt offers a daily gift`);
  await giftBtn.click();
  await page.screenshot({ path: `artifacts/e2e-${name}-npc.png` });
  await page.getByRole("button", { name: "Bye" }).click();

  check(errors.length === 0, `${name}: no page errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

try {
  await scenario("desktop", { width: 1280, height: 800 }, false);
  await scenario("phone", { width: 390, height: 844 }, true);
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll e2e checks passed");
process.exit(failures ? 1 : 0);
