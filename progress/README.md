# Progress checkpoint system (code-video-shorts)

Purpose: when Claude builds a reel (or a long video) for this repo, every planning step and every piece of prepared work is saved here **as it is made**, so if Claude's limit runs out mid-task, a brand-new chat can continue from exactly where the work stopped instead of starting over.

**Read first on every reel task:** `progress/INDEX.md`, this file, `progress/REEL_FORMAT.md` (the files and rules of a reel package) and `skills/code-video/SKILL.md` (how to build the video).

## What starts a render (do NOT touch these until the reel is complete)

`make-reel.yml` starts on a push that changes any of these paths:

- `reels/*/index.html`
- `reels/*/video.json`
- `reels/*/audio.json`

A run renders the reel and publishes it (reels: YouTube Shorts + Instagram Reels through Buffer; long/landscape: YouTube API + Instagram). `sound-catalog.yml` starts only on changes under `sounds/`.

`progress/` is NOT in any trigger, so checkpoint commits here never start a run. Never write a half-finished reel into `reels/<n>/`: a push there renders and publishes it. All drafts live in `progress/` only.

## Rules for Claude (follow on EVERY reel task)

1. **Before starting anything**: open `progress/INDEX.md`. If a job is `in-progress` and matches the request (or the user says "continue"), open its `STATE.md` and resume from `## Next step`. Do not redo finished stages.
2. **At the very start of a new job**: create `progress/<YYYY-MM-DD>-<reel-name>/STATE.md` (copy `progress/_TEMPLATE/STATE.md`) and add a line to `INDEX.md`. Commit immediately. `<reel-name>` is the folder name that will be used under `reels/` (letters, numbers, - _).
3. **Checkpoint often**: after each stage below update the job folder and commit with message `wip(progress): <reel-name> - <what was just done>`. Small commits are fine; never wait to push everything in one go.
4. **Always update `STATE.md`** in the same commit: tick the checklist, write the exact `## Next step`, and note decisions (look, format, size, length, voice, music, special user instructions, answers to the up-to-five questions).
5. **Save the real work, not summaries**: the full plan, the exact caption lines (the TXT lines that will be spoken), the scene-by-scene design (look, colours, timing, what happens when), and the audio plan (music, sound effects). Anything needed to continue must be inside the repo. Do NOT save a second full copy of the finished `index.html` / `video.json` / `audio.json`: the saved plan, lines, design and audio plan are the progress.
6. **Only the last step starts a run**: when all stages are complete, write the finished files straight into `reels/<n>/` (`index.html`, `video.json`, `audio.json`, `post.json` with its `_instructions` key, music file if any) in ONE commit (use the GitHub `push_files` tool, never one file at a time, so a single push starts a single run with every file in place). `post.json` is not a trigger path, so it must be in that same commit. That push is what starts the render and publish. Then set status `done` in `STATE.md` and `INDEX.md` (a second `progress/` commit).
7. **One reel = one job = one commit/push**: never put several reels in one commit. When making several reels, finish and push them one by one, each as its own commit, so each gets its own workflow run, queued one after the other.
8. If a finished reel needs a re-render, change something under `reels/<n>/` (or use Actions > Make Reel > Run workflow with the reel name) and note it in `STATE.md`.
9. Never put secrets or API keys in this folder.
10. If the limit runs out during the final write, nothing was pushed, so the next chat re-creates the files from the saved plan, lines, design and audio plan and pushes once.

## Job folder layout

```
progress/<YYYY-MM-DD>-<reel-name>/
  STATE.md            status, checklist, decisions, NEXT STEP (always current)
  01_plan.md          idea, answers to the questions, look (one of the seven looks or free rein), size/fps/length, user instructions
  02_lines.md         exact caption/voice lines (the TXT lines), word for word
  03_design.md        scene-by-scene design: layout, colours, fonts, animations and their timing (enough to write index.html from)
  04_audio.md         music and sound-effect plan (what, where, when), the voice (Puck unless told otherwise)
  notes.md            anything else (research, problems)
```

## Stages (checklist order)

1. Plan (idea, questions answered, look, format, length)
2. Caption / voice lines written or saved
3. Scene design written (enough to build index.html from)
4. Audio plan (music, effects) decided
5. Finished files written once into `reels/<n>/` in one commit (this starts the run)
6. Verified started, job marked done
