/** Dev-server QA: screenshot every panel (uses the dev-only window.__nff hook). */
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:5173/";
const which = process.argv[3] ?? "both";
const b = await chromium.launch();
const panels = ["play", "pier", "inbox", "home", "farm", "market", "pool", "dock", "crabs", "wheel", "mines", "abyss", "forge", "harbor", "reef", "board", "shrine", "unlock:cove", "npc:mayor"];
for (const [name, vp, mobile] of [["desk", { width: 1280, height: 800 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  if (which !== "both" && which !== name) continue;
  const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })).newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(url);
  await p.getByRole("button", { name: /Try as guest/ }).click();
  await p.getByRole("button", { name: /Sample Friend #2\b/ }).click();
  await p.waitForSelector(".world canvas", { timeout: 20000 });
  await p.getByRole("button", { name: "Close" }).click();
  await p.evaluate(() => window.__nff.grant());
  await p.waitForTimeout(800);
  await p.screenshot({ path: `artifacts/panel-${name}-world.png` });
  for (const id of panels) {
    await p.evaluate(x => window.__nff.open(x), id);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `artifacts/panel-${name}-${id.replace(":", "_")}.png` });
    await p.evaluate(() => window.__nff.open(null));
    await p.waitForTimeout(150);
  }
  console.log(name, "errors:", errs);
}
await b.close();
