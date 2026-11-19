---
name: code-video
description: "Make short videos and animations with code: ask what the user wants, fill in a block prompt for this request (you fill the tags; the look is only a recommendation), then write the code, render every frame to MP4, check sampled frames and deliver. Gives a path that works plus rendering, contact-sheet and check tools; what to draw and how is yours to design. Use when the user asks to make a video or animation with code, a pixel-art / hand-drawn / 3D animation, a motion piece for a product, or a short history / explainer animation."
---

# Code Video

Draw a good-looking short video in code. What follows is a path that works, not a fixed procedure; what to draw, which technique, the look and the motion are yours to design for this request.

## Language

Talk to the user in the language of their first message and keep it for the whole session. Write the prompt blocks in that language too; the tag names stay in English. The seven examples are the Chinese originals that were actually run: learn their structure and level of detail, don't translate them word for word.

## The rough path

1. **Ask**: where it's used, who watches, what to show, what viewers should remember, the look, size and length, anything to avoid. Don't re-ask what the user said; use what you can infer; default what's missing (landscape 1920×1080, 30 fps, 8–15 s), and use all defaults if they say "you decide". Use a question tool if you have one, in one round
2. **Fill the prompt**: fill the tags below for this request, save it as `prompt.md` in the project folder, and show the user (skip if they say "just do it")
3. **Follow it**: write the code, check a few stills, render the full video, look at the contact sheet, fix until it's right. If the first version shows habits you don't want, add them to `prompt.md` and fix
4. **Deliver**: the project folder keeps `video.mp4`, `check/contact-sheet.png`, `prompt.md`, `index.html`, `video.json`, `package.json` (change one thing, `npm i`, re-render); delete `node_modules` and intermediate frames. Report how long it took and what the self-check fixed

## The prompt: you fill the tags

Per Anthropic's [prompting guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices): keep requirements, background and checks in separate XML tags so they don't blur together, with a reason for each line so the model generalizes to what isn't written. The tag names are this skill's own; there is no official fixed set.

| Tag | What goes in it |
|---|---|
| `<role>` | which role does it and what that role cares about most (a motion designer for a promo, a science writer for an explainer, a pixel artist for pixel art… pick for this video) |
| `<context>` | where it's used and who watches, and therefore what it needs, written as "because…, so…" |
| `<task>` | what to show, in what order, what viewers should remember; the user's own words first |
| `<specs>` | size, frame rate, length, whether it loops, with or without sound; everything drawn in code |
| `<style>` | recommended techniques and look, each with a reason; **recommendations, not rules**: pick from the examples or design something new; follow the user where they've said what they want, and note what they don't want here too |
| `<check>` | what to verify on sampled frames, item by item, written for the defects this kind of video tends to have (a vague "check it" can make the model over-check) |

Infer what the user hasn't said from the request and ask when unsure. Then follow the prompt yourself, or hand `prompt.md` and the project folder path to a subagent: its context is clean and holds only this job, so the prompt must be complete; when it's done, look at the contact sheet before delivering.

## Must hold

- **Frames depend only on time**: the page exposes `window.render(t)` that draws second t; random numbers use a fixed seed; no requestAnimationFrame, CSS animations or Date.now; set `window.__ready = true` once ready; the page fills the viewport exactly (`html, body { margin: 0; overflow: hidden }`), with even width and height. `render.mjs` relies on these to capture every frame
- **Facts in explainers are sourced**: check every date and event at an official source, list them in `sources.md`, and leave out what you can't verify
- Assets and fonts are licensed for this; if the video uses AI-made imagery, turn on the platform's AI-content label when publishing
- Look at the contact sheet yourself before delivering

## Tools at hand

| Tool | What it does |
|---|---|
| `scripts/render.mjs` | in the project folder, `node <this skill>/scripts/render.mjs index.html video.mp4` renders every frame using size, fps and length from `video.json`; `--stills 0,0.5,2.5 --outdir check` for stills, `--audio music.wav` for sound |
| `scripts/contact.sh` | joins a video or a folder of stills into a contact sheet (frame 0 + 5 evenly spaced + the last) |
| `scripts/check.py` | `colors` counts colors in pixel art, `loop` checks whether a loop closes |

Setting up the project folder, which library for which look, springs and easing, music, fonts and which frames to check: `references/practice.md` and `references/tech-stack.md`.

## Voice-over, sound effects and music (reels made through GitHub)

Pushing `reels/<name>/index.html` (+ `video.json`, `audio.json`) runs `.github/workflows/make-reel.yml`, which adds the sound for you: voice-over (tts.mjs) → mix (mix.mjs) → render. What the reel has to provide:

- **Voice-over** (when the `GEMINI_API_KEY` secret is set): keep the spoken lines in a top-level `const TXT=[...]`, one entry per caption, starting at 0.5 s (`let cs=.5`). Take each line's length from the voice: `d=(window.__TIMING&&window.__TIMING[i])||<your own estimate>`. The audio then decides the timing, so voice, captions and animation stay in sync.
- **Sound library:** `sounds/` holds ~3000 sound effects and music tracks. Don't list folders. Read `sounds/CATALOG.md` (folders and counts), then only the `sounds/index/<folder>.txt` you need (`<path> <length>` per line), or search with `search_code` for a keyword with `path:sounds/index`.
- **Cues:** write `reels/<name>/audio.json` next to `index.html`:

```json
{
  "bgm": "bgm/epic/dark-ambient",
  "bgmVolume": 0.15,
  "sfx": [
    { "line": 0, "sound": "sfx/whoosh/whoosh-01", "volume": 0.8 },
    { "line": 13, "offset": 0.2, "sound": "sfx/impact/boom-02" },
    { "at": 12.5, "sound": "sfx/ui/ding", "dur": 2 }
  ]
}
```

  - `line` + `offset` places an effect at the start of that caption line (plus offset seconds) so it follows the voice; `at` is absolute seconds. `dur` caps a long effect (default 6 s).
  - `sound` is a path from an index file, extension optional. A folder, a bare file name or a keyword also works (a matching file is picked, always the same for this reel).
  - Pick one background track that fits the mood; it ducks under the voice by itself. Use effects sparingly, on beats the viewer should feel (a reveal, a hit, a scene change), not on every line. Keep volumes low enough that the voice stays clear.
  - A plain `music.wav`/`music.mp3` in the reel folder still works as background music.

## What earlier videos left behind

References, not templates. Design for this request first; look here when unsure or when the user can't say what look they want:

- `references/examples/`: seven prompts that were run end to end (one line, free rein; pixel; retro arcade; hand-drawn; 3D; UI motion; short history), to see how each block is written and how detailed; they have a separate `<avoid>` block, which now goes into `<style>`. Swap in this request's subject, numbers and palette
- `references/practice.md`: roles by video type, picking a technique per point in explainers, springs and easing, music, frame checks, fonts
- `references/tech-stack.md`: which library for which look, how it plugs into this pipeline, where it tends to get stuck
