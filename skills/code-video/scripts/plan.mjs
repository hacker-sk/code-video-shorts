// Plans the sound for a reel from its script, so every reel gets suitable effects and music without a hand-written audio.json.
//   autoPlan({ lines, starts, total, lib, reel, au }) -> { sfx: [...cues], bgm: [...segments], log: [...] }
// - music: every line is scored for mood (calm, hopeful, epic, tense, dark, sad, energetic, mysterious, warm, playful),
//   neighbouring lines are smoothed into sections, and each section gets its own track of that mood (no track repeats).
// - effects: whooshes where the story turns, hits on numbers and shocks, risers before questions, subdrops on danger,
//   ambience (fire, water, wind...) when mentioned, and so on. Spaced out, never the same file twice, no weapon sounds.
// Deterministic: the same reel always gets the same plan.
import crypto from 'node:crypto';

const hash = s => crypto.createHash('md5').update(String(s)).digest().readUInt32BE(0);

const MOOD_WORDS = {
  calm: /\b(quiet|calm|peace\w*|gentle|gently|slowly|morning|sunlight|sunrise|rest|relax\w*|silence|steady|breath\w*|sleep\w*|wakes?|dawn|afternoon|sat|sit\w*)\b/gi,
  hopeful: /\b(hope\w*|dream\w*|free|freedom|enjoy\w*|beaut\w+|music|art|love|safe|imagine\w*|belong\w*|joy|better|future|ask yourself)\b/gi,
  epic: /\b(years|ancient|history|civili[sz]ation\w*|empire|world|legend\w*|massive|millions?|billions?|thousands?|rewind|began|begin|cities|city|humans?|centuries)\b/gi,
  tense: /\b(but|however|suddenly|danger\w*|threat\w*|disease|injury|hunger|risk\w*|warning|chase|alarm|scream\w*|deadline|exhausted|overheats|real threats)\b/gi,
  dark: /\b(death|dark|fear\w*|miserable|harder|poor|slave\w*|labou?r|taxes|trapped|stole|worse|cavities|damage|strain|suffer\w*)\b/gi,
  sad: /\b(lost|alone|miss|regret|tragic|grief|cry|sorrow|retirement|waiting|postpone\w*)\b/gi,
  energetic: /\b(run|race|fast|win|success|rush|hustle|boom|explode|sprint|hunt|hunts)\b/gi,
  mysterious: /\b(secret|mystery|unknown|strange|ancestors|spirits|night|stars|myth|discover\w*|researchers?|evidence|archaeolog\w+|cave|impossible|stories)\b/gi,
  playful: /\b(joke\w*|funny|laugh\w*|play\w*|game|fun)\b/gi,
  warm: /\b(fire|home|family|together|friends?|community|children|shared|campfire|relationships?)\b/gi,
};
export const MOOD_LIST = Object.keys(MOOD_WORDS);

