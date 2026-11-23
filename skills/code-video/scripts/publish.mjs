#!/usr/bin/env node
// Publishes a rendered video. Where it goes depends on the video:
//   REEL  (vertical AND 3 minutes or shorter): YouTube Shorts + Instagram Reels, both through Buffer (as before).
//   LONG  (landscape, or longer than 3 minutes): YouTube through the YouTube Data API v3 ONLY (never Buffer),
//         Instagram through Buffer as before (no public Buffer YouTube post is made for it).
// Buffer's API has no file upload (it only takes a public URL), so for Buffer the MP4 is first put on a temporary public host:
//   1) Uguu (uguu.se): free, no account or key, files are deleted after a few hours (default)
//   2) Cloudinary: used instead if Uguu fails and CLOUDINARY_URL is set (cloudinary://KEY:SECRET@CLOUD_NAME)
// Usage: node publish.mjs <reel-name> <video.mp4>
// Env:   BUFFER_API_KEY (Buffer > Settings > API)
//        YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (YouTube Data API v3, scope youtube.upload): used for LONG videos
//        optional: BUFFER_CHANNEL_ID (YouTube; else the first YouTube channel found), BUFFER_YOUTUBE_PRIVACY (public|unlisted|private, default public),
//                  YT_PRIVACY (privacy of API uploads, default = BUFFER_YOUTUBE_PRIVACY),
//                  BUFFER_YOUTUBE_CATEGORY (YouTube category id, default 24 = Entertainment), BUFFER_DELAY_SECONDS (default 60),
//                  BUFFER_INSTAGRAM_CHANNEL_ID (Instagram; else the first Instagram channel found), BUFFER_INSTAGRAM=off (skip Instagram),
//                  BUFFER_THUMBNAIL_OFFSET_MS (video frame used as the thumbnail, in milliseconds, default 2000 = the frame at 2 seconds),
//                  UGUU_UPLOAD_URL (default https://uguu.se/upload)
// Optional reels/<name>/post.json: {"title": "...", "description": "...", "instagram": "...", "thumbnailOffset": 2000}; otherwise the title comes from the folder name.
//   "instagram" is the Reels caption (falls back to description/title, without #Shorts).
//   "thumbnailOffset" (ms) overrides BUFFER_THUMBNAIL_OFFSET_MS for this reel.
// Thumbnail = the video frame at thumbMs (default 2 s):
//   Instagram: sent as the video's metadata.thumbnailOffset (Buffer supports a frame offset on Instagram, TikTok and Pinterest).
//   YouTube via Buffer: ffmpeg cuts that frame to a JPG, it is hosted publicly, and sent as the video's thumbnailUrl (retried without it if rejected).
//   YouTube via the API: the JPG is set with thumbnails.set (best effort; YouTube only allows it on verified channels).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [name, file] = process.argv.slice(2);
const BUFFER = process.env.BUFFER_API_KEY, CLD = process.env.CLOUDINARY_URL;
const YT_ID = (process.env.YT_CLIENT_ID || '').trim(), YT_SECRET = (process.env.YT_CLIENT_SECRET || '').trim(), YT_REFRESH = (process.env.YT_REFRESH_TOKEN || '').trim();
if (!name || !file) { console.error('usage: publish.mjs <reel-name> <video.mp4>'); process.exit(1); }
if (!fs.existsSync(file)) { console.error(`${file} not found`); process.exit(1); }

const privacy = process.env.BUFFER_YOUTUBE_PRIVACY || 'public';
if (!/^[a-z]+$/.test(privacy)) { console.error('BUFFER_YOUTUBE_PRIVACY must be public, unlisted or private'); process.exit(1); }
const ytPrivacy = process.env.YT_PRIVACY || privacy;
if (!/^[a-z]+$/.test(ytPrivacy)) { console.error('YT_PRIVACY must be public, unlisted or private'); process.exit(1); }
const category = process.env.BUFFER_YOUTUBE_CATEGORY || '24';
const delay = +(process.env.BUFFER_DELAY_SECONDS || 60);
const wantIG = (process.env.BUFFER_INSTAGRAM || 'on').toLowerCase() !== 'off';

