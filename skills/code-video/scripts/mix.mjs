#!/usr/bin/env node
// Builds the reel's soundtrack (mix.wav): voice-over + background music + sound effects.
// Run it inside the reel folder: node <skill>/scripts/mix.mjs [mix.wav]
// Sources, all optional:
//   voice.wav + timing.json   from tts.mjs
//   audio.json                {"bgm":"bgm/epic/dark","bgmVolume":0.1,"voiceVolume":1,
//                              "sfx":[{"line":0,"offset":0,"sound":"sfx/whoosh/whoosh-01","volume":0.4},{"at":12.5,"sound":"impact","dur":3}]}
//   music.wav|mp3             a plain background track in the folder (used under voice/sfx)
// A cue is placed at `at` seconds, or at the start of caption line `line` plus `offset`, so effects follow the voice.
// `sound` is a path under the sounds/ library (extension optional). A folder, a bare file name or a keyword also works:
// the file is then picked from the matches (always the same one for the same reel). `dur` caps a long effect (default 6 s).
//
// THE VOICE-OVER ALWAYS STAYS ON TOP. When there is a voice, every effect and music track is measured and limited relative to the voice:
// an effect's loudest point stays 9 dB below the voice's loudest point, music's average stays 14 dB below the voice's average, and no
// effect goes above volume 0.5 or music above 0.2, whatever the file's own loudness or the volume written in audio.json (lower values are kept).
// So nothing needs ducking: the music keeps a steady low level (add "duck": true for the old duck-under-the-voice behaviour).
// Tune with "sfxBelowDb", "bgmBelowDb", "sfxMax", "bgmMax" in audio.json. Default music volume: 0.1 with a voice, 0.15 without.
//
// MULTIPLE MUSIC TRACKS: `bgm` can also be a list of sections, crossfaded into each other:
//   "bgm":[{"sound":"bgm/calm-track","from":0,"to":30},{"mood":"epic","fromLine":12,"toLine":20,"volume":0.12},{"mood":"hopeful","fromLine":21}]
//   a section has `sound` (path/folder/keyword) or `mood` (calm hopeful epic tense dark sad energetic mysterious warm playful: a track of that
//   mood is picked from sounds/library.json); `from`/`to` in seconds or `fromLine`/`toLine` (caption lines); missing times follow the neighbours.
//
// AUTOMATIC SOUND: when audio.json is missing, or has no "sfx" and no "bgm", or has "auto": true, the script text (TXT in index.html)
// is read and music + effects are chosen for it (see plan.mjs): different music for the different moods of the story, effects on story turns,
// numbers, shocks, questions, danger, fire/water ambience... "auto": false turns it off. "auto": {"sfx":false} or {"bgm":false} keeps one half manual.
// Other options: "mood":"epic" (or a list) nudges the music, "density":"low|normal|high" sets how many effects, "sfxVolume":1.
// The plan is printed in the log as [auto] lines and written to audio.plan.json.
// Writes nothing and exits 0 when there is nothing to mix (a lone music.wav is then handled by the workflow, as before).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { autoPlan, pickBgm } from './plan.mjs';
import { tagsFor, readJson } from './soundlib.mjs';

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
const BGM_DEF = voice ? 0.1 : 0.15;   // default music volume
const lin = db => Math.pow(10, db / 20);

// loudest point and average level of a file (first `secs` seconds), in dB, or null
function measure(file, secs) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-t', String(secs), '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr || '', m = /mean_volume:\s*(-?[\d.]+) dB/.exec(s), x = /max_volume:\s*(-?[\d.]+) dB/.exec(s);
  return m && x ? { mean: +m[1], max: +x[1] } : null;
}

