// Regenerates docs/screenshots/*.png from Tools/sample-recipes.json (synthetic recipes, no Claude call).
// Starts the app on its usual port and drives headless Chrome over the DevTools protocol.
//
//   node Tools/screenshots.mjs
// Needs: Node 22+, Google Chrome (set CHROME elsewhere), macOS `sips` for the downscale,
// and internet access for the Wikipedia ingredient thumbnails.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs", "screenshots");
const BASE = "http://127.0.0.1:4747";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sample = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "sample-recipes.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ["server.mjs"], { cwd: ROOT, stdio: "ignore" });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tr-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try { target = await (await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" })).json(); } catch {}
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => { const m = JSON.parse(String(e.data)); pending.get(m.id)?.(m.result); pending.delete(m.id); });
  const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
  const shot = async (name) => {
    fs.mkdirSync(OUT, { recursive: true });
    const { data } = await cdp("Page.captureScreenshot", { format: "png" });
    const file = path.join(OUT, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    execFileSync("sips", ["--resampleWidth", "1600", file], { stdio: "ignore" });
    console.log("wrote", path.relative(ROOT, file));
  };
  // Wait until every ingredient card has its photo (or placeholder) and the images have decoded.
  const ready = () => evaluate(`new Promise(async (ok) => {
    for (let i = 0; i < 60; i++) {
      const imgs = [...document.querySelectorAll('.card img')];
      if (document.querySelectorAll('.card').length && imgs.every((im) => im.complete)) return ok(true);
      await new Promise((r) => setTimeout(r, 250));
    }
    ok(false);
  })`);

  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1000, height: 900, deviceScaleFactor: 2, mobile: false });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await sleep(200); } }
  await cdp("Page.navigate", { url: BASE });
  await sleep(800);

  await evaluate(`document.getElementById('text').value = ${JSON.stringify(sample.dictation)}`);

  await evaluate(`current = ${JSON.stringify(sample.recipes[0])}; render(current, document.getElementById('result'))
    .then(() => { document.getElementById('save').style.display = 'inline-block' })`);
  await ready();
  await shot("recipe");

  await evaluate(`localStorage.recipes = ${JSON.stringify(JSON.stringify(sample.recipes))}; location.reload()`);
  await sleep(800);
  await evaluate(`document.querySelectorAll('.saved')[1].click()`);
  await ready();
  await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(300);
  await shot("saved");
  ws.close();
} finally {
  server.kill(); chrome.kill();
  await new Promise((r) => chrome.once("exit", r));
  fs.rmSync(profile, { recursive: true, force: true });
}
