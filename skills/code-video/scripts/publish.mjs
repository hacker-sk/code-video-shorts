#!/usr/bin/env node
// Publishes a rendered reel to YouTube through Buffer, scheduled 1 minute from now.
// Buffer's API has no file upload (it only takes a public URL), so the MP4 is first put on a temporary public host:
//   1) Uguu (uguu.se): free, no account or key, files are deleted after a few hours (default)
//   2) Cloudinary: used instead if Uguu fails and CLOUDINARY_URL is set (cloudinary://KEY:SECRET@CLOUD_NAME)
// Usage: node publish.mjs <reel-name> <video.mp4>
// Env:   BUFFER_API_KEY (Buffer > Settings > API)
//        optional: BUFFER_CHANNEL_ID (else the first YouTube channel found), BUFFER_YOUTUBE_PRIVACY (public|unlisted|private, default public),
//                  BUFFER_YOUTUBE_CATEGORY (YouTube category id, default 24 = Entertainment), BUFFER_DELAY_SECONDS (default 60),
//                  UGUU_UPLOAD_URL (default https://uguu.se/upload)
// Optional reels/<name>/post.json: {"title": "...", "description": "..."}; otherwise the title comes from the folder name.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [name, file] = process.argv.slice(2);
const BUFFER = process.env.BUFFER_API_KEY, CLD = process.env.CLOUDINARY_URL;
if (!name || !file) { console.error('usage: publish.mjs <reel-name> <video.mp4>'); process.exit(1); }
if (!BUFFER) { console.error('BUFFER_API_KEY is not set'); process.exit(1); }
if (!fs.existsSync(file)) { console.error(`${file} not found`); process.exit(1); }

const privacy = process.env.BUFFER_YOUTUBE_PRIVACY || 'public';
if (!/^[a-z]+$/.test(privacy)) { console.error('BUFFER_YOUTUBE_PRIVACY must be public, unlisted or private'); process.exit(1); }
const category = process.env.BUFFER_YOUTUBE_CATEGORY || '24';
const delay = +(process.env.BUFFER_DELAY_SECONDS || 60);

// title / description
let post = {};
const pj = path.join(path.dirname(file), 'post.json');
if (fs.existsSync(pj)) post = JSON.parse(fs.readFileSync(pj, 'utf8'));
const title = (post.title || name.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).slice(0, 100);
let text = post.description || title;
if (!/#shorts/i.test(text)) text += '\n\n#Shorts';

// 1) host the video at a public URL
const size = fs.statSync(file).size;

async function hostUguu() {
  if (size > 128 * 1024 * 1024) throw new Error(`video is ${(size / 1048576).toFixed(0)} MB, over Uguu's 128 MB limit`);
  const urls = process.env.UGUU_UPLOAD_URL ? [process.env.UGUU_UPLOAD_URL] : ['https://uguu.se/upload', 'https://uguu.se/upload.php'];
  let last = '';
  for (const u of urls) {
    const fd = new FormData();
    fd.append('files[]', await fs.openAsBlob(file), `${name}.mp4`);
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

const hosts = [['Uguu', hostUguu]];
if (CLD) hosts.push(['Cloudinary', hostCloudinary]);
let videoUrl = null;
for (const [label, fn] of hosts) {
  try { console.log(`uploading video to ${label}...`); videoUrl = await fn(); break; }
  catch (e) { console.error(`${label} upload failed: ${e.message}`); }
}
if (!videoUrl) { console.error('could not host the video anywhere'); process.exit(1); }
console.log('hosted at', videoUrl);

// 2) Buffer GraphQL helper
async function gql(query) {
  const r = await fetch('https://api.buffer.com', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BUFFER}` }, body: JSON.stringify({ query }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error(`Buffer API ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 400)}`);
  return j.data;
}

// 3) find the YouTube channel
let channelId = process.env.BUFFER_CHANNEL_ID;
if (!channelId) {
  const orgs = (await gql('query { account { organizations { id name } } }')).account.organizations;
  for (const o of orgs) {
    const chans = (await gql(`query { channels(input: { organizationId: ${JSON.stringify(o.id)} }) { id name service } }`)).channels;
    const yt = chans.find(c => String(c.service).toLowerCase() === 'youtube');
    if (yt) { channelId = yt.id; console.log(`using YouTube channel "${yt.name}"`); break; }
  }
  if (!channelId) { console.error('no YouTube channel connected in Buffer (or set BUFFER_CHANNEL_ID)'); process.exit(1); }
}

// 4) schedule the post `delay` seconds from now (computed after the upload, so it's always in the future)
const dueAt = new Date(Date.now() + delay * 1000).toISOString();
const data = await gql(`mutation {
  createPost(input: {
    text: ${JSON.stringify(text)}
    channelId: ${JSON.stringify(channelId)}
    schedulingType: automatic
    mode: customScheduled
    dueAt: ${JSON.stringify(dueAt)}
    metadata: { youtube: { title: ${JSON.stringify(title)}, categoryId: ${JSON.stringify(category)}, privacy: ${privacy} } }
    assets: [ { video: { url: ${JSON.stringify(videoUrl)} } } ]
  }) {
    ... on PostActionSuccess { post { id } }
    ... on MutationError { message }
  }
}`);
const res = data.createPost;
if (res.message) { console.error('Buffer refused the post:', res.message); process.exit(1); }
console.log(`scheduled on YouTube for ${dueAt} (Buffer post ${res.post.id})`);