// ---- sound library ----
const EXT = /\.(wav|mp3|ogg|oga|flac|m4a|aac|aif|aiff|opus)$/i;
const lib = [];
(function walk(d, rel) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === '__MACOSX' || (rel === '' && (e.name === 'index' || e.name === 'tags'))) continue;
    const p = path.join(d, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(p, r);
    else if (EXT.test(e.name)) lib.push({ rel: r.replace(EXT, '').toLowerCase(), file: p });
  }
})(SOUNDS, '');
lib.sort((a, b) => (a.rel < b.rel ? -1 : 1));
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
// tagged library for the planner: sounds/library.json (made by catalog.mjs) or, if it is not there yet, built from the folder names
function planLibrary() {
  const L = readJson(path.join(SOUNDS, 'library.json'));
  if (L && Array.isArray(L.sfx) && Array.isArray(L.bgm)) return L;
  const o = { sfx: [], bgm: [] };
  for (const s of lib) { if (s.rel.startsWith('bgm/')) o.bgm.push({ p: s.rel }); else o.sfx.push({ p: s.rel, t: tagsFor(s.rel) }); }
  warn('sounds/library.json not found: using folder and file names only (run the Sound Catalog workflow for moods and lengths)');
  return o;
}

// the script's caption lines (const TXT=[...] in index.html)
function readLines() {
  try {
    const h = fs.readFileSync('index.html', 'utf8'), m = h.indexOf('const TXT=');
    if (m < 0) return null;
    const i = h.indexOf('[', m); let depth = 0, q = null, j = i;
    for (; j < h.length; j++) {
      const c = h[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; }
      else if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '[') depth++;
      else if (c === ']') { depth--; if (!depth) break; }
    }
    const a = new Function('return ' + h.slice(i, j + 1))();
    return Array.isArray(a) ? a.map(String) : null;
  } catch { return null; }
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

let legacy = null;
for (const m of ['music.wav', 'music.mp3']) if (fs.existsSync(m)) legacy = m;
let starts, startsRead = false;
const getStarts = async () => { if (!startsRead) { starts = await lineStarts(); startsRead = true; } return starts; };

// ---- automatic plan (only when audio.json does not spell the sound out, or asks for "auto") ----
const explicit = (au.sfx && au.sfx.length) || au.bgm;
const autoOn = au.auto === false ? false : au.auto ? true : !explicit;
let plan = null;
if (autoOn && lib.length) {
  try {
    const lines = readLines();
    const st = lines ? await getStarts() : null;
    const aOpt = typeof au.auto === 'object' && au.auto ? au.auto : {};
    plan = autoPlan({ lines, starts: st, total, lib: planLibrary(), reel, au: { ...au, auto: { ...aOpt, bgm: legacy ? false : aOpt.bgm } } });
    plan.log.forEach(l => console.log('[auto] ' + l));
    if (plan.sfx.length || plan.bgm.length) fs.writeFileSync('audio.plan.json', JSON.stringify({ bgm: plan.bgm, sfx: plan.sfx }, null, 1));
    else warn('auto plan found nothing to add');
  } catch (e) { warn('auto sound plan failed, continuing without it: ' + e.message); plan = null; }
}

// ---- cues ----
const cues = [];
// planned effects are kept a little softer than hand-written ones
const allSfx = [...(au.sfx || []), ...(plan?.sfx || []).map(c => ({ ...c, volume: (c.volume ?? 0.3) * 0.75 }))];
for (const [i, c] of allSfx.entries()) {
  let at = c.at;
  if (at == null && c.line != null) {
    const s = await getStarts();
    if (s?.[c.line] == null) { warn(`sfx #${i}: no caption line ${c.line}`); continue; }
    at = s[c.line] + (c.offset || 0);
  }
  if (at == null || at < 0 || at >= total) { warn(`sfx #${i}: time ${at} is outside the video`); continue; }
  const f = resolve(c.sound, `${reel}:${i}:${c.sound}`);
  if (!f) { warn(`sfx #${i}: sound "${c.sound}" not found`); continue; }
  cues.push({ f, at, vol: c.volume ?? 0.4, cap: c.dur ?? 6 });
}

