#!/usr/bin/env node
// Gemini 3.8 TTS voice-over that is locked to the video's caption timing, using only a few API calls.
// Reads the caption lines (TXT) from the page, speaks them, then writes:
//   voice.wav    one audio track; line i starts exactly where its caption starts
//   timing.json  {"d":[seconds per line],"total":seconds}; render.mjs feeds it to the page as window.__TIMING
// Because the audio decides how long each line lasts, voice and captions/animation can't drift apart.
//
// Few calls: lines are sent to Gemini in batches (about 600 characters / 12 lines per call, so a 32-line reel is
// about 4 calls instead of 32). Each batch comes back as one audio file, which is cut back into lines at the
// pauses between them: the cuts are chosen where the silences are, guided by how long each line's text is.
// If a batch can't be cut reliably (too few pauses, or a line comes out an implausible length) it is redone as
// two smaller calls, down to one line per call, so sync never silently breaks.
// Every cut line is kept in TTS_CACHE_DIR, so a re-render only generates lines that changed.
//
// Usage (inside the reel folder): node <skill>/scripts/tts.mjs index.html [voice.wav] [timing.json]
// Needs: GEMINI_API_KEY (Google AI Studio key), playwright in this folder.
// Optional env: GEMINI_API_KEY_2 .. GEMINI_API_KEY_5 (extra keys; keys in the SAME Google project share one quota),
//               GEMINI_TTS_MODEL (default gemini-3.8-flash-lite-tts), GEMINI_VOICE (default Kore), GEMINI_TTS_STYLE,
//               TTS_BATCH_CHARS (default 600), TTS_BATCH_LINES (default 12), TTS_MIN_PAUSE_MS (default 120),
//               TTS_MIN_INTERVAL (seconds between calls on one key, default 7), TTS_CACHE_DIR
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const KEYS = [process.env.GEMINI_API_KEY, ...[2, 3, 4, 5].map(i => process.env['GEMINI_API_KEY_' + i])]
  .map(k => (k || '').trim()).filter(Boolean);
if (!KEYS.length) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const ks = KEYS.map((key, i) => ({ key, n: i + 1, readyAt: 0, dead: false })); // readyAt: earliest time this key may be used again
console.log(`Gemini keys in use: ${ks.length}`);
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const VOICE = process.env.GEMINI_VOICE || 'Kore';
const STYLE = process.env.GEMINI_TTS_STYLE || 'clear, engaging storyteller';
const BATCH_STYLE = STYLE + '; leave a clear pause of about half a second between paragraphs';
const CACHE = process.env.TTS_CACHE_DIR || '';
const MIN_GAP = Math.max(0, Number(process.env.TTS_MIN_INTERVAL ?? 7)) * 1000;
const MAX_CHARS = Math.max(50, Number(process.env.TTS_BATCH_CHARS || 600));
const MAX_LINES = Math.max(1, Number(process.env.TTS_BATCH_LINES || 12));
const [page = 'index.html', wavOut = 'voice.wav', timingOut = 'timing.json'] = process.argv.slice(2);
const LEAD = 0.5, GAP = 0.3, TAIL = 0.8; // LEAD must match the page's start offset (cs=.5)
let RATE = 24000;                          // replaced by the sample rate Gemini's WAV reports

// 1) caption lines come from the page itself, so voice and captions can't differ
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(path.resolve(page)).href);
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const lines = await tab.evaluate(() => (typeof TXT !== 'undefined' ? TXT : window.TXT));
await browser.close();
if (!Array.isArray(lines) || !lines.length) { console.error('no TXT array of caption lines found in ' + page); process.exit(1); }