// sound effect kinds: which tag, how loud, how long, and whether it is ambience (no spacing rule)
const KINDS = {
  whoosh: { tag: 'whoosh', vol: .34, min: .3, max: 2.6, cap: 2.4 },
  hit: { tag: 'hit', vol: .44, min: .3, max: 4, cap: 3 },
  riser: { tag: 'riser', vol: .32, min: 1.5, max: 9, cap: 4 },
  subdrop: { tag: 'subdrop', vol: .48, min: .5, max: 5, cap: 3.5 },
  bell: { tag: 'bell', vol: .38, min: .5, max: 6, cap: 3.5 },
  tension: { tag: 'tension', vol: .3, min: 1, max: 9, cap: 5 },
  glitch: { tag: 'glitch', vol: .32, min: .2, max: 3, cap: 2 },
  camera: { tag: 'camera', vol: .4, min: .2, max: 3, cap: 2 },
  alarm: { tag: 'alarm', vol: .38, min: .5, max: 6, cap: 3 },
  clock: { tag: 'clock', vol: .32, min: .3, max: 6, cap: 3 },
  money: { tag: 'money', vol: .4, min: .2, max: 4, cap: 2.5 },
  crowd: { tag: 'crowd', vol: .3, min: 1, max: 10, cap: 4 },
  laugh: { tag: 'laugh', vol: .4, min: .3, max: 5, cap: 3 },
  heartbeat: { tag: 'heartbeat', vol: .4, min: 1, max: 8, cap: 4 },
  footsteps: { tag: 'footsteps', vol: .3, min: 1, max: 8, cap: 4 },
  fire: { tag: 'fire', vol: .2, min: 2, max: 40, cap: 7, amb: 1 },
  water: { tag: 'water', vol: .2, min: 2, max: 40, cap: 7, amb: 1 },
  wind: { tag: 'wind', vol: .2, min: 2, max: 40, cap: 7, amb: 1 },
  nature: { tag: 'nature', vol: .2, min: 2, max: 40, cap: 7, amb: 1 },
};
// [pattern, kind, priority]: a match in a line schedules that kind at the matching word
const TRIG = [
  [/\b(alarm|siren|buzzer)\b/i, 'alarm', 8],
  [/\b(suddenly|shock\w*|surpris\w*|unexpected\w*|stole|crash\w*|bang|explod\w*)\b/i, 'hit', 7],
  [/\b\d[\d,.]*\s?(years?|hours?|days?|percent|%|million|billion|thousand)\b|\b(million|billion|thousand)s?\b/i, 'hit', 6],
  [/\b(danger\w*|threat\w*|death|dead|disease|fear\w*|horror|deadly|dark|afraid|hunger|injury)\b/i, 'tension', 6],
  [/\b(camera|photograph\w*|film)\b/i, 'camera', 5],
  [/\b(money|coins?|cash|rich|salary|taxes|wage\w*|paid)\b/i, 'money', 5],
  [/\b(laugh\w*|joke\w*|funny|hilarious)\b/i, 'laugh', 5],
  [/\b(glitch|hack\w*|digital|computer|smartphones?|phone|internet|robot\w*)\b/i, 'glitch', 5],
  [/\b(secret|mystery|mysterious|unknown|ancestors?|spirits?|magic|impossible)\b/i, 'bell', 5],
  [/\b(crowd|cheer\w*|applause|celebrat\w+)\b/i, 'crowd', 4],
  [/\b(heartbeat)\b/i, 'heartbeat', 4],
  [/\b(fire|flames?|campfire|burning)\b/i, 'fire', 4],
  [/\b(water|river|rain|ocean|sea|lake|waves?)\b/i, 'water', 4],
  [/\b(wind|storm|thunder)\b/i, 'wind', 4],
  [/\b(footsteps?|walking)\b/i, 'footsteps', 3],
  [/\b(birds?|forest|jungle|wolf|owl)\b/i, 'nature', 3],
  [/\b(clock|ticking|deadline|minutes?)\b/i, 'clock', 3],
  [/\b(first|last|only|biggest|greatest|truth|never)\b/i, 'hit', 3],
];
const TURN = /^["'\s]*(?:(?:now|then|but|and then|so|eventually|little by little|of course|tomorrow|today|around|at first|yet|meanwhile|after|before|finally|and today|and tonight)\b|in the \d)/i;

// picks a music track for a mood: prefers tracks of that mood, not used yet in this reel, and long enough
export function pickBgm(bgm, mood, seed, used, wantLen) {
  if (!bgm || !bgm.length) return null;
  let c = bgm.filter(b => !b.skip && b.m && b.m.includes(mood));
  const prim = c.filter(b => b.m[0] === mood); if (prim.length >= 2) c = prim;
  if (!c.length) c = bgm.filter(b => !b.skip);
  if (!c.length) return null;
  const fresh = c.filter(b => !used.has(b.p)); if (fresh.length) c = fresh;
  const long = c.filter(b => !b.d || b.d >= Math.min(wantLen || 0, 45)); if (long.length) c = long;
  const b = c[hash(`${seed}:${mood}:${used.size}`) % c.length];
  used.add(b.p); return b;
}

export function autoPlan({ lines, starts, total, lib, reel, au = {} }) {
  const log = [], A = typeof au.auto === 'object' && au.auto ? au.auto : {};
  const wantSfx = A.sfx !== false && !(au.sfx && au.sfx.length), wantBgm = A.bgm !== false && !au.bgm;
  const N = lines ? lines.length : 0, ok = !!(N && starts && starts.length >= N);
  const end = i => (starts[i + 1] != null ? starts[i + 1] : total), dur = i => Math.max(.3, end(i) - starts[i]);
  const out = { sfx: [], bgm: [], log };
  const firstMood = au.mood ? [].concat(au.mood)[0] : 'calm';

  // ---------- music ----------
  if (wantBgm && lib.bgm.length) {
    const used = new Set();
    let segs = [];
    if (ok) {
      const bias = au.mood ? [].concat(au.mood) : [];
      const sc = lines.map(t => { const o = {}; for (const [m, re] of Object.entries(MOOD_WORDS)) o[m] = (String(t).match(re) || []).length; o.calm += .3; bias.forEach(b => { if (o[b] != null) o[b] += .6; }); return o; });
      const mood = sc.map((o, i) => { let best = 'calm', bv = -1; for (const m of MOOD_LIST) { const v = o[m] + .5 * ((sc[i - 1] && sc[i - 1][m]) || 0) + .5 * ((sc[i + 1] && sc[i + 1][m]) || 0); if (v > bv + 1e-9) { bv = v; best = m; } } return best; });
      mood.forEach((m, i) => { const l = segs[segs.length - 1]; if (l && l.mood === m) l.to = end(i); else segs.push({ mood: m, from: i ? starts[i] : 0, to: end(i) }); });
      // merge short sections into a neighbour, then split very long ones
      for (let guard = 0; guard < 80; guard++) {
        const k = segs.findIndex(s => s.to - s.from < 14 && segs.length > 1); if (k < 0) break;
        const nb = k === 0 ? 1 : k === segs.length - 1 ? k - 1 : (segs[k - 1].to - segs[k - 1].from >= segs[k + 1].to - segs[k + 1].from ? k - 1 : k + 1);
        const a = Math.min(k, nb), b = Math.max(k, nb);
        segs.splice(a, 2, { mood: segs[nb].mood, from: segs[a].from, to: segs[b].to });
      }
      segs = segs.flatMap(s => { const len = s.to - s.from, n = Math.ceil(len / 75); return n < 2 ? [s] : Array.from({ length: n }, (_, j) => ({ mood: s.mood, from: s.from + len * j / n, to: s.from + len * (j + 1) / n })); });
    } else segs = [{ mood: firstMood, from: 0, to: total }];
    for (const s of segs) {
      const b = pickBgm(lib.bgm, s.mood, reel, used, s.to - s.from);
      if (!b) continue;
      out.bgm.push({ sound: b.p, from: +s.from.toFixed(2), to: +s.to.toFixed(2) });
      log.push(`music ${s.from.toFixed(0)}-${s.to.toFixed(0)}s [${s.mood}] <- ${b.p}${b.m ? ' (' + b.m.join('/') + (b.bpm ? ', ~' + b.bpm + ' bpm' : '') + ')' : ''}`);
    }
  }

  // ---------- effects ----------
  if (wantSfx && lib.sfx.length) {
    const dens = ({ low: 5, normal: 3.4, high: 2.3 })[au.density || A.density || 'normal'] || 3.4;
    const cand = [];
    const add = (kind, at, pr, why, lead) => { if ((at == null || (at >= 0 && at < total - .3))) cand.push({ kind, at, pr, why, lead }); };
    if (ok) {
      add('riser', .05, 9, 'hook');
      lines.forEach((t, i) => {
        const s = starts[i], d = dur(i), txt = String(t);
        if (TURN.test(txt) && i > 0) add('whoosh', Math.max(0, s - .12), 5, 'story turn');
        if ((/[?]["'\s]*$/.test(txt) || /:["'\s]*$/.test(txt)) && i < N - 1) add('riser', null, 4, 'setup', i);
        for (const [re, kind, pr] of TRIG) {
          const m = re.exec(txt); if (!m) continue;
          const K = KINDS[kind], at = K.amb ? s : s + Math.min(d * .9, d * (m.index / Math.max(1, txt.length)));
          add(kind, at, pr, `"${m[0]}"`);
        }
      });
      out.bgm.slice(1).forEach(b => { if (b.from > 0) add('whoosh', Math.max(0, b.from - .1), 7, 'music change'); });
      const last = N - 1, q = /[?]["'\s]*$/.test(String(lines[last]));
      add(q ? 'bell' : 'hit', Math.max(0, starts[last] + dur(last) * .78), 8, 'ending');
    } else for (let t = 12; t < total - 4; t += 12) add('whoosh', t, 5, 'every 12 s');
    // lead-in risers end where the next line starts
    cand.forEach(c => { if (c.at == null) { const K = KINDS[c.kind], d = Math.min(K.cap, dur(c.lead)); c.at = Math.max(starts[c.lead], end(c.lead) - d); c.why += ` (before line ${c.lead + 1})`; } });
    cand.sort((a, b) => b.pr - a.pr || a.at - b.at);
    const cap = Math.ceil(total / (dens * 1.15)), pick = [];
    for (const c of cand) {
      const amb = KINDS[c.kind].amb;
      if (!amb && pick.filter(p => !KINDS[p.kind].amb).length >= cap) continue;
      const near = pick.some(p => (amb || KINDS[p.kind].amb) ? (p.kind === c.kind && Math.abs(p.at - c.at) < 20) : Math.abs(p.at - c.at) < dens);
      if (!near) pick.push(c);
    }
    pick.sort((a, b) => a.at - b.at);
    const recent = {}, usedFiles = new Set();
    pick.forEach((c, n) => {
      const K = KINDS[c.kind];
      const okTag = s => !s.skip && s.t && s.t.includes(K.tag) && !s.t.includes('weapon');
      let pool = lib.sfx.filter(s => okTag(s) && (s.d == null || (s.d >= K.min && s.d <= K.max)));
      if (!pool.length) pool = lib.sfx.filter(okTag);
      if (!pool.length) return;
      const fresh = pool.filter(s => !usedFiles.has(s.p) && !(recent[c.kind] || []).includes(s.p)); if (fresh.length) pool = fresh;
      const s = pool[hash(`${reel}:${n}:${c.kind}`) % pool.length];
      usedFiles.add(s.p); (recent[c.kind] = recent[c.kind] || []).push(s.p); if (recent[c.kind].length > 4) recent[c.kind].shift();
      const jit = .92 + (hash(`${reel}:v${n}`) % 17) / 100;
      out.sfx.push({ at: +c.at.toFixed(2), sound: s.p, volume: +(K.vol * jit * (au.sfxVolume != null ? au.sfxVolume : 1)).toFixed(3), dur: K.cap });
      log.push(`sfx ${c.at.toFixed(1)}s ${c.kind} (${c.why}) <- ${s.p}`);
    });
  }
  return out;
}
