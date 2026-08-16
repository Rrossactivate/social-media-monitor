import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  channels: path.join(root, "public/data/channels.json"),
  snapshots: path.join(root, "public/data/snapshots.json"),
  posts: path.join(root, "public/data/posts.json"),
  status: path.join(root, "public/data/status.json"),
  overrides: path.join(root, "config/manual-overrides.json"),
};
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.TRACKER_TIMEZONE || "America/Vancouver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const [channels, snapshots, posts, previousStatus, overrides] = await Promise.all(Object.values(files).map(readJson));
const statusById = new Map((previousStatus.providers || []).map((provider) => [provider.id, provider]));

function markProvider(id, status, detail) {
  const provider = statusById.get(id) || { id, label: id, mode: "api" };
  statusById.set(id, { ...provider, status, detail });
}

function sourcePriority(source = "") {
  if (source === "manual-override") return 4;
  if (source === "browser-verified") return 3;
  if (source.endsWith("-api")) return 2;
  if (source === "carry-forward") return 1;
  return 0;
}

function upsertSnapshot(snapshot) {
  const index = snapshots.findIndex((item) => item.date === snapshot.date && item.channelId === snapshot.channelId);
  if (index >= 0 && sourcePriority(snapshots[index].source) > sourcePriority(snapshot.source)) return;
  if (index >= 0) snapshots[index] = { ...snapshots[index], ...snapshot };
  else snapshots.push(snapshot);
}