// 2) one Gemini TTS call (for one line or a batch).
// Each call goes to the key that is ready soonest, so several keys share the work and each stays under its
// per-minute limit. A key that reports its daily quota is used up is dropped for the rest of the run; on a
// per-minute 429 that key rests for the time Google asks (Retry-After / retryDelay) while another key carries on.
// Gemini 3.8 reads `text` literally, so the speaking style goes in speechMetadata, never in the text.
const sleep = ms => new Promise(res => setTimeout(res, ms));
async function tts(text, style) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text, speechMetadata: { style } }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: VOICE } } }
  });
  const TRIES = 8 * ks.length;
  for (let a = 0; a < TRIES; a++) {
    const live = ks.filter(k => !k.dead);
    if (!live.length) throw new Error('Gemini TTS: every key has used up its daily quota');
    const k = live.reduce((x, y) => (y.readyAt < x.readyAt ? y : x));
    const wait = k.readyAt - Date.now();
    if (wait > 0) { if (wait > 5000) console.error(`  all keys busy, waiting ${Math.round(wait / 1000)}s`); await sleep(wait); }
    k.readyAt = Date.now() + MIN_GAP;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k.key }, body });
    if (r.ok) {
      const b64 = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) return Buffer.from(b64, 'base64');
      console.error(`  key ${k.n}: no audio in response (try ${a + 1}/${TRIES}), retrying`);
      k.readyAt = Date.now() + 5000;
      continue;
    }
    const t = await r.text();
    if (r.status !== 429 && r.status < 500) throw new Error(`Gemini TTS ${r.status} (key ${k.n}): ${t.slice(0, 300)}`);
    console.error(`  key ${k.n}: Gemini ${r.status} (try ${a + 1}/${TRIES}): ${t.replace(/\s+/g, ' ').slice(0, 250)}`);
    if (/PerDay|per day|daily/i.test(t)) {
      k.dead = true;
      console.error(`  key ${k.n}: daily quota used up, ${ks.filter(x => !x.dead).length} key(s) left`);
      continue;
    }
    let delay = Math.min(90000, 15000 + a * 5000);
    const ra = Number(r.headers.get('retry-after'));
    const m = t.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
    if (ra > 0) delay = ra * 1000 + 1000;
    else if (m) delay = Math.ceil(Number(m[1]) * 1000) + 1000;
    k.readyAt = Date.now() + Math.min(delay, 120000);
  }
  throw new Error('Gemini TTS failed after retries');
}

// Gemini 3.8 returns a complete WAV file: pull out the 16-bit mono samples and the sample rate
// (a bare PCM buffer is still accepted as 24 kHz)
function pcmOf(buf) {
  let pcm = buf;
  if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
    let p = 12, found = false;
    while (p + 8 <= buf.length) {
      const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4);
      if (id === 'fmt ') {
        const ch = buf.readUInt16LE(p + 10), bits = buf.readUInt16LE(p + 22);
        if (ch !== 1 || bits !== 16) throw new Error(`expected 16-bit mono WAV, got ${ch} ch / ${bits} bit`);
        RATE = buf.readUInt32LE(p + 12);
      } else if (id === 'data') { pcm = buf.subarray(p + 8, Math.min(buf.length, p + 8 + size)); found = true; break; }
      p += 8 + size + (size & 1);
    }
    if (!found) throw new Error('WAV from Gemini has no data chunk');
  }
  return new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + (pcm.length & ~1)));
}

// cut silence at both ends of a clip (keeps 50 ms) so lines sit tight against their captions
function trim(s) {
  const TH = 500, pad = Math.round(0.05 * RATE);
  let a = 0, b = s.length;
  while (a < b && Math.abs(s[a]) < TH) a++;
  while (b > a && Math.abs(s[b - 1]) < TH) b--;
  if (b <= a) return s;
  return s.slice(Math.max(0, a - pad), Math.min(s.length, b + pad));
}

