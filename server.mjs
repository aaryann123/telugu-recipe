// Telugu recipe taker: dictate in Telugu, local `claude` CLI extracts dish +
// ingredients (with English Wikipedia titles), browser fetches ingredient photos.
// Zero dependencies. http://127.0.0.1:4747
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// `claude` is often a shell alias, invisible to execFile — prefer the real binary
const LOCAL_CLAUDE = path.join(homedir(), ".claude/local/claude");
const CLAUDE = existsSync(LOCAL_CLAUDE) ? LOCAL_CLAUDE : "claude";

const PORT = 4747;
const ROOT = path.dirname(new URL(import.meta.url).pathname);

const PROMPT = `You are given a recipe dictated in Telugu (possibly mixed with English, transcribed by speech recognition so expect small errors). Extract it.
Reply with ONLY a JSON object, no markdown fences, exactly this shape:
{"dish":{"telugu":"...","english":"..."},"ingredients":[{"telugu":"...","english":"...","quantity":"...","wiki":"..."}],"steps":["...", "..."]}
- "wiki" is the English Wikipedia article title for that ingredient (e.g. "Coriander", "Curry tree", "Toor dal" -> "Pigeon pea"). Pick the article most likely to have a photo of the ingredient.
- "quantity" as dictated (may be empty). "steps" in Telugu as dictated, cleaned up.
Recipe:
`;

// ponytail: claude sometimes wraps output in prose; grab the outermost {...}
export function parseClaudeJson(out) {
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON in claude output");
  return JSON.parse(out.slice(start, end + 1));
}

if (process.argv.includes("--check")) {
  const r = parseClaudeJson('Here you go:\n{"dish":{"telugu":"పప్పు","english":"Dal"},"ingredients":[],"steps":[]}\nDone.');
  console.assert(r.dish.english === "Dal", "parse failed");
  console.log("ok");
  process.exit(0);
}

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/extract") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let text;
      try { text = JSON.parse(body).text?.trim(); } catch { /* fall through */ }
      if (!text) { res.writeHead(400); return res.end("missing text"); }
      execFile(CLAUDE, ["-p", PROMPT + text], { timeout: 180000, maxBuffer: 4 * 1024 * 1024 },
        (err, out) => {
          try {
            if (err && !out) throw new Error(err.code === "ENOENT" ? "claude CLI not found on PATH" : err.message);
            const recipe = parseClaudeJson(out);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(recipe));
          } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(path.join(ROOT, "index.html")));
}).listen(PORT, "127.0.0.1", () => console.log(`Telugu Recipe on http://127.0.0.1:${PORT}`));
