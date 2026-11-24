# For Claude: read this before any reel task in this repo

1. Open `progress/INDEX.md` FIRST, then `progress/README.md` (checkpoint rules), `progress/REEL_FORMAT.md` (files and rules of a reel package) and `skills/code-video/SKILL.md` (how to build the video).
2. At the start of a new reel create `progress/<YYYY-MM-DD>-<reel-name>/STATE.md` (copy `progress/_TEMPLATE/STATE.md`) and add a line to `progress/INDEX.md`.
3. Save the plan, caption lines (TXT), scene design and audio plan into the job folder as each step is done, never only at the end.
4. Only the last step writes `reels/<n>/` (`index.html`, `video.json`, `audio.json`, `post.json`, music): in ONE `push_files` commit, one reel per commit. That push starts the render and publishes to YouTube Shorts and Instagram Reels, so never write a half-finished reel there.
5. Every new `reels/<n>/post.json` starts with an `_instructions` key (ignored by `publish.mjs`) repeating steps 1 to 4.
6. Keep the Gemini voice Puck. Never put secrets in the repo.