// Cut one batch's audio back into its lines. Finds the silent gaps (10 ms frames below an adaptive threshold),
// then picks N-1 of them in order: a long gap is preferred, and so is one near where the text length says the
// boundary should be. Returns null if the cut doesn't look trustworthy, so the caller can redo the batch smaller.
function splitBatch(pcm, texts) {
  const N = texts.length;
  if (N === 1) return [pcm];
  const F = Math.round(RATE / 100);
  const nf = Math.floor(pcm.length / F);
  const rms = new Float64Array(nf);
  for (let f = 0; f < nf; f++) { let s = 0; for (let i = f * F; i < (f + 1) * F; i++) s += pcm[i] * pcm[i]; rms[f] = Math.sqrt(s / F); }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const thr = Math.max(150, sorted[Math.floor(nf * 0.95)] * 0.06);
  const MINSIL = Math.max(2, Math.round(Number(process.env.TTS_MIN_PAUSE_MS ?? 120) / 10));
  let first = 0; while (first < nf && rms[first] < thr) first++;
  let last = nf - 1; while (last > first && rms[last] < thr) last--;
  if (last - first < N) return null;
  const cands = []; // silent gaps strictly inside the speech
  for (let f = first; f <= last;) {
    if (rms[f] < thr) { let g = f; while (g <= last && rms[g] < thr) g++; if (g - f >= MINSIL) cands.push({ c: (f + g) / 2, len: g - f }); f = g; } else f++;
  }
  const K = N - 1, M = cands.length;
  if (M < K) return null;
  const w = texts.map(t => t.replace(/\s/g, '').length || 1), tot = w.reduce((a, b) => a + b, 0);
  const span = last - first, exp = []; let cum = 0;
  for (let k = 0; k < K; k++) { cum += w[k]; exp.push(first + (cum / tot) * span); }
  const cost = (k, j) => 4 * Math.abs(cands[j].c - exp[k]) / span - 3 * Math.min(cands[j].len, 70) / 70;
  const INF = 1e9;
  const dp = Array.from({ length: K }, () => new Float64Array(M).fill(INF));
  const from = Array.from({ length: K }, () => new Int32Array(M).fill(-1));
  for (let j = 0; j < M; j++) dp[0][j] = cost(0, j);
  for (let k = 1; k < K; k++) {
    let best = INF, bi = -1;
    for (let j = 0; j < M; j++) {
      if (j > 0 && dp[k - 1][j - 1] < best) { best = dp[k - 1][j - 1]; bi = j - 1; }
      if (best < INF) { dp[k][j] = best + cost(k, j); from[k][j] = bi; }
    }
  }
  let bj = -1, bv = INF;
  for (let j = 0; j < M; j++) if (dp[K - 1][j] < bv) { bv = dp[K - 1][j]; bj = j; }
  if (bj < 0) return null;
  const pick = new Array(K);
  for (let k = K - 1, j = bj; k >= 0; k--) { pick[k] = j; j = from[k][j]; }
  const cuts = [0, ...pick.map(j => Math.round(cands[j].c * F)), pcm.length];
  const parts = [];
  for (let k = 0; k < N; k++) parts.push(pcm.slice(cuts[k], cuts[k + 1]));
  // sanity: every line's speech length per character must be close to the typical one
  const per = parts.map((p, k) => trim(p).length / w[k]);
  const med = [...per].sort((a, b) => a - b)[N >> 1];
  if (!(med > 0) || per.some(r => r < 0.4 * med || r > 2.5 * med)) return null;
  return parts;
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// per-line cache: same model + voice + style + text -> same clip (older per-line clips from earlier runs still count)
const memo = new Map();
const lineFile = text => path.join(CACHE, crypto.createHash('sha1').update([MODEL, VOICE, STYLE, text].join('\u0000')).digest('hex') + '.wav');
function getLine(text) {
  if (memo.has(text)) return memo.get(text);
  if (CACHE) { const f = lineFile(text); if (fs.existsSync(f)) { const c = pcmOf(fs.readFileSync(f)); memo.set(text, c); return c; } }
  return null;
}
function putLine(text, pcm) {
  memo.set(text, pcm);
  if (CACHE) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(lineFile(text), wav(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))); }
}

// 3) generate what the cache doesn't have, in batches
const n = lines.length, clips = new Array(n);
const need = [];
for (let i = 0; i < n; i++) { const c = getLine(lines[i]); if (c) clips[i] = c; else need.push(i); }
console.log(`${n - need.length} of ${n} lines from cache, ${need.length} to generate`);

const batches = []; let cur = [], chars = 0;
for (const i of need) {
  if (cur.length && (cur.length >= MAX_LINES || chars + lines[i].length > MAX_CHARS)) { batches.push(cur); cur = []; chars = 0; }
  cur.push(i); chars += lines[i].length;
}
if (cur.length) batches.push(cur);

async function speak(idx) {
  const texts = idx.map(i => lines[i]);
  console.log(`TTS call: ${idx.length} line(s) [${idx.map(i => i + 1).join(',')}]`);
  const pcm = pcmOf(await tts(idx.length === 1 ? texts[0] : texts.join('\n\n'), idx.length === 1 ? STYLE : BATCH_STYLE));
  const parts = splitBatch(pcm, texts);
  if (!parts) {
    console.error(`  could not cut lines [${idx.map(i => i + 1).join(',')}] apart reliably; redoing as two smaller calls`);
    const h = idx.length >> 1;
    await speak(idx.slice(0, h));
    await speak(idx.slice(h));
    return;
  }
  idx.forEach((i, k) => { putLine(lines[i], parts[k]); clips[i] = parts[k]; });
}
for (const b of batches) await speak(b);
for (let i = 0; i < n; i++) clips[i] = trim(clips[i]);

// 4) lay clips on one timeline; each line's slot = clip length + gap, so slots are the caption durations
const leadS = Math.round(LEAD * RATE), gapS = Math.round(GAP * RATE), tailS = Math.round(TAIL * RATE);
const slots = clips.map((c, i) => c.length + (i === n - 1 ? tailS : gapS));
const out = new Int16Array(leadS + slots.reduce((x, y) => x + y, 0));
let pos = leadS;
clips.forEach((c, i) => { out.set(c, pos); pos += slots[i]; });

fs.writeFileSync(wavOut, wav(Buffer.from(out.buffer)));
fs.writeFileSync(timingOut, JSON.stringify({ d: slots.map(s => s / RATE), total: out.length / RATE }));
console.log(`wrote ${wavOut} and ${timingOut} (${(out.length / RATE).toFixed(2)}s, ${n} lines)`);
