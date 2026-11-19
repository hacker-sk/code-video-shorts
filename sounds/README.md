# Sound library

Put sound effects and music here (or in a release, see below). The **Sound Catalog** workflow lists them in `CATALOG.md` and `index/` so reels can use them.

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

Reels use sounds through `reels/<name>/audio.json`; see the "Voice-over, sound effects and music" section of `skills/code-video/SKILL.md`.
