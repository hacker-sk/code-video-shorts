#!/usr/bin/env node
// Gemini 3.8 TTS voice-over that is locked to the video's caption timing.
// Reads the caption lines (TXT) from the page, speaks each line, then writes:
//   voice.wav    one audio track; line i starts exactly where its caption starts
//   timing.json  {"d":[seconds per line],"total":seconds}; render.mjs feeds it to the page as window.__TIMING
// Because the audio decides how long each line lasts, voice and captions/animation can't drift apart.
// Usage (inside the reel folder): node <skill>/scripts/tts.mjs index.html [voice.wav] [timing.json]
// Needs: GEMINI_API_KEY (Google AI Studio key), playwright in this folder.
// Optional env: GEMINI_API_KEY_2 .. GEMINI_API_KEY_5 (extra keys: when one hits its limit the next one is used),
//               GEMINI_TTS_MODEL (default gemini-3.8-flash-lite-tts), GEMINI_VOICE (default Kore), GEMINI_TTS_STYLE,
//               TTS_MIN_INTERVAL (seconds between calls on one key, default 7, keeps under free-tier per-minute limits),
//               TTS_CACHE_DIR (a folder where each generated line is kept; an unchanged line is reused instead of being generated again)
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
const CACHE = process.env.TTS_CACHE_DIR || '';
const MIN_GAP = Math.max(0, Number(process.env.TTS_MIN_INTERVAL ?? 7)) * 1000;
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

// 2) one Gemini TTS call per line.
// Each call goes to the key that is ready soonest, so several keys share the work and each stays under its
// per-minute limit. A key that reports its daily quota is used up is dropped for the rest of the run; on a
// per-minute 429 that key rests for the time Google asks (Retry-After / retryDelay) while another key carries on.
// Gemini 3.8 reads `text` literally, so the speaking style goes in speechMetadata, never in the text.
const sleep = ms => new Promise(res => setTimeout(res, ms));
async function tts(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text, speechMetadata: { style: STYLE } }] }],
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

// same model + voice + style + text -> same clip, kept in TTS_CACHE_DIR (the key doesn't matter)
async function ttsCached(text) {
  if (!CACHE) return tts(text);
  const f = path.join(CACHE, crypto.createHash('sha1').update([MODEL, VOICE, STYLE, text].join('\u0000')).digest('hex') + '.wav');
  if (fs.existsSync(f)) { console.log('  (cached)'); return fs.readFileSync(f); }
  const b = await tts(text);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, b);
  return b;
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

const n = lines.length, clips = [];
for (let i = 0; i < n; i++) { console.log(`TTS ${i + 1}/${n}`); clips.push(trim(pcmOf(await ttsCached(lines[i])))); }

// 3) lay clips on one timeline; each line's slot = clip length + gap, so slots are the caption durations
const leadS = Math.round(LEAD * RATE), gapS = Math.round(GAP * RATE), tailS = Math.round(TAIL * RATE);
const slots = clips.map((c, i) => c.length + (i === n - 1 ? tailS : gapS));
const out = new Int16Array(leadS + slots.reduce((x, y) => x + y, 0));
let pos = leadS;
clips.forEach((c, i) => { out.set(c, pos); pos += slots[i]; });

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
fs.writeFileSync(wavOut, wav(Buffer.from(out.buffer)));
fs.writeFileSync(timingOut, JSON.stringify({ d: slots.map(s => s / RATE), total: out.length / RATE }));
console.log(`wrote ${wavOut} and ${timingOut} (${(out.length / RATE).toFixed(2)}s, ${n} lines)`);
