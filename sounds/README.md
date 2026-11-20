# Sound library

Put sound effects and music here (or in a release, see below). The **Sound Catalog** workflow lists and labels them (`CATALOG.md`, `LIBRARY.md`, `library.json`, `index/`, `tags/`) so reels can use them, by hand or automatically.

```
sounds/sfx/...   sound effects / VFX sounds (any sub-folders)
sounds/bgm/...   background music
```

## Big zips (over 100 MB): use a GitHub Release

Git can't hold files over 100 MB, and Git LFS has a small free download quota that every render would eat. A Release takes files up to 2 GB and costs nothing per render:

1. Repo page > **Releases** > **Draft a new release**.
2. Tag: `sounds` (create it). Title: anything, e.g. "Sound library".
3. Drag in your zips, named after the folder you want, e.g. `sfx.zip`, `bgm.zip` (they unpack to `sounds/sfx/`, `sounds/bgm/`).
4. **Publish release.** The Sound Catalog workflow runs on its own. If you add zips to an existing release later, run it by hand (Actions > Sound Catalog > Run workflow).

Every render downloads the zips from the release, so there is nothing else to do.

## Smaller files

Folders or zips under 100 MB can simply be committed here: unzipped folders (best, via git), or `sounds/sfx.zip` and `sounds/bgm.zip`. GitHub's web upload stops at 25 MB per file.

## What the Sound Catalog workflow writes (do not edit these by hand)

| File | What it is |
|---|---|
| `CATALOG.md` | every folder, how many sounds, an index file per folder |
| `index/<folder>.txt` | every sound's path (as used in audio.json) and length |
| `LIBRARY.md` | the sounds by kind: effect tags with counts, music moods, and a table of every music track (length, tempo, energy, mood) |
| `library.json` | the same labels for the computer: each effect has tags (whoosh, hit, riser, subdrop, bell, tension, glitch, ui, camera, fire, water, wind, nature, alarm, clock, money, crowd, laugh, meme, weapon...), each track has moods, tempo and energy |
| `tags/<tag>.txt`, `tags/bgm-<mood>.txt` | all sounds of one tag / all tracks of one mood |

Music moods are measured from the audio itself (loudness, brightness, tempo, dynamics, compared with the other tracks) plus words in the file name, so they are a good first guess.

## Fixing a label: `overrides.json` (optional, you write it)

```json
{
  "bgm/some-track": { "moods": ["epic"] },
  "bgm/too-loud-track": { "skip": true },
  "sfx/folder/some-sound": { "tags": ["hit", "subdrop"] },
  "sfx/folder/annoying-sound": { "skip": true }
}
```

Then run **Actions > Sound Catalog > Run workflow**. `skip` keeps a sound out of automatic picks (it can still be named by hand).

## How reels get their sound

- **Automatic (default).** A reel with no `audio.json`, or one that has no `sfx` and no `bgm`, or one with `"auto": true`, gets its sound planned from the script text (`TXT` in index.html): each line is scored for mood, the story is cut into sections, and each section gets its own music track of that mood, crossfaded. Effects go on story turns ("But", "Then", "Now"...), numbers and years, shocks, questions (a riser into the answer), danger, money, fire/water/wind when mentioned, and a hit or bell at the end. They are spaced out, never repeat a file, and weapon sounds are never picked. The plan is printed in the render log as `[auto]` lines and saved as `audio.plan.json`.
  - `"auto": false` turns it off; `"auto": {"bgm": false}` or `{"sfx": false}` keeps one half manual.
  - `"mood": "epic"` (or a list) nudges the music; `"density": "low" | "normal" | "high"` sets how many effects; `"sfxVolume": 1` scales them; `"bgmVolume": 0.15` sets the music level.
- **By hand, several tracks.** `"bgm": [{"mood": "calm", "from": 0, "to": 30}, {"sound": "bgm/some-track", "fromLine": 12, "toLine": 20, "volume": 0.18}, {"mood": "hopeful", "fromLine": 21}]`. A section has `sound` (path, folder or keyword) or `mood`; times in seconds (`from`/`to`) or caption lines (`fromLine`/`toLine`); missing times follow the neighbours.
- **By hand, one track and your own effects.** As before: `"bgm": "bgm/some-track"` and `"sfx": [{"line": 3, "sound": "sfx/.../Deep hit", "volume": 0.5}]`. A tag name also works as a keyword (`"sound": "riser"`).
- A reel with explicit `sfx`/`bgm` is never changed by the automatic mode.

Details: the "Voice-over, sound effects and music" section of `skills/code-video/SKILL.md`.
