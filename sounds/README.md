# Sound library

Put sound effects and music here, then the **Sound Catalog** workflow lists them in `CATALOG.md` and `index/`.

```
sounds/sfx/...   sound effects / VFX sounds (any sub-folders)
sounds/bgm/...   background music
```

Two ways to add them:

1. **Folders (best):** unzip on your computer and commit the folders `sounds/sfx/` and `sounds/bgm/`.
2. **Zips:** commit `sounds/sfx.zip` and `sounds/bgm.zip`. The workflows unpack them into `sounds/sfx/` and `sounds/bgm/`.

GitHub's web upload accepts files up to 25 MB, and a push up to 100 MB per file. For a bigger zip use Git LFS (`git lfs track "sounds/*.zip"`) or push the unzipped folders.

Reels use sounds through `reels/<name>/audio.json`; see the "Voice-over, sound effects and music" section of `skills/code-video/SKILL.md`.