// what kind of video is it? LONG = landscape or longer than 3 minutes (YouTube Shorts must be vertical and at most 3 minutes)
let vw = 0, vh = 0, vdur = 0;
try {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'json', file]).toString());
  vw = +(j.streams?.[0]?.width || 0); vh = +(j.streams?.[0]?.height || 0); vdur = +(j.format?.duration || 0);
} catch (e) { console.error(`ffprobe failed (${e.message}); treating the video as a reel`); }
const isLong = (vw > 0 && vw > vh) || vdur > 180;
console.log(`video ${vw}x${vh}, ${vdur.toFixed(1)} s -> ${isLong ? 'LONG: YouTube by API only, Instagram by Buffer' : 'REEL: YouTube + Instagram by Buffer'}`);

// title / description
let post = {};
const pj = path.join(path.dirname(file), 'post.json');
if (fs.existsSync(pj)) post = JSON.parse(fs.readFileSync(pj, 'utf8'));
const title = (post.title || name.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).slice(0, 100);
let text = post.description || title;
const ytText = text; // API (long) uploads: no #Shorts
if (!/#shorts/i.test(text)) text += '\n\n#Shorts';
// Instagram caption (max 2200 chars), no #Shorts
const igText = (post.instagram || post.description || title).slice(0, 2200);
// thumbnail = the video frame at this many milliseconds (default 2000 = 2 seconds in)
const thumbRaw = post.thumbnailOffset ?? process.env.BUFFER_THUMBNAIL_OFFSET_MS ?? 2000;
const thumbMs = Number.isFinite(+thumbRaw) && +thumbRaw >= 0 ? Math.round(+thumbRaw) : 2000;

let failed = false;

// thumbnail JPG = the frame at thumbMs (local file)
let thumbPath = null;
try {
  const tp = path.join(path.dirname(path.resolve(file)), `${name}-thumb.jpg`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', (thumbMs / 1000).toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '2', tp]);
  if (fs.existsSync(tp) && fs.statSync(tp).size > 0) thumbPath = tp;
} catch (e) { console.error(`thumbnail image skipped: ${e.message}`); }

// ---- YouTube Data API v3 (long videos) ----
async function youtubeApi() {
  if (!YT_ID || !YT_SECRET || !YT_REFRESH) throw new Error('YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN are not all set');
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: YT_ID, client_secret: YT_SECRET, refresh_token: YT_REFRESH, grant_type: 'refresh_token' }),
  });
  const tok = await tr.json().catch(() => ({}));
  if (!tok.access_token) throw new Error(`token refresh failed: ${tok.error || tr.status} ${tok.error_description || ''}`.trim());
  const auth = { Authorization: `Bearer ${tok.access_token}` };
  const size = fs.statSync(file).size;
  const meta = { snippet: { title, description: ytText, categoryId: category }, status: { privacyStatus: ytPrivacy, selfDeclaredMadeForKids: false } };
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(meta),
  });
  const loc = init.headers.get('location');
  if (!init.ok || !loc) throw new Error(`upload start failed: ${init.status} ${(await init.text()).slice(0, 300)}`);
  let res = null, last = '';
  for (let i = 1; i <= 3 && !res; i++) {
    try {
      const r = await fetch(loc, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: await fs.openAsBlob(file, { type: 'video/mp4' }) });
      const t = await r.text();
      if (r.ok) res = JSON.parse(t);
      else { last = `${r.status} ${t.slice(0, 300)}`; if (r.status < 500) break; }
    } catch (e) { last = e.message; }
    if (!res) { console.error(`YouTube upload try ${i} failed: ${last}`); await new Promise(r => setTimeout(r, 5000 * i)); }
  }
  if (!res?.id) throw new Error(`upload failed: ${last}`);
  console.log(`uploaded to YouTube by API (${ytPrivacy}): https://youtu.be/${res.id}`);
  if (thumbPath) {
    try {
      const tr2 = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${res.id}&uploadType=media`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'image/jpeg' }, body: fs.readFileSync(thumbPath),
      });
      if (tr2.ok) console.log(`thumbnail set (frame at ${thumbMs} ms)`);
      else console.error(`thumbnail not set: ${tr2.status} ${(await tr2.text()).slice(0, 160)}`);
    } catch (e) { console.error(`thumbnail not set: ${e.message}`); }
  }
}

if (isLong) {
  try { await youtubeApi(); }
  catch (e) { console.error(`YouTube (API) failed: ${e.message}`); failed = true; }
}

// ---- Buffer: Instagram always (when wanted), YouTube only for reels ----
const needBuffer = (wantIG || !isLong);
if (needBuffer && !BUFFER) {
  console.error('BUFFER_API_KEY is not set: Buffer posts skipped');
  if (!isLong) failed = true;
} else if (needBuffer) {
  // 1) host the video at a public URL
  async function hostUguu(fp, fname, mime) {
    const size = fs.statSync(fp).size;
    if (size > 128 * 1024 * 1024) throw new Error(`file is ${(size / 1048576).toFixed(0)} MB, over Uguu's 128 MB limit`);
    const urls = process.env.UGUU_UPLOAD_URL ? [process.env.UGUU_UPLOAD_URL] : ['https://uguu.se/upload', 'https://uguu.se/upload.php'];
    let last = '';
    for (const u of urls) {
      const fd = new FormData();
      fd.append('files[]', await fs.openAsBlob(fp, { type: mime }), fname);
      try {
        const r = await fetch(u, { method: 'POST', body: fd });
        const t = await r.text();
        let j = null; try { j = JSON.parse(t); } catch {}
        const url = j?.files?.[0]?.url;
        if (r.ok && url) return url;
        last = `${u} -> ${r.status} ${t.slice(0, 200)}`;
      } catch (e) { last = `${u} -> ${e.message}`; }
    }
    throw new Error(last);
  }

  async function hostCloudinary() {
    const cu = new URL(CLD);
    const ts = Math.floor(Date.now() / 1000), publicId = `reels/${name}-${ts}`;
    const signature = crypto.createHash('sha1').update(`public_id=${publicId}&timestamp=${ts}${cu.password}`).digest('hex');
    const fd = new FormData();
    fd.append('file', await fs.openAsBlob(file), 'video.mp4');
    fd.append('api_key', cu.username); fd.append('timestamp', String(ts)); fd.append('public_id', publicId); fd.append('signature', signature);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cu.hostname}/video/upload`, { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.secure_url) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    return j.secure_url;
  }

  const hosts = [['Uguu', () => hostUguu(file, `${name}.mp4`, 'video/mp4')]];
  if (CLD) hosts.push(['Cloudinary', hostCloudinary]);
  let videoUrl = null;
  for (const [label, fn] of hosts) {
    try { console.log(`uploading video to ${label}...`); videoUrl = await fn(); break; }
    catch (e) { console.error(`${label} upload failed: ${e.message}`); }
  }
  if (!videoUrl) { console.error('could not host the video anywhere: Buffer posts skipped'); failed = true; }
  else {
    console.log('hosted at', videoUrl);

    // 1b) thumbnail image hosted publicly so Buffer can fetch it (YouTube via Buffer = reels only)
    let thumbUrl = null;
    if (!isLong && thumbPath) {
      try { thumbUrl = await hostUguu(thumbPath, `${name}-thumb.jpg`, 'image/jpeg'); console.log(`thumbnail frame at ${thumbMs} ms hosted at`, thumbUrl); }
      catch (e) { console.error(`thumbnail image skipped: ${e.message}`); }
    }

    // 2) Buffer GraphQL helper
    async function gql(query) {
      const r = await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER}` }, body: JSON.stringify({ query }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.errors) throw new Error(`Buffer API ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 400)}`);
      return j.data;
    }

    // 3) find the channels (YouTube only for reels)
    let channelId = isLong ? null : process.env.BUFFER_CHANNEL_ID;
    let igChannelId = wantIG ? process.env.BUFFER_INSTAGRAM_CHANNEL_ID : null;
    if ((!isLong && !channelId) || (wantIG && !igChannelId)) {
      const orgs = (await gql('query { account { organizations { id name } } }')).account.organizations;
      const svc = c => String(c.service).toLowerCase();
      for (const o of orgs) {
        const chans = (await gql(`query { channels(input: { organizationId: ${JSON.stringify(o.id)} }) { id name service } }`)).channels;
        if (!isLong && !channelId) {
          const yt = chans.find(c => svc(c) === 'youtube');
          if (yt) { channelId = yt.id; console.log(`using YouTube channel "${yt.name}"`); }
        }
        if (wantIG && !igChannelId) {
          const ig = chans.find(c => svc(c) === 'instagram');
          if (ig) { igChannelId = ig.id; console.log(`using Instagram channel "${ig.name}"`); }
        }
        if ((isLong || channelId) && (!wantIG || igChannelId)) break;
      }
    }
    if (!isLong && !channelId) { console.error('no YouTube channel connected in Buffer (or set BUFFER_CHANNEL_ID)'); failed = true; }
    if (wantIG && !igChannelId) console.error('no Instagram channel connected in Buffer (or set BUFFER_INSTAGRAM_CHANNEL_ID): skipping Instagram');

    // 4) schedule a post `delay` seconds from now (computed after the upload, so it's always in the future)
    // assetMeta (optional) goes inside the video asset (thumbnail settings). If Buffer rejects it, the post is retried without it.
    async function schedulePost(label, chId, caption, metadata, assetMeta = '') {
      const send = async (am) => {
        const dueAt = new Date(Date.now() + delay * 1000).toISOString();
        const data = await gql(`mutation {
  createPost(input: {
    text: ${JSON.stringify(caption)}
    channelId: ${JSON.stringify(chId)}
    schedulingType: automatic
    mode: customScheduled
    dueAt: ${JSON.stringify(dueAt)}
    metadata: { ${metadata} }
    assets: [ { video: { url: ${JSON.stringify(videoUrl)}${am ? `, ${am}` : ''} } } ]
  }) {
    ... on PostActionSuccess { post { id } }
    ... on MutationError { message }
  }
}`);
        const res = data.createPost;
        if (res.message) throw new Error(res.message);
        console.log(`scheduled on ${label} for ${dueAt} (Buffer post ${res.post.id})${am ? ' with thumbnail' : ''}`);
      };
      try { await send(assetMeta); }
      catch (e) {
        if (assetMeta) {
          console.error(`${label} with thumbnail failed (${e.message}); retrying without the thumbnail`);
          try { await send(''); return; } catch (e2) { e = e2; }
        }
        console.error(`${label} failed: ${e.message}`); failed = true;
      }
    }

    // YouTube Shorts (reels only): thumbnail = JPG of the frame at thumbMs
    if (!isLong && channelId) {
      await schedulePost('YouTube', channelId, text,
        `youtube: { title: ${JSON.stringify(title)}, categoryId: ${JSON.stringify(category)}, privacy: ${privacy} }`,
        thumbUrl ? `thumbnailUrl: ${JSON.stringify(thumbUrl)}` : '');
    }
    // Instagram Reels (a separate post, so an Instagram problem never blocks YouTube): thumbnail = frame at thumbMs
    if (wantIG && igChannelId) {
      console.log(`Instagram thumbnail frame: ${thumbMs} ms`);
      await schedulePost('Instagram Reels', igChannelId, igText,
        'instagram: { type: reel, shouldShareToFeed: true }',
        `metadata: { thumbnailOffset: ${thumbMs} }`);
    }
  }
}
if (failed) process.exit(1);