function upsertPost(post) {
  const index = posts.findIndex((item) => item.id === post.id);
  if (index >= 0 && sourcePriority(posts[index].source) > sourcePriority(post.source)) return;
  if (index >= 0) posts[index] = { ...posts[index], ...post };
  else posts.push(post);
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function updateYouTube() {
  if (!process.env.YOUTUBE_API_KEY) {
    markProvider("youtube", "needs-setup", "Add YOUTUBE_API_KEY");
    return;
  }
  try {
    const channel = channels.find((item) => item.provider === "youtube");
    const query = new URLSearchParams({
      part: "statistics,contentDetails",
      id: channel.handle,
      key: process.env.YOUTUBE_API_KEY,
    });
    const channelData = await getJson(`https://www.googleapis.com/youtube/v3/channels?${query}`);
    const record = channelData.items?.[0];
    if (!record) throw new Error("Channel not found");
    upsertSnapshot({
      date: today,
      channelId: channel.id,
      audience: Number(record.statistics.subscriberCount),
      source: "youtube-api",
      precision: record.statistics.hiddenSubscriberCount ? "hidden" : "api-rounded",
    });

    const playlistId = record.contentDetails?.relatedPlaylists?.uploads;
    if (playlistId) {
      const playlistQuery = new URLSearchParams({ part: "snippet", playlistId, maxResults: "10", key: process.env.YOUTUBE_API_KEY });
      const playlist = await getJson(`https://www.googleapis.com/youtube/v3/playlistItems?${playlistQuery}`);
      const ids = playlist.items?.map((item) => item.snippet.resourceId.videoId).filter(Boolean) || [];
      if (ids.length) {
        const videoQuery = new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), key: process.env.YOUTUBE_API_KEY });
        const videoData = await getJson(`https://www.googleapis.com/youtube/v3/videos?${videoQuery}`);
        for (const video of videoData.items || []) {
          const likes = video.statistics.likeCount == null ? null : Number(video.statistics.likeCount);
          const comments = video.statistics.commentCount == null ? null : Number(video.statistics.commentCount);
          const visibleEngagements = [likes, comments].filter(Number.isFinite);
          upsertPost({
            id: `youtube:${video.id}`,
            channelId: channel.id,
            publishedAt: video.snippet.publishedAt,
            title: video.snippet.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            views: Number(video.statistics.viewCount || 0),
            engagements: visibleEngagements.length ? visibleEngagements.reduce((sum, value) => sum + value, 0) : null,
            likes,
            comments,
            source: "youtube-api",
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
    markProvider("youtube", "ready", "Audience and recent video metrics updated");
  } catch (error) {
    markProvider("youtube", "error", `Update failed: ${error.message}`);
  }
}

async function updateX() {
  if (!process.env.X_BEARER_TOKEN) {
    markProvider("x", "needs-setup", "Add X_BEARER_TOKEN");
    return;
  }
  try {
    const channel = channels.find((item) => item.provider === "x");
    const headers = { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` };
    const user = await getJson(`https://api.x.com/2/users/by/username/${channel.handle}?user.fields=public_metrics`, { headers });
    upsertSnapshot({ date: today, channelId: channel.id, audience: user.data.public_metrics.followers_count, source: "x-api", precision: "exact" });
    const query = new URLSearchParams({
      max_results: "10",
      exclude: "retweets,replies",
      "tweet.fields": "created_at,public_metrics,text",
    });
    const timeline = await getJson(`https://api.x.com/2/users/${user.data.id}/tweets?${query}`, { headers });
    for (const tweet of timeline.data || []) {
      const metrics = tweet.public_metrics || {};
      const impressions = metrics.impression_count == null ? null : Number(metrics.impression_count);
      upsertPost({
        id: `x:${tweet.id}`,
        channelId: channel.id,
        publishedAt: tweet.created_at,
        text: tweet.text,
        url: `https://x.com/${channel.handle}/status/${tweet.id}`,
        ...(Number.isFinite(impressions) ? { impressions, reachStatus: "visible" } : { reachStatus: "not-visible" }),
        engagements: Number(metrics.like_count || 0) + Number(metrics.reply_count || 0) + Number(metrics.retweet_count || 0) + Number(metrics.quote_count || 0),
        likes: Number(metrics.like_count || 0),
        comments: Number(metrics.reply_count || 0),
        shares: Number(metrics.retweet_count || 0) + Number(metrics.quote_count || 0),
        source: "x-api",
        updatedAt: new Date().toISOString(),
      });
    }
    markProvider("x", "ready", "Audience and recent post metrics updated");
  } catch (error) {
    markProvider("x", "error", `Update failed: ${error.message}`);
  }
}

async function updateInstagram() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) {
    markProvider("instagram", "needs-setup", "Add Instagram user ID and access token");
    return;
  }
  try {
    const channel = channels.find((item) => item.provider === "instagram");
    const version = process.env.META_GRAPH_VERSION || "v24.0";
    const accountQuery = new URLSearchParams({ fields: "followers_count,username", access_token: token });
    const account = await getJson(`https://graph.instagram.com/${version}/${userId}?${accountQuery}`);
    upsertSnapshot({ date: today, channelId: channel.id, audience: Number(account.followers_count), source: "instagram-api", precision: "exact" });
    const mediaQuery = new URLSearchParams({
      fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count",
      limit: "10",
      access_token: token,
    });
    const media = await getJson(`https://graph.instagram.com/${version}/${userId}/media?${mediaQuery}`);
    for (const item of media.data || []) {
      const likes = Number(item.like_count || 0);
      const comments = Number(item.comments_count || 0);
      upsertPost({
        id: `instagram:${item.id}`,
        channelId: channel.id,
        publishedAt: item.timestamp,
        text: item.caption || item.media_type,
        url: item.permalink,
        reachStatus: "not-visible",
        engagements: likes + comments,
        likes,
        comments,
        source: "instagram-api",
        updatedAt: new Date().toISOString(),
      });
    }
    markProvider("instagram", "ready", "Audience and recent public engagement updated");
  } catch (error) {
    markProvider("instagram", "error", `Update failed: ${error.message}`);
  }
}

async function updateLinkedIn() {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationId = process.env.LINKEDIN_ORGANIZATION_ID;
  if (!token || !organizationId) {
    markProvider("linkedin", "needs-setup", "Add an approved organization token and ID");
    return;
  }
  try {
    const channel = channels.find((item) => item.provider === "linkedin");
    const urn = encodeURIComponent(`urn:li:organization:${organizationId}`);
    const headers = {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202606",
      "X-Restli-Protocol-Version": "2.0.0",
    };
    const data = await getJson(`https://api.linkedin.com/rest/networkSizes/${urn}?edgeType=CompanyFollowedByMember`, { headers });
    const audience = Number(data.firstDegreeSize ?? data.size ?? data.elements?.[0]?.firstDegreeSize);
    if (!Number.isFinite(audience)) throw new Error("Follower count missing from response");
    upsertSnapshot({ date: today, channelId: channel.id, audience, source: "linkedin-api", precision: "exact" });
    markProvider("linkedin", "ready", "Organization audience updated; post metrics can be added with approved scopes");
  } catch (error) {
    markProvider("linkedin", "error", `Update failed: ${error.message}`);
  }
}

for (const snapshot of overrides.snapshots || []) upsertSnapshot({ ...snapshot, source: snapshot.source || "manual-override" });
for (const post of overrides.posts || []) upsertPost({ ...post, source: post.source || "manual-override" });

await Promise.all([updateYouTube(), updateX(), updateInstagram(), updateLinkedIn()]);

// A dated carry-forward makes the daily archive continuous without pretending a stale value was freshly measured.
for (const channel of channels) {
  if (snapshots.some((item) => item.channelId === channel.id && item.date === today)) continue;
  const latest = snapshots.filter((item) => item.channelId === channel.id).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (latest) upsertSnapshot({ ...latest, date: today, source: "carry-forward", precision: "stale" });
}

snapshots.sort((a, b) => a.date.localeCompare(b.date) || a.channelId.localeCompare(b.channelId));
posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
const status = {
  generatedAt: new Date().toISOString(),
  timezone: process.env.TRACKER_TIMEZONE || "America/Vancouver",
  providers: [...statusById.values()],
};

await Promise.all([
  writeFile(files.snapshots, `${JSON.stringify(snapshots, null, 2)}\n`),
  writeFile(files.posts, `${JSON.stringify(posts, null, 2)}\n`),
  writeFile(files.status, `${JSON.stringify(status, null, 2)}\n`),
]);

console.log(`Tracker archive updated for ${today}: ${snapshots.length} snapshots, ${posts.length} posts.`);
