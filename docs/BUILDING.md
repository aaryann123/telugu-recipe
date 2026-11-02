# Building Telugu Recipe

## Requirements

| | |
|---|---|
| Node | 18 or newer; no `npm install` needed |
| Claude Code | the `claude` CLI, signed in |
| Chrome | for dictation and for the screenshot script |

## Running

    npm run dev                 # or: node server.mjs
    node server.mjs --check     # self-test of the JSON parser

The port is fixed at 4747 in `server.mjs` and the server listens on 127.0.0.1 only.

## Layout

```
server.mjs                 server, prompt, JSON parsing, self-test
index.html                 the UI (inline CSS and JS)
Tools/sample-recipes.json  two made-up recipes in the extraction's JSON shape, plus a sample dictation
Tools/screenshots.mjs      regenerates docs/screenshots/
docs/                      this file, ARCHITECTURE.md, screenshots
```

## Changing the extraction

The prompt is `PROMPT` in `server.mjs`. If you add a field, render it in `render()` in `index.html`. To support
another language, change `rec.lang` (for example `hi-IN`, `ta-IN`) and the prompt's first line.

## Regenerating the screenshots

    node Tools/screenshots.mjs

It needs Node 22+ (built-in WebSocket). It starts the server on 4747 (stop yours first), opens headless Chrome over the DevTools protocol, fills the page
from `Tools/sample-recipes.json` without calling Claude, waits for the Wikipedia thumbnails, and saves 2x captures
downscaled to 1600 px with `sips`. It needs internet for the thumbnails. On Linux, set `CHROME` and swap `sips`
for ImageMagick.

## Not supported yet

Windows is untested. Dictation works only where the browser offers Telugu speech recognition (Chrome).
