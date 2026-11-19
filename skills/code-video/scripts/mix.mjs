#!/usr/bin/env node
// Builds the reel's soundtrack (mix.wav): voice-over + background music (ducked under the voice) + sound effects.
// Run it inside the reel folder: node <skill>/scripts/mix.mjs [mix.wav]
// Sources, all optional:
//   voice.wav + timing.json   from tts.mjs
//   audio.json                {"bgm":"bgm/epic/dark","bgmVolume":0.15,"voiceVolume":1,
//                              "sfx":[{"line":0,"offset":0,"sound":"sfx/whoosh/whoosh-01","volume":0.8},{"at":12.5,"sound":"impact","dur":3}]}
//   music.wav|mp3             a plain background track in the folder (used under voice/sfx)
// A cue is placed at `at` seconds, or at the start of caption line `line` plus `offset`, so effects follow the voice.
// `sound` is a path under the sounds/ library (extension optional). A folder, a bare file name or a keyword also works:
// the file is then picked from the matches (always the same one for the same reel). `dur` caps a long effect (default 6 s).
// Writes nothing and exits 0 when there is nothing to mix (a lone music.wav is then handled by the workflow, as before).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const out = process.argv[2] || 'mix.wav';
const SOUNDS = process.env.SOUNDS_DIR || path.resolve(ROOT, '../../sounds');
const LEAD = 0.5; // first caption starts here (same constant as tts.mjs and the page)
const rd = f => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const cfg = rd('video.json') || {}, timing = rd('timing.json'), au = rd('audio.json') || {};
const voice = fs.existsSync('voice.wav') ? 'voice.wav' : null;
const total = +(timing?.total ?? cfg.duration ?? 8);
const reel = path.basename(ROOT);
const warn = m => console.warn('[mix] ' + m);

// ---- sound library ----
const EXT = /\.(wav|mp3|ogg|oga|flac|m4a|aac|aif|aiff|opus)$/i;
const lib = [];
if ((au.sfx && au.sfx.length) || au.bgm) {
  (function walk(d, rel) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === '__MACOSX' || (rel === '' && e.name === 'index')) continue;
      const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (EXT.test(e.name)) lib.push({ rel: r.replace(EXT, '').toLowerCase(), file: p });
    }
  })(SOUNDS, '');
  lib.sort((a, b) => (a.rel < b.rel ? -1 : 1));
  if (!lib.length) warn(`no sounds found in ${SOUNDS}`);
}
const pick = (arr, seed) => arr[crypto.createHash('md5').update(seed).digest().readUInt32BE(0) % arr.length];
function resolve(ref, seed) {
  if (typeof ref !== 'string' || !ref) return null;
  if (fs.existsSync(path.join(ROOT, ref)) && EXT.test(ref)) return path.join(ROOT, ref); // a file next to the reel
  const key = ref.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/^sounds\//i, '').replace(EXT, '').toLowerCase();
  let c = lib.filter(s => s.rel === key);                                   // exact path
  if (!c.length) c = lib.filter(s => s.rel.startsWith(key + '/'));            // a folder
  if (!c.length) c = lib.filter(s => s.rel.split('/').pop() === key);         // a bare file name
  if (!c.length) c = lib.filter(s => s.rel.includes(key));                    // a keyword
  return c.length ? pick(c, seed).file : null;
}

// start time of each caption line: from timing.json, else from the page's own timeline (C)
async function lineStarts() {
  if (timing?.d) { let t = LEAD; return timing.d.map(d => { const s = t; t += d; return s; }); }
  try {
    const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
    const b = await chromium.launch(), tab = await b.newPage();
    await tab.goto(pathToFileURL(path.resolve('index.html')).href);
    await tab.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    const s = await tab.evaluate(() => (typeof C !== 'undefined' ? C.map(c => c.s) : null));
    await b.close();
    return s;
  } catch (e) { warn('could not read caption timing from the page: ' + e.message); return null; }
}

// ---- cues ----
const cues = [];
let starts, startsRead = false;
for (const [i, c] of (au.sfx || []).entries()) {
  let at = c.at;
  if (at == null && c.line != null) {
    if (!startsRead) { starts = await lineStarts(); startsRead = true; }
    if (starts?.[c.line] == null) { warn(`sfx #${i}: no caption line ${c.line}`); continue; }
    at = starts[c.line] + (c.offset || 0);
  }
  if (at == null || at < 0 || at >= total) { warn(`sfx #${i}: time ${at} is outside the video`); continue; }
  const f = resolve(c.sound, `${reel}:${i}:${c.sound}`);
  if (!f) { warn(`sfx #${i}: sound "${c.sound}" not found`); continue; }
  cues.push({ f, at, vol: c.volume ?? 0.8, cap: c.dur ?? 6 });
}
let libBgm = null;
if (au.bgm) { libBgm = resolve(au.bgm, `${reel}:bgm`); if (!libBgm) warn(`bgm "${au.bgm}" not found`); }
let legacy = null;
for (const m of ['music.wav', 'music.mp3']) if (fs.existsSync(m)) legacy = m;
const bgm = libBgm || (voice || cues.length ? legacy : null);
if (!voice && !cues.length && !bgm) { console.log('[mix] nothing to mix'); process.exit(0); }

// ---- ffmpeg graph ----
const T = total.toFixed(3), A = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
const args = ['-y', '-loglevel', 'error'], fl = [], mixIn = [];
let n = 0;
if (voice) { args.push('-i', voice); fl.push(`[${n++}:a]${A},volume=${au.voiceVolume ?? 1}[v]`); }
if (bgm) {
  args.push('-stream_loop', '-1', '-i', bgm);
  const fo = total > 2.5 ? `,afade=t=out:st=${(total - 1.5).toFixed(3)}:d=1.5` : '';
  fl.push(`[${n++}:a]${A},atrim=0:${T},afade=t=in:d=0.6${fo},volume=${au.bgmVolume ?? 0.15}[b]`);
}
if (voice && bgm) {
  // music ducks under the voice
  fl.push('[v]asplit=2[vm][vs]', '[b][vs]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=400[bd]');
  mixIn.push('vm', 'bd');
} else if (voice) mixIn.push('v');
else if (bgm) mixIn.push('b');
cues.forEach((c, k) => {
  args.push('-i', c.f);
  const ms = Math.round(c.at * 1000);
  fl.push(`[${n++}:a]${A},atrim=0:${(+c.cap).toFixed(3)},afade=t=out:st=${Math.max(0, c.cap - 0.15).toFixed(3)}:d=0.15,volume=${c.vol},adelay=${ms}|${ms}[s${k}]`);
  mixIn.push('s' + k);
});
fl.push(`${mixIn.map(l => `[${l}]`).join('')}amix=inputs=${mixIn.length}:normalize=0:duration=longest,alimiter=limit=0.95,apad=whole_dur=${T},atrim=0:${T}[o]`);

const r = spawnSync('ffmpeg', [...args, '-filter_complex', fl.join(';'), '-map', '[o]', '-ar', '44100', out], { stdio: 'inherit' });
if (r.status !== 0) { console.error('[mix] ffmpeg failed'); process.exit(1); }
console.log(`[mix] wrote ${out}: ${voice ? 'voice, ' : ''}${bgm ? 'music (' + path.basename(bgm) + '), ' : ''}${cues.length} sound effects, ${T}s`);
