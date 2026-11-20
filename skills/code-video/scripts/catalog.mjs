#!/usr/bin/env node
// Lists and labels the sound library so it can be browsed, and so reels can pick sounds automatically:
//   sounds/CATALOG.md          folders, counts and a few examples
//   sounds/index/<folder>.txt  one line per sound: <path to use in audio.json> <length>
//   sounds/library.json        every sound with its length and labels: effects get tags (whoosh, hit, riser, fire...),
//                              music gets moods (calm, epic, dark...), tempo and energy. mix.mjs / plan.mjs read this.
//   sounds/LIBRARY.md          the same, readable: tag table and a table of every music track
//   sounds/tags/<tag>.txt      all sounds of one tag; tags/bgm-<mood>.txt all tracks of one mood
//   sounds/overrides.json      OPTIONAL, written by hand: {"sfx/some/file": {"tags":["hit"],"skip":true}, "bgm/track": {"moods":["epic"],"skip":true}}
// Usage: node catalog.mjs [sounds-dir]   (needs ffmpeg + ffprobe)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { EXT, tagsFor, analyze, assignMoods, hintMood, readJson } from './soundlib.mjs';

const SOUNDS = path.resolve(process.argv[2] || 'sounds');
const ROOT_SKIP = new Set(['index', 'tags', 'CATALOG.md', 'LIBRARY.md', 'library.json', 'overrides.json', 'README.md']);
const groups = new Map(), all = [];

(function walk(d, rel) {
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.startsWith('.') || e.name === '__MACOSX' || (rel === '' && ROOT_SKIP.has(e.name))) continue;
    const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { walk(p, r); continue; }
    if (!EXT.test(e.name)) continue;
    const dir = path.posix.dirname(r), ref = r.replace(EXT, '');
    const q = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
    const dur = parseFloat(q.stdout), ok = Number.isFinite(dur);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push({ ref, dur: ok ? dur.toFixed(1) + 's' : '' });
    all.push({ ref, dir, file: p, d: ok ? +dur.toFixed(1) : null });
  }
})(SOUNDS, '');