// ---- music sections ----
const normBgm = b => (b ? (Array.isArray(b) ? b : [b]).map(x => (typeof x === 'string' ? { sound: x } : x)) : []);
let segIn = normBgm(au.bgm);
if (!segIn.length && plan?.bgm?.length) segIn = plan.bgm;
const usedBgm = new Set();
let bgmSegs = [];
if (segIn.length) {
  const needStarts = segIn.some(x => x.fromLine != null || x.toLine != null);
  const st = needStarts ? await getStarts() : starts;
  const lineEnd = i => (st && st[i + 1] != null ? st[i + 1] : total);
  const items = [];
  for (const [k, x] of segIn.entries()) {
    let f = null;
    if (x.sound) f = resolve(x.sound, `${reel}:bgm${k}`);
    else if (x.mood) { const b = pickBgm(planLibrary().bgm, x.mood, reel, usedBgm, 45); if (b) f = resolve(b.p, `${reel}:bgm${k}`); }
    if (!f) { warn(`bgm section #${k}: "${x.sound || x.mood}" not found`); continue; }
    const nextFrom = (() => { const n = segIn[k + 1]; return n ? (n.from ?? (n.fromLine != null && st?.[n.fromLine] != null ? st[n.fromLine] : null)) : total; })();
    items.push({
      f, vol: x.volume ?? au.bgmVolume ?? BGM_DEF,
      from: x.from ?? (x.fromLine != null && st?.[x.fromLine] != null ? st[x.fromLine] : null),
      to: x.to ?? (x.toLine != null ? lineEnd(x.toLine) : nextFrom),
    });
  }
  items.forEach((s, k) => {
    if (s.from == null) s.from = k === 0 ? 0 : (items[k - 1].to ?? total * k / items.length);
    if (s.to == null) s.to = total * (k + 1) / items.length;
    s.from = Math.max(0, Math.min(total, s.from)); s.to = Math.max(0, Math.min(total, s.to));
  });
  bgmSegs = items.filter(s => s.to - s.from >= 2);
  if (bgmSegs.length) { bgmSegs[0].from = 0; bgmSegs[bgmSegs.length - 1].to = total; }
}
if (!bgmSegs.length && legacy && (voice || cues.length)) bgmSegs = [{ f: legacy, vol: au.bgmVolume ?? BGM_DEF, from: 0, to: total }];
if (!voice && !cues.length && !bgmSegs.length) { console.log('[mix] nothing to mix'); process.exit(0); }

// ---- keep everything under the voice-over ----
// Each effect and music track is measured and its volume limited relative to the voice, so a loud file can never cover the speech.
if (voice) {
  const vm = measure(voice, 900);
  const SFX_BELOW = au.sfxBelowDb ?? 9, BGM_BELOW = au.bgmBelowDb ?? 14, SFX_MAX = au.sfxMax ?? 0.5, BGM_MAX = au.bgmMax ?? 0.2;
  let cutS = 0, cutB = 0;
  for (const c of cues) {
    let cap = SFX_MAX; const m = measure(c.f, c.cap);
    if (vm && m) cap = Math.min(cap, lin(vm.max - SFX_BELOW - m.max)); else if (!m) cap = Math.min(cap, 0.3);
    if (c.vol > cap) { c.vol = cap; cutS++; }
  }
  for (const s of bgmSegs) {
    let cap = BGM_MAX; const m = measure(s.f, 60);
    if (vm && m) cap = Math.min(cap, lin(vm.mean - BGM_BELOW - m.mean)); else if (!m) cap = Math.min(cap, 0.1);
    if (s.vol > cap) { s.vol = cap; cutB++; }
  }
  console.log(`[mix] voice level: ${vm ? `peak ${vm.max} dB, average ${vm.mean} dB` : 'not measured'}; effects <= ${SFX_BELOW} dB below the voice peak (${cutS} of ${cues.length} lowered), music <= ${BGM_BELOW} dB below the voice average (${cutB} of ${bgmSegs.length} lowered)`);
}

