/** Visual tour: screenshots of the title, world and main panels for design review. */
import { chromium } from "playwright";
const url = process.argv[2] ?? "http://localhost:5173/";
const b = await chromium.launch();
for (const [name, vp, mobile] of [["desk", { width: 1280, height: 800 }, false], ["phone", { width: 390, height: 844 }, true]]) {
  const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile })).newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(url);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `artifacts/tour-${name}-0-title.png` });
  await p.getByRole("button", { name: /Try as guest/ }).click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `artifacts/tour-${name}-1-guest.png` });
  await p.getByRole("button", { name: /Sample Friend #1\b/ }).click();
  await p.waitForTimeout(2500);
  await p.waitForSelector(".world canvas", { timeout: 20000 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `artifacts/tour-${name}-2-story.png` });
  await p.getByRole("button", { name: "Close" }).click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: `artifacts/tour-${name}-3-world.png` });
  const shots = [["Play", "4-play"], ["Settings", "5-settings"], ["Backpack", "6-bag"]];
  for (const [label, file] of shots) {
    await p.getByRole("button", { name: label, exact: true }).click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `artifacts/tour-${name}-${file}.png` });
    await p.getByRole("button", { name: "Close" }).click();
  }
  await p.getByRole("button", { name: "Island map and fast travel" }).click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `artifacts/tour-${name}-8-map.png` });
  await p.getByRole("button", { name: /Home Beach/ }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Open Coral Shrine/ }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `artifacts/tour-${name}-7-shrine.png` });
  console.log(name, "errors:", errs);
}
await b.close();
