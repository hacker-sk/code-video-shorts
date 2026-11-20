#!/usr/bin/env node
// Publishes a rendered reel to YouTube Shorts AND Instagram Reels through Buffer, scheduled 1 minute from now.
// Buffer's API has no file upload (it only takes a public URL), so the MP4 is first put on a temporary public host:
//   1) Uguu (uguu.se): free, no account or key, files are deleted after a few hours (default)
//   2) Cloudinary: used instead if Uguu fails and CLOUDINARY_URL is set (cloudinary://KEY:SECRET@CLOUD_NAME)
// Usage: node publish.mjs <reel-name> <video.mp4>
// Env:   BUFFER_API_KEY (Buffer > Settings > API)
//        optional: BUFFER_CHANNEL_ID (YouTube; else the first YouTube channel found), BUFFER_YOUTUBE_PRIVACY (public|unlisted|private, default public),
//                  BUFFER_YOUTUBE_CATEGORY (YouTube category id, default 24 = Entertainment), BUFFER_DELAY_SECONDS (default 60),
//                  BUFFER_INSTAGRAM_CHANNEL_ID (Instagram; else the first Instagram channel found), BUFFER_INSTAGRAM=off (skip Instagram),
//                  BUFFER_THUMBNAIL_OFFSET_MS (video frame used as the thumbnail, in milliseconds, default 2000 = the frame at 2 seconds),
//                  UGUU_UPLOAD_URL (default https://uguu.se/upload)
// Optional reels/<name>/post.json: {"title": "...", "description": "...", "instagram": "...", "thumbnailOffset": 2000}; otherwise the title comes from the folder name.
//   "instagram" is the Reels caption (falls back to description/title, without #Shorts).
//   "thumbnailOffset" (ms) overrides BUFFER_THUMBNAIL_OFFSET_MS for this reel.
// Thumbnail = the video frame at thumbMs (default 2 s):
//   Instagram: sent as the video's metadata.thumbnailOffset (Buffer supports a frame offset on Instagram, TikTok and Pinterest).
//   YouTube:   ffmpeg cuts that frame to a JPG, it is hosted publicly, and sent as the video's thumbnailUrl.
//              If Buffer rejects it, the post is retried automatically without the thumbnail.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [name, file] = process.argv.slice(2);
const BUFFER = process.env.BUFFER_API_KEY, CLD = process.env.CLOUDINARY_URL;
if (!name || !file) { console.error('usage: publish.mjs <reel-name> <video.mp4>'); process.exit(1); }
if (!BUFFER) { console.error('BUFFER_API_KEY is not set'); process.exit(1); }
if (!fs.existsSync(file)) { console.error(`${file} not found`); process.exit(1); }

const privacy = process.env.BUFFER_YOUTUBE_PRIVACY || 'public';
if (!/^[a-z]+$/.test(privacy)) { console.error('BUFFER_YOUTUBE_PRIVACY must be public, unlisted or private'); process.exit(1); }
const category = process.env.BUFFER_YOUTUBE_CATEGORY || '24';
const delay = +(process.env.BUFFER_DELAY_SECONDS || 60);
const wantIG = (process.env.BUFFER_INSTAGRAM || 'on').toLowerCase() !== 'off';

// title / description
let post = {};
const pj = path.join(path.dirname(file), 'post.json');
if (fs.existsSync(pj)) post = JSON.parse(fs.readFileSync(pj, 'utf8'));
const title = (post.title || name.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).slice(0, 100);
let text = post.description || title;
if (!/#shorts/i.test(text)) text += '\n\n#Shorts';
// Instagram caption (max 2200 chars), no #Shorts
const igText = (post.instagram || post.description || title).slice(0, 2200);
// thumbnail = the video frame at this many milliseconds (default 2000 = 2 seconds in)
const thumbRaw = post.thumbnailOffset ?? process.env.BUFFER_THUMBNAIL_OFFSET_MS ?? 2000;
const thumbMs = Number.isFinite(+thumbRaw) && +thumbRaw >= 0 ? Math.round(+thumbRaw) : 2000;

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
if (!videoUrl) { console.error('could not host the video anywhere'); process.exit(1); }
console.log('hosted at', videoUrl);

// 1b) thumbnail image = the frame at thumbMs, hosted publicly so Buffer can fetch it (used for YouTube)
let thumbUrl = null;
try {
  const tp = path.join(path.dirname(path.resolve(file)), `${name}-thumb.jpg`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', (thumbMs / 1000).toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '2', tp]);
  if (fs.existsSync(tp) && fs.statSync(tp).size > 0) {
    thumbUrl = await hostUguu(tp, `${name}-thumb.jpg`, 'image/jpeg');
    console.log(`thumbnail frame at ${thumbMs} ms hosted at`, thumbUrl);
  }
} catch (e) { console.error(`thumbnail image skipped: ${e.message}`); }

// 2) Buffer GraphQL helper
async function gql(query) {
  const r = await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER}` }, body: JSON.stringify({ query }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error(`Buffer API ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 400)}`);
  return j.data;
}

// 3) find the YouTube + Instagram channels
let failed = false;
let channelId = process.env.BUFFER_CHANNEL_ID;
let igChannelId = wantIG ? process.env.BUFFER_INSTAGRAM_CHANNEL_ID : null;
if (!channelId || (wantIG && !igChannelId)) {
  const orgs = (await gql('query { account { organizations { id name } } }')).account.organizations;
  const svc = c => String(c.service).toLowerCase();
  for (const o of orgs) {
    const chans = (await gql(`query { channels(input: { organizationId: ${JSON.stringify(o.id)} }) { id name service } }`)).channels;
    if (!channelId) {
      const yt = chans.find(c => svc(c) === 'youtube');
      if (yt) { channelId = yt.id; console.log(`using YouTube channel "${yt.name}"`); }
    }
    if (wantIG && !igChannelId) {
      const ig = chans.find(c => svc(c) === 'instagram');
      if (ig) { igChannelId = ig.id; console.log(`using Instagram channel "${ig.name}"`); }
    }
    if (channelId && (!wantIG || igChannelId)) break;
  }
}
if (!channelId) { console.error('no YouTube channel connected in Buffer (or set BUFFER_CHANNEL_ID)'); failed = true; }
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

// YouTube Shorts: thumbnail = JPG of the frame at thumbMs
if (channelId) {
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
if (failed) process.exit(1);