// ---- ffmpeg graph ----
const T = total.toFixed(3), A = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
const args = ['-y', '-loglevel', 'error'], fl = [], mixIn = [];
let n = 0;
if (voice) { args.push('-i', voice); fl.push(`[${n++}:a]${A},volume=${au.voiceVolume ?? 1}[v]`); }
const hasBgm = bgmSegs.length > 0;
if (hasBgm && bgmSegs.length === 1 && bgmSegs[0].from <= 0.01 && bgmSegs[0].to >= total - 0.01) {
  // one track for the whole video
  args.push('-stream_loop', '-1', '-i', bgmSegs[0].f);
  const fo = total > 2.5 ? `,afade=t=out:st=${(total - 1.5).toFixed(3)}:d=1.5` : '';
  fl.push(`[${n++}:a]${A},atrim=0:${T},afade=t=in:d=0.6${fo},volume=${bgmSegs[0].vol.toFixed(4)}[b]`);
} else if (hasBgm) {
  // several tracks, crossfaded into each other
  const XF = 1.5, last = bgmSegs.length - 1, tags = [];
  bgmSegs.forEach((s, k) => {
    const st = k === 0 ? 0 : Math.max(0, s.from - XF / 2), en = k === last ? total : Math.min(total, s.to + XF / 2), len = Math.max(1, en - st);
    const fin = k === 0 ? 'afade=t=in:d=0.6' : `afade=t=in:d=${XF}`;
    const fou = k === last ? (total > 2.5 ? `,afade=t=out:st=${Math.max(0, len - 1.5).toFixed(3)}:d=1.5` : '') : `,afade=t=out:st=${Math.max(0, len - XF).toFixed(3)}:d=${XF}`;
    const ms = Math.round(st * 1000);
    args.push('-stream_loop', '-1', '-i', s.f);
    fl.push(`[${n++}:a]${A},atrim=0:${len.toFixed(3)},asetpts=PTS-STARTPTS,${fin}${fou},volume=${s.vol.toFixed(4)},adelay=${ms}|${ms}[g${k}]`);
    tags.push(`[g${k}]`);
  });
  fl.push(`${tags.join('')}amix=inputs=${tags.length}:normalize=0:duration=longest[b]`);
}
if (voice && hasBgm && au.duck === true) {
  // optional: music ducks under the voice (off by default: levels are already kept under the voice)
  fl.push('[v]asplit=2[vm][vs]', '[b][vs]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=400[bd]');
  mixIn.push('vm', 'bd');
} else if (voice) { mixIn.push('v'); if (hasBgm) mixIn.push('b'); }
else if (hasBgm) mixIn.push('b');
cues.forEach((c, k) => {
  args.push('-i', c.f);
  const ms = Math.round(c.at * 1000);
  fl.push(`[${n++}:a]${A},atrim=0:${(+c.cap).toFixed(3)},afade=t=out:st=${Math.max(0, c.cap - 0.15).toFixed(3)}:d=0.15,volume=${c.vol.toFixed(4)},adelay=${ms}|${ms}[s${k}]`);
  mixIn.push('s' + k);
});
fl.push(`${mixIn.map(l => `[${l}]`).join('')}amix=inputs=${mixIn.length}:normalize=0:duration=longest,alimiter=limit=0.95,apad=whole_dur=${T},atrim=0:${T}[o]`);

const r = spawnSync('ffmpeg', [...args, '-filter_complex', fl.join(';'), '-map', '[o]', '-ar', '44100', out], { stdio: 'inherit' });
if (r.status !== 0) { console.error('[mix] ffmpeg failed'); process.exit(1); }
console.log(`[mix] wrote ${out}: ${voice ? 'voice, ' : ''}${hasBgm ? 'music (' + bgmSegs.map(s => path.basename(s.f)).join(' > ') + '), ' : ''}${cues.length} sound effects, ${T}s`);
