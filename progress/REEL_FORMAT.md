# Reel package format (reels/<n>/)

Read this before writing any file into `reels/<n>/`. It is built from `.github/workflows/make-reel.yml`, `skills/code-video/scripts/publish.mjs`, `skills/code-video/scripts/tts.mjs` and an existing reel (`reels/yaksha-prashna`). The real build rules for the look and the code are in `skills/code-video/SKILL.md` (and `references/`): read it too on every new reel. If these notes and the code differ, the code wins. Not checked yet when this was written: `render.mjs`, `mix.mjs` and the sound section of SKILL.md (so audio.json details beyond the fields below must be checked there).

## The files of one reel

| File | Required | What it is |
|---|---|---|
| `index.html` | yes | the page that draws second t: defines `window.render(t)`, sets `window.__ready = true`, and holds the caption lines as an array named `TXT` (global `TXT`, or a `const TXT = [ ... ];` literal in the HTML source). Frames depend only on time. The voice starts 0.5 s in, so the page's start offset must be 0.5 |
| `video.json` | optional (workflow makes a 1080x1920, 30 fps, 10 s one if missing) | `{"width":1080,"height":1920,"fps":30,"duration":<seconds>}` |
| `audio.json` | optional | `{"bgm": "<path under sounds/>", "bgmVolume": 0.18, "sfx": [ {"line": <index of a TXT line>, "offset": <seconds, optional>, "sound": "<path under sounds/>", "volume": 0.5, "dur": <seconds, optional>} ] }` |
| `post.json` | optional but always write it | `{"title": "...", "description": "...", "instagram": "<Reels caption, optional>", "thumbnailOffset": <ms, optional, default 2000>}`; without it the title is made from the folder name |
| `music.wav` / `music.mp3` | optional | music file used when there is no audio.json mix |

Any other key in `post.json` (for example `_instructions`) is ignored by `publish.mjs`. Put an `_instructions` key at the top of every new `post.json` (see the end of this file).

## What starts a run

`make-reel.yml` starts on a push that changes `reels/*/index.html`, `reels/*/video.json` or `reels/*/audio.json`. `post.json` is NOT a trigger, so it must be in the same commit as the files that start the run (or already be there), otherwise the post uses the folder name as the title. Reel name: letters, numbers, `-` and `_` only. Every reel changed in a push becomes its own job, one at a time; still one reel per commit.

Write all of a reel's files with ONE `push_files` call (one commit), never one file at a time (the first file would start a run with the others missing). Never put a half-finished reel into `reels/<n>/`: all drafts live in `progress/` (see `progress/README.md`).

## What the run does

- Voice-over: with secret GEMINI_API_KEY set, the TXT lines are spoken with Gemini TTS (voice Puck unless told otherwise; model gemini-3.8-flash-tts first, gemini-3.1-flash-tts-preview as fallback) and the video timing follows the voice. Keep lines short; every line becomes one voiced clip, cut apart at the pauses
- Sound: voice + music + sound effects are mixed from `sounds/` (and the "sounds" release zips) according to `audio.json`
- Publishing depends on the video: vertical and at most 3 minutes = REEL: YouTube Shorts + Instagram Reels, both through Buffer, 1 minute later. Landscape or longer than 3 minutes = LONG: YouTube through the YouTube Data API only, Instagram through Buffer. `#Shorts` is added to the YouTube text of reels automatically
- Thumbnail = the frame at `thumbnailOffset` ms (default 2000), so make sure the frame at that moment looks good

## Rules the user has stated

- Every reel posts to both YouTube Shorts and Instagram Reels
- Keep the Gemini voice Puck in this repo
- Every video is its own commit/push so it gets its own run (a run with all videos in one failed before)
- Save progress in `progress/` as each step is done, before writing the final files
- Once the reel's files are created, commit them right away with ONE `push_files` call to start the run, without waiting for the user's approval (confirmed by the user on 2026-11-24, same as the Hindi package repo hacker-sk/stickman-renderer)

## `_instructions` key

Every new `reels/<n>/post.json` starts with an `_instructions` array that reminds Claude: read `progress/INDEX.md`, `progress/README.md` and `progress/REEL_FORMAT.md`, and `skills/code-video/SKILL.md`; save plan, lines, design and audio plan to `progress/` as you go; write all the reel's files in ONE `push_files` commit (index.html, video.json, audio.json, post.json) because that push starts the render and publish, and commit it right away without waiting for approval; one reel per commit; mark the job done afterwards. Because `post.json` is not a trigger path, adding or changing this key never starts a run by itself.
