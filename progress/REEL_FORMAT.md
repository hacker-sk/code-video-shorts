# Reel package format (reels/<n>/)

Read this before writing any file into `reels/<n>/`. It is built from `.github/workflows/make-reel.yml` and the scripts `publish.mjs`, `tts.mjs`, `render.mjs` and `mix.mjs` in `skills/code-video/scripts/`, plus an existing reel (`reels/yaksha-prashna`). The real build rules for the look and the code are in `skills/code-video/SKILL.md` (and `references/`): read it too on every new reel. If these notes and the code differ, the code wins.

## The files of one reel

| File | Required | What it is |
|---|---|---|
| `index.html` | yes | the page that draws second t: defines `window.render(t)`, sets `window.__ready = true`, and holds the caption lines as an array named `TXT`. Write it exactly as `const TXT=[ ... ];` (no spaces around `=`): `mix.mjs` finds the lines by that text for automatic sound. Frames depend only on time. The voice starts 0.5 s in, so the page's start offset must be 0.5 |
| `video.json` | always write it (the workflow makes a 1080x1920, 30 fps, 10 s one if missing) | `{"_instructions": [...], "width":1080,"height":1920,"fps":30,"duration":<seconds>}`. `render.mjs` and `mix.mjs` read only width, height, fps and duration, so any other key (like `_instructions`) is ignored. Width and height must be even |
| `audio.json` | optional | `{"bgm": "<path under sounds/>", "bgmVolume": 0.18, "sfx": [ {"line": <index of a TXT line>, "offset": <seconds, optional>, "sound": "<path under sounds/>", "volume": 0.5, "dur": <seconds, optional>} ] }`. Also supported: `"at"` (seconds) instead of `"line"`, `bgm` as a list of sections (`sound` or `mood`, `from`/`to` or `fromLine`/`toLine`, `volume`), `"auto": true|false` (see below), `voiceVolume`, `mood`, `density` |
| `post.json` | optional but always write it | `{"title": "...", "description": "...", "instagram": "<Reels caption, optional>", "thumbnailOffset": <ms, optional, default 2000>}`; without it the title is made from the folder name. Other keys are ignored by `publish.mjs` |
| `music.wav` / `music.mp3` | optional | a plain background track used under the voice and effects |

Automatic sound: if `audio.json` is missing, or has no `sfx` and no `bgm`, or has `"auto": true`, `mix.mjs` picks music and effects from the TXT lines itself (`"auto": false` turns this off). The voice always stays on top: effects are limited to 9 dB below the voice peak (volume max 0.5) and music to 14 dB below the voice average (volume max 0.2), whatever volume audio.json says.

## Page code rules that prevent a failed run (check before every push)

`tts.mjs` and `render.mjs` open `index.html` in headless Chromium as a classic script and wait for `window.__ready === true` (60 s). If the script throws while loading, `__ready` is never set and the run fails with a `page.waitForFunction: Timeout 60000ms exceeded` (the real cause is the `[page error]` line just above it). So:

- NEVER declare a global (top-level `const`, `let`, `var` or `function`) named like a browser global: `top`, `parent`, `self`, `window`, `document`, `name`, `status`, `length`, `location`, `history`, `event`, `screen`, `frames`, `origin`, `close`, `stop`, `open`, `print`, `focus`, `blur`, `scroll`, `find`, `external`, `opener`, `closed`. `function top(){}` or `const top=...` fails with `Identifier 'top' has already been declared` (this broke reel octopus-three-hearts). Use a specific name instead: `headT`, `topText`, `topPx`, `parentEl`.
- Also never reuse a name twice at the top level of the script (two `const x`, or a `const` and a `function` of the same name).
- Set `window.__ready = true` as the LAST line of the script, and define `window.render` before it. Keep the `const TXT=[...];` line valid JavaScript (every line in quotes, commas between lines).
- Load nothing from the network (no CDN scripts, no web fonts, no remote images): the page must work from the local folder. Three.js etc. only from `node_modules` via ES modules.
- Do not use `localStorage`, `alert`, `prompt`, `fetch` to other sites, or `Math.random()` / `Date.now()` for frames (frames must depend only on t).
- When in doubt, wrap the page code in a block or an IIFE, and only export `window.render`, `window.__ready` and `TXT`.

