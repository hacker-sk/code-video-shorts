#!/usr/bin/env node
// Publishes a rendered reel to YouTube through Buffer, scheduled 1 minute from now.
// Buffer's API has no file upload (it only takes a public URL), so the MP4 is first uploaded to Cloudinary.
// Usage: node publish.mjs <reel-name> <video.mp4>
// Env:   BUFFER_API_KEY (Buffer > Settings > API), CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD_NAME)
//        optional: BUFFER_CHANNEL_ID (else the first YouTube channel found), BUFFER_YOUTUBE_PRIVACY (public|unlisted|private, default public),
//                  BUFFER_YOUTUBE_CATEGORY (YouTube category id, default 24 = Entertainment), BUFFER_DELAY_SECONDS (default 60)
// Optional reels/<name>/post.json: {"title": "...", "description": "..."}; otherwise the title comes from the folder name.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [name, file] = process.argv.slice(2);
const BUFFER = process.env.BUFFER_API_KEY, CLD = process.env.CLOUDINARY_URL;
if (!name || !file) { console.error('usage: publish.mjs <reel-name> <video.mp4>'); process.exit(1); }
if (!BUFFER) { console.error('BUFFER_API_KEY is not set'); process.exit(1); }
if (!CLD) { console.error('CLOUDINARY_URL is not set (Buffer needs a public URL for the video)'); process.exit(1); }
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
const cu = new URL(CLD);
const ts = Math.floor(Date.now() / 1000), publicId = `reels/${name}-${ts}`;
const signature = crypto.createHash('sha1').update(`public_id=${publicId}&timestamp=${ts}${cu.password}`).digest('hex');
const fd = new FormData();
fd.append('file', await fs.openAsBlob(file), 'video.mp4');
fd.append('api_key', cu.username); fd.append('timestamp', String(ts)); fd.append('public_id', publicId); fd.append('signature', signature);
console.log('uploading video to Cloudinary...');
const up = await fetch(`https://api.cloudinary.com/v1_1/${cu.hostname}/video/upload`, { method: 'POST', body: fd });
const upJson = await up.json().catch(() => ({}));
if (!up.ok || !upJson.secure_url) { console.error(`Cloudinary upload failed (${up.status}): ${JSON.stringify(upJson).slice(0, 300)}`); process.exit(1); }
const videoUrl = upJson.secure_url;
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
