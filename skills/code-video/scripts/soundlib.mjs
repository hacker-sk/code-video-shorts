// Shared by catalog.mjs (builds sounds/library.json) and plan.mjs / mix.mjs (pick sounds for a reel).
// tagsFor(path)   -> what a sound effect is (whoosh, hit, riser, fire, ...), from its folder and file name
// analyze(file)   -> rough features of a music track (loudness, brightness, tempo, dynamics), measured with ffmpeg
// assignMoods([]) -> mood labels for every track, by comparing the tracks with each other
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export const EXT = /\.(wav|mp3|ogg|oga|flac|m4a|aac|aif|aiff|opus)$/i;

// [tag, pattern on the lower-case path with _ - . turned into spaces]
const RULES = [
  ['whoosh', /whoosh|swoosh|swish|fly ?by|\bzing\b|swipe/],
  ['hit', /\b(hits?|impact|boom|slam|thud|punch|stinger)\b/],
  ['riser', /riser|build ?up|uplifter/],
  ['subdrop', /sub ?drop|bass drop|\bsd low/],
  ['bell', /\bbells?\b|chime|\bding\b|glock|shimmer|flare/],
  ['tension', /horror|tension|lurk|creep|scary|eerie|braam|monster|dread|ominous|\bdrone\b/],
  ['glitch', /glitch|cyber|robot|digital|\bhud\b|interface|\bdata\b/],
  ['ui', /\b(click|button|pop|tap|switch|notification|beep)s?\b/],
  ['camera', /camera|shutter|projector|\bfilm\b/],
  ['fire', /\bfire\b|flame|crackl|burning/],
  ['water', /water|river|rain|\bwaves?\b|splash|ocean|drip|stream/],
  ['wind', /\bwind\b|storm|thunder|breeze/],
  ['nature', /\bbirds?\b|forest|jungle|animal|insect|cricket|\bfrog\b|\bowl\b|wolf/],
  ['vehicle', /\btrain\b|subway|\bcar\b|engine|plane|helicopter/],
  ['alarm', /alarm|siren|alert/],
  ['clock', /clock|\btick\b|tock|stopwatch/],
  ['money', /\bcoins?\b|\bcash\b|money|register|ka ching/],
  ['crowd', /crowd|cheer|applause|\bclap|audience/],
  ['laugh', /laugh|giggle|haha/],
  ['meme', /memes?|\bfail\b|\bvine\b|\bwow\b|\boof\b|bruh|anime|\bfah+\b|funny|awkward|airhorn|record scratch|sad violin|anvil/],
  ['weapon', /\bgun\b|\bshot\b|rifle|pistol|ak47|sniper|\brpg\b|rocket|\bsmg\b|shotgun|machinegun|explosion|\bbomb\b|\bblast|luger|9mm|\bm16|\bm14|\baug\b|famas|\bp90\b|desert eagle|\buzi\b|mac11|mp5/],
  ['slowmo', /slow ?mo/],
  ['transition', /transition/],
  ['heartbeat', /heart ?beat/],
  ['footsteps', /footstep|\bsteps\b|walking/],
  ['scifi', /laser|sci ?fi|\bspace\b|futur/],
];
export const TAGS = RULES.map(r => r[0]);
export function tagsFor(rel) {
  const s = ' ' + rel.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const t = RULES.filter(([, re]) => re.test(s)).map(r => r[0]);
  return t.length ? t : ['misc'];
}

// ---- music analysis ----
export function analyze(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-t', '90', '-i', file, '-ac', '1', '-ar', '11025', '-f', 's16le', '-'], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 11025 * 4) return null;
  const b = r.stdout, n = b.length >> 1, HOP = 256, FR = 512;
  const rms = [], zcr = [];
  for (let f = 0; f + FR <= n; f += HOP) {
    let s = 0, z = 0, prev = b.readInt16LE(f * 2);
    for (let i = 0; i < FR; i++) {
      const v = b.readInt16LE((f + i) * 2);
      s += v * v; if ((v >= 0) !== (prev >= 0)) z++; prev = v;
    }
    rms.push(Math.sqrt(s / FR) / 32768); zcr.push(z / FR);
  }
  const m = a => a.reduce((x, y) => x + y, 0) / a.length;
  const er = m(rms), zr = m(zcr);
  const sd = Math.sqrt(m(rms.map(v => (v - er) ** 2)));
  const lg = rms.map(v => Math.log(v + 1e-4)), on = lg.map((v, i) => (i ? Math.max(0, v - lg[i - 1]) : 0));
  const fps = 11025 / HOP; let bpm = 0, best = 0;
  if (on.length > fps * 15) for (let lag = Math.round(fps * 60 / 180); lag <= Math.round(fps * 60 / 60); lag++) {
    let c = 0; for (let i = 0; i + lag < on.length; i++) c += on[i] * on[i + lag];
    c /= on.length - lag; if (c > best) { best = c; bpm = 60 * fps / lag; }
  }
  while (bpm && bpm < 70) bpm *= 2; while (bpm > 160) bpm /= 2;
  return { e: 20 * Math.log10(er + 1e-6), z: zr, dyn: sd / (er + 1e-6), bpm: Math.round(bpm) };
}

// prototypes in (energy, brightness, tempo, dynamics) rank space, each 0..1
export const MOODS = {
  calm: [.15, .4, .2, .3], hopeful: [.45, .7, .45, .45], epic: [.85, .5, .5, .8], tense: [.6, .3, .6, .6], dark: [.5, .1, .3, .5],
  sad: [.25, .2, .15, .5], energetic: [.8, .7, .85, .4], mysterious: [.3, .3, .3, .8], warm: [.35, .5, .3, .3], playful: [.6, .85, .8, .3],
};
const HINTS = [
  ['epic', /epic|trailer|cinematic|hero|battle|heroic|victory/], ['dark', /dark|horror|dread|evil|shadow|villain|doom/],
  ['sad', /\bsad|cry|tears|lonely|melanchol|sorrow/], ['energetic', /happy|joy|upbeat|party|dance|energ|drive|sport/],
  ['calm', /calm|peace|relax|ambient|sleep|zen|lofi|lo fi|chill|soft/], ['mysterious', /mystery|secret|ghost|magic|enigma/],
  ['hopeful', /hope|inspir|dream|light|sun|uplift/], ['warm', /warm|home|family|piano|nostalg/], ['playful', /fun|quirky|playful|comedy|cartoon/],
  ['tense', /tense|suspense|thriller|chase|action/],
];
export function assignMoods(list) {
  const ok = list.filter(Boolean), N = ok.length;
  const rank = k => { const s = ok.map(a => a[k]).sort((x, y) => x - y); return v => (N < 2 ? .5 : s.indexOf(v) / (N - 1)); };
  const rE = rank('e'), rZ = rank('z'), rT = rank('bpm'), rD = rank('dyn');
  return list.map(a => {
    if (!a) return null;
    const v = [rE(a.e), rZ(a.z), rT(a.bpm), rD(a.dyn)];
    const d = Object.entries(MOODS).map(([k, p]) => [k, p.reduce((s, x, i) => s + (x - v[i]) ** 2, 0)]).sort((x, y) => x[1] - y[1]);
    const out = [d[0][0]]; if (d[1][1] < d[0][1] * 1.25 + .02) out.push(d[1][0]);
    return { ...a, moods: out, rank: v.map(x => +x.toFixed(2)) };
  });
}
export const hintMood = rel => { const s = rel.toLowerCase().replace(/[_\-.]+/g, ' '); const h = HINTS.find(([, re]) => re.test(s)); return h ? h[0] : null; };
export function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
