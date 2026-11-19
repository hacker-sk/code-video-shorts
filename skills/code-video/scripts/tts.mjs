#!/usr/bin/env node
// Gemini 3.8 TTS voice-over that is locked to the video's caption timing.
// Reads the caption lines (TXT) from the page, speaks each line, then writes:
//   voice.wav    one audio track; line i starts exactly where its caption starts
//   timing.json  {"d":[seconds per line],"total":seconds}; render.mjs feeds it to the page as window.__TIMING
// Because the audio decides how long each line lasts, voice and captions/animation can't drift apart.
// Usage (inside the reel folder): node <skill>/scripts/tts.mjs index.html [voice.wav] [timing.json]
// Needs: GEMINI_API_KEY (Google AI Studio key), playwright in this folder.
// Optional env: GEMINI_TTS_MODEL (default gemini-3.8-flash-tts), GEMINI_VOICE (default Kore), GEMINI_TTS_STYLE,
//               TTS_CACHE_DIR (a folder where each generated line is kept; an unchanged line is reused instead of being generated again)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
const VOICE = process.env.GEMINI_VOICE || 'Kore';
const STYLE = process.env.GEMINI_TTS_STYLE || 'clear, engaging storyteller';
const CACHE = process.env.TTS_CACHE_DIR || '';
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

// 2) one Gemini TTS call per line (retries on rate limits / server errors).
// Gemini 3.8 reads `text` literally, so the speaking style goes in speechMetadata, never in the text.
async function tts(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text, speechMetadata: { style: STYLE } }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: VOICE } } }
  });
  for (let a = 0; a < 6; a++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body });
    if (r.ok) {
      const b64 = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) return Buffer.from(b64, 'base64');
      console.error('no audio in response, retrying');
    } else if (r.status !== 429 && r.status < 500) {
      throw new Error(`Gemini TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);
    }
    await new Promise(res => setTimeout(res, (a + 1) * 8000));
  }
  throw new Error('Gemini TTS failed after retries');
}

// same model + voice + style + text -> same clip, kept in TTS_CACHE_DIR
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
