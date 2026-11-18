#!/usr/bin/env node
// Gemini TTS voice-over that is locked to the video's caption timing.
// Reads the caption lines (TXT) from the page, speaks each line, then writes:
//   voice.wav    one audio track; line i starts exactly where its caption starts
//   timing.json  {"d":[seconds per line],"total":seconds}; render.mjs feeds it to the page as window.__TIMING
// Because the audio decides how long each line lasts, voice and captions/animation can't drift apart.
// Usage (inside the reel folder): node <skill>/scripts/tts.mjs index.html [voice.wav] [timing.json]
// Needs: GEMINI_API_KEY, playwright in this folder. Optional env: GEMINI_TTS_MODEL, GEMINI_VOICE, GEMINI_TTS_STYLE.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const VOICE = process.env.GEMINI_VOICE || 'Kore';
const STYLE = process.env.GEMINI_TTS_STYLE || 'Say in a clear, engaging storytelling voice: ';
const [page = 'index.html', wavOut = 'voice.wav', timingOut = 'timing.json'] = process.argv.slice(2);
const RATE = 24000;                 // Gemini TTS returns 24 kHz, 16-bit, mono PCM
const LEAD = 0.5, GAP = 0.3, TAIL = 0.8; // LEAD must match the page's start offset (cs=.5)

// 1) caption lines come from the page itself, so voice and captions can't differ
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright');
const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(path.resolve(page)).href);
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const lines = await tab.evaluate(() => (typeof TXT !== 'undefined' ? TXT : window.TXT));
await browser.close();
if (!Array.isArray(lines) || !lines.length) { console.error('no TXT array of caption lines found in ' + page); process.exit(1); }

// 2) one Gemini TTS call per line (retries on rate limits / server errors)
async function tts(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: STYLE + text }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } }
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

// cut silence at both ends of a clip (keeps 50 ms) so lines sit tight against their captions
function trim(pcm) {
  const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + (pcm.length & ~1)));
  const TH = 500, pad = Math.round(0.05 * RATE);
  let a = 0, b = s.length;
  while (a < b && Math.abs(s[a]) < TH) a++;
  while (b > a && Math.abs(s[b - 1]) < TH) b--;
  if (b <= a) return s;
  return s.slice(Math.max(0, a - pad), Math.min(s.length, b + pad));
}

const n = lines.length, clips = [];
for (let i = 0; i < n; i++) { console.log(`TTS ${i + 1}/${n}`); clips.push(trim(await tts(lines[i]))); }

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
