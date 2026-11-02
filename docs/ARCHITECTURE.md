# Architecture

```
 Chrome                                   server.mjs (127.0.0.1:4747)
 ┌────────────────────────────┐          ┌──────────────────────────────┐
 │ Web Speech API (te-IN) ──▶ │ textarea │                              │
 │ Extract ─── POST /extract ─┼─────────▶│ execFile claude -p PROMPT+text│
 │                            │◀─ JSON ──┤ parseClaudeJson(stdout)      │
 │ render(): per ingredient   │          └──────────────────────────────┘
 │   fetch en.wikipedia.org/api/rest_v1/page/summary/<wiki> → thumbnail
 │ Save → localStorage.recipes│
 └────────────────────────────┘
```

| File | Responsibility |
|---|---|
| `server.mjs` | Serves `index.html`, runs the extraction, parses the reply, `--check` self-test |
| `index.html` | Dictation, the Extract call, photo lookup, rendering, saved recipes |

## Why `claude -p` and not the API

The app is for someone who already has Claude Code signed in. Shelling out to `claude -p` means no API key, no
SDK, and no `package.json` dependencies; the cost is a 10–60 second cold start per extraction. `execFile` is
used with an argument array, so the dictated text is never interpreted by a shell.

## Why the model picks the Wikipedia title

A Telugu ingredient name rarely matches an English article, and the obvious English name often lands on a page
without a photo of the thing itself. Asking the model for "the article most likely to have a photo" moves that
judgement to the step that already understands the ingredient. The browser then calls Wikipedia directly, which
needs no key and allows cross-origin requests, so the server never touches images.

## Saved recipes

`localStorage.recipes` holds an array of the extraction JSON, with each ingredient's resolved `img` URL cached on
it so a reopened recipe does not hit Wikipedia again. The server is stateless.

## Things that bit us

- **`claude` was a shell alias.** `execFile` does not see aliases, so the server found nothing. It now prefers
  the real binary at `~/.claude/local/claude` and falls back to `claude` on `PATH`.
- **Claude wrapped the JSON in prose.** Even when asked for JSON only, replies sometimes began "Here you go:".
  `parseClaudeJson` takes the outermost `{…}`; `--check` covers it.
- **Recognition stopped on its own.** Chrome ends a `continuous` session after a pause. `onend` restarts it while
  the mic button is still on.
- **The embedded browser blocked the microphone.** Some in-app browsers deny mic access outright; the error
  message tells the user to open the page in regular Chrome.
- **Telugu dictation needs the network.** Chrome's `te-IN` recognition runs on Google's servers; offline it fails
  with `network`, which now gets its own message.