// ---- folder index + CATALOG.md (as before) ----
const idx = path.join(SOUNDS, 'index');
fs.rmSync(idx, { recursive: true, force: true });
fs.mkdirSync(idx, { recursive: true });
const rows = [];
let total = 0;
for (const [dir, items] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  const file = (dir === '.' ? '_root' : dir.replace(/\//g, '__')) + '.txt';
  fs.writeFileSync(path.join(idx, file), items.map(i => `${i.ref} ${i.dur}`.trim()).join('\n') + '\n');
  total += items.length;
  rows.push(`| ${dir} | ${items.length} | index/${file} | ${items.slice(0, 3).map(i => i.ref.split('/').pop()).join(', ')} |`);
}
fs.writeFileSync(path.join(SOUNDS, 'CATALOG.md'), [
  '# Sound library catalog',
  '',
  `Generated automatically. ${total} sounds in ${groups.size} folders.`,
  '',
  'Use a sound in a reel by writing its path (from an index file, extension optional) in `reels/<n>/audio.json`.',
  'Open only the index file of the folder you need, or search: `search_code` for a keyword with `path:sounds/index`.',
  'Browse by kind instead: `LIBRARY.md` (tags and music moods) and `tags/<tag>.txt`. Reels without an audio.json pick sounds automatically.',
  '',
  '| Folder | Sounds | Index file | Examples |',
  '|---|---|---|---|',
  ...rows,
  ''
].join('\n'));

// ---- labels: effects get tags, music gets moods ----
const ov = readJson(path.join(SOUNDS, 'overrides.json')) || {};
const ovFor = ref => { const k = Object.keys(ov).find(x => x.toLowerCase().replace(EXT, '') === ref.toLowerCase()); return k ? ov[k] : null; };
const isBgm = ref => /^bgm\//i.test(ref);
const sfx = all.filter(a => !isBgm(a.ref)).map(a => {
  const o = ovFor(a.ref) || {};
  return { p: a.ref, d: a.d, t: o.tags && o.tags.length ? o.tags : tagsFor(a.ref), ...(o.skip ? { skip: 1 } : {}) };
});
const bgmAll = all.filter(a => isBgm(a.ref));
console.log(`analysing ${bgmAll.length} music tracks...`);
const feats = assignMoods(bgmAll.map(a => { try { return analyze(a.file); } catch { return null; } }));
const bgm = bgmAll.map((a, i) => {
  const f = feats[i], o = ovFor(a.ref) || {};
  let m = f ? f.moods.slice() : ['calm'];
  const h = hintMood(a.ref); if (h) m = [h, ...m.filter(x => x !== h)].slice(0, 2);
  if (o.moods && o.moods.length) m = o.moods;
  return { p: a.ref, d: a.d, m, bpm: f ? f.bpm : 0, e: f ? f.rank[0] : null, z: f ? f.rank[1] : null, ...(o.skip ? { skip: 1 } : {}) };
});
const line = e => JSON.stringify(e);
fs.writeFileSync(path.join(SOUNDS, 'library.json'), `{\n"v":1,\n"sfx":[\n${sfx.map(line).join(',\n')}\n],\n"bgm":[\n${bgm.map(line).join(',\n')}\n]\n}\n`);

// ---- tags/<tag>.txt ----
const td = path.join(SOUNDS, 'tags');
fs.rmSync(td, { recursive: true, force: true });
fs.mkdirSync(td, { recursive: true });
const byTag = new Map(), byMood = new Map();
for (const s of sfx) for (const t of s.t) { if (!byTag.has(t)) byTag.set(t, []); byTag.get(t).push(s); }
for (const b of bgm) for (const m of b.m) { if (!byMood.has(m)) byMood.set(m, []); byMood.get(m).push(b); }
for (const [t, a] of byTag) fs.writeFileSync(path.join(td, `${t}.txt`), a.map(s => `${s.p} ${s.d != null ? s.d + 's' : ''}`.trim()).join('\n') + '\n');
for (const [m, a] of byMood) fs.writeFileSync(path.join(td, `bgm-${m}.txt`), a.map(b => `${b.p} ${b.d != null ? b.d + 's' : ''} ~${b.bpm}bpm`.trim()).join('\n') + '\n');

// ---- LIBRARY.md ----
const mmss = s => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const tagRows = [...byTag].sort((a, b) => b[1].length - a[1].length).map(([t, a]) => `| ${t} | ${a.length} | tags/${t}.txt | ${a.slice(0, 3).map(s => s.p.split('/').pop()).join(', ')} |`);
const moodRows = [...byMood].sort((a, b) => b[1].length - a[1].length).map(([m, a]) => `| ${m} | ${a.length} | tags/bgm-${m}.txt |`);
const bgmRows = [...bgm].sort((a, b) => (a.m[0] < b.m[0] ? -1 : a.m[0] > b.m[0] ? 1 : a.p < b.p ? -1 : 1)).map(b => `| ${b.p.replace(/^bgm\//i, '')} | ${mmss(b.d)} | ${b.bpm || ''} | ${b.e != null ? Math.round(b.e * 100) : ''} | ${b.z != null ? Math.round(b.z * 100) : ''} | ${b.m.join(', ')}${b.skip ? ' (skipped)' : ''} |`);
fs.writeFileSync(path.join(SOUNDS, 'LIBRARY.md'), [
  '# Sound library: tags and moods',
  '',
  `Generated automatically from the files (do not edit). ${sfx.length} sound effects, ${bgm.length} music tracks.`,
  '',
  '## How reels use it',
  '',
  '- **No `audio.json`** (or one with `"auto": true`): the script text is read and sound is planned for it: a different music track for each mood of the story (crossfaded), and effects on story turns, numbers, shocks, questions, danger, fire/water... See `plan.mjs`. The plan is printed in the render log as `[auto]` lines.',
  '- **Several tracks by hand:** `"bgm":[{"mood":"calm","from":0,"to":30},{"mood":"epic","fromLine":12}]` or `{"sound":"bgm/<track>"}` per section.',
  '- **One effect by hand:** `{"line":12,"sound":"sfx/.../Deep hit"}`; a tag also works as a keyword, e.g. `"sound":"riser"`.',
  '- **Fix a wrong label** or hide a sound: add it to `sounds/overrides.json`, e.g. `{"bgm/some-track":{"moods":["epic"]},"sfx/some/loud-one":{"skip":true}}`, then run the Sound Catalog workflow.',
  '- Weapon sounds are never picked automatically.',
  '',
  '## Sound effect tags',
  '',
  'A sound can have several tags. Lists: `tags/<tag>.txt` (path and length).',
  '',
  '| Tag | Sounds | List | Examples |',
  '|---|---|---|---|',
  ...tagRows,
  '',
  '## Music moods',
  '',
  'Moods are measured from the audio (loudness, brightness, tempo, dynamics, compared with the other tracks) and from words in the file name, so they are a good first guess, not a promise. Correct any in `overrides.json`.',
  '',
  '| Mood | Tracks | List |',
  '|---|---|---|',
  ...moodRows,
  '',
  '## All music tracks',
  '',
  'Energy and brightness are ranks among all tracks (0 = lowest, 100 = highest). BPM is approximate.',
  '',
  '| Track | Length | BPM | Energy | Brightness | Moods |',
  '|---|---|---|---|---|---|',
  ...bgmRows,
  ''
].join('\n'));
console.log(`cataloged ${total} sounds in ${groups.size} folders: ${sfx.length} effects (${byTag.size} tags), ${bgm.length} music tracks (${byMood.size} moods)`);
