#!/usr/bin/env node
// Lists the sound library so it can be browsed without opening thousands of files:
//   sounds/CATALOG.md          folders, counts and a few examples
//   sounds/index/<folder>.txt  one line per sound: <path to use in audio.json> <length>
// Usage: node catalog.mjs [sounds-dir]   (needs ffprobe for the lengths)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SOUNDS = path.resolve(process.argv[2] || 'sounds');
const EXT = /\.(wav|mp3|ogg|oga|flac|m4a|aac|aif|aiff|opus)$/i;
const groups = new Map();

(function walk(d, rel) {
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.startsWith('.') || e.name === '__MACOSX' || (rel === '' && (e.name === 'index' || e.name === 'CATALOG.md'))) continue;
    const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { walk(p, r); continue; }
    if (!EXT.test(e.name)) continue;
    const dir = path.posix.dirname(r), ref = r.replace(EXT, '');
    const q = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' });
    const dur = parseFloat(q.stdout);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push({ ref, dur: Number.isFinite(dur) ? dur.toFixed(1) + 's' : '' });
  }
})(SOUNDS, '');

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
  'Use a sound in a reel by writing its path (from an index file, extension optional) in `reels/<name>/audio.json`.',
  'Open only the index file of the folder you need, or search: `search_code` for a keyword with `path:sounds/index`.',
  '',
  '| Folder | Sounds | Index file | Examples |',
  '|---|---|---|---|',
  ...rows,
  ''
].join('\n'));
console.log(`cataloged ${total} sounds in ${groups.size} folders`);