## What starts a run

`make-reel.yml` starts on a push that changes `reels/*/index.html`, `reels/*/video.json` or `reels/*/audio.json`. `post.json` is NOT a trigger, so it must be in the same commit as the files that start the run (or already be there), otherwise the post uses the folder name as the title. Reel name: letters, numbers, `-` and `_` only. Every reel changed in a push becomes its own job, one at a time; still one reel per commit.

NEVER edit `video.json`, `audio.json` or `index.html` of an existing reel just to add notes: that starts a render and posts the reel again. Only `post.json` and `progress/` are safe to change. (The exception is a real bug fix in a reel that failed and never posted, for example a global name clash: fixing it re-renders it, which is wanted.)

Write all of a reel's files with ONE `push_files` call (one commit), never one file at a time (the first file would start a run with the others missing). Never put a half-finished reel into `reels/<n>/`: all drafts live in `progress/` (see `progress/README.md`).

## What the run does

- Voice-over: with secret GEMINI_API_KEY set, the TXT lines are spoken with Gemini TTS (voice Puck unless told otherwise; model gemini-3.8-flash-tts first, gemini-3.1-flash-tts-preview as fallback) and the video timing follows the voice (`timing.json` replaces `duration`). Keep lines short; every line becomes one voiced clip, cut apart at the pauses
- Sound: voice + music + sound effects are mixed from `sounds/` (and the "sounds" release zips)
- Publishing depends on the video: vertical and at most 3 minutes = REEL: YouTube Shorts + Instagram Reels, both through Buffer, 1 minute later. Landscape or longer than 3 minutes = LONG: YouTube through the YouTube Data API only, Instagram through Buffer. `#Shorts` is added to the YouTube text of reels automatically
- Thumbnail = the frame at `thumbnailOffset` ms (default 2000), so make sure the frame at that moment looks good
- Failed run: `.github/workflows/retry-failed.yml` re-runs the failed jobs of a failed Make Reel run automatically, after 60 s, at most 2 times (3 attempts in all). Reels that already finished are not repeated, and the voice-over clips are cached, so a retry after a rate limit continues where it stopped. A failure caused by a bug in the reel's own code fails every attempt: read the `[page error]` / error line in the log, fix the file and push the fix (one commit)

## Rules the user has stated

- Every reel posts to both YouTube Shorts and Instagram Reels
- Keep the Gemini voice Puck in this repo
- Every video is its own commit/push so it gets its own run (a run with all videos in one failed before)
- Save progress in `progress/` as each step is done, before writing the final files
- Once the reel's files are created, commit them right away with ONE `push_files` call to start the run, without waiting for the user's approval (confirmed by the user on 2026-11-24, same as the Hindi package repo hacker-sk/stickman-renderer)
- The `_instructions` key goes in the JSON that is read first, so that it is seen when the package is looked at
- Failed runs must be restarted automatically (workflow `retry-failed.yml`), and the failure-prevention rules above go into the `_instructions` key of every new reel

## `_instructions` key

Every new reel's `video.json` starts with an `_instructions` array (and `post.json` may repeat it). It reminds Claude: read `progress/INDEX.md`, `progress/README.md` and `progress/REEL_FORMAT.md`, and `skills/code-video/SKILL.md`; save plan, lines, design and audio plan to `progress/` as you go; write all the reel's files in ONE `push_files` commit (index.html, video.json, audio.json, post.json) because that push starts the render and publish, and commit it right away without waiting for approval; one reel per commit; mark the job done afterwards. Keep this key at the top of every new `video.json`. The renderer ignores it (verified in `render.mjs` and `mix.mjs`).

Add this item to the array of every new reel (it prevents failed runs):

> "BEFORE PUSHING, check index.html: no top-level const/let/var/function named like a browser global (top, parent, self, window, document, name, status, length, location, history, event, screen, frames, origin, close, stop, open, print, focus, blur, scroll, find) and no duplicate top-level names, because that throws 'Identifier ... has already been declared', window.__ready is never set and the run fails after 60 s. Set window.__ready=true as the last line, load nothing from the network, and keep const TXT=[...]; valid. A failed run is re-run automatically up to 2 times (retry-failed.yml); a code bug fails every attempt, so fix it and push once."
