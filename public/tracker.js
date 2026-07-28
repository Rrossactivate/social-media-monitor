const DATA_FILES = {
  channels: "./data/channels.json",
  snapshots: "./data/snapshots.json",
  posts: "./data/posts.json",
  status: "./data/status.json",
  mentions: "./data/mentions.json",
};

const state = {
  channels: [],
  snapshots: [],
  posts: [],
  status: null,
  mentions: [],
  days: 30,
  channelId: "all",
};

const $ = (selector) => document.querySelector(selector);
const fullNumber = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const longDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? escapeHtml(url.href) : "#";
  } catch {
    return "#";
  }
}

function dateValue(value) {
  return new Date(`${value}T12:00:00Z`);
}

function rangeStart() {
  if (!state.days) return null;
  const dates = state.snapshots.map((item) => dateValue(item.date).getTime());
  const newest = dates.length ? Math.max(...dates) : Date.now();
  return new Date(newest - (state.days - 1) * 86400000);
}

function selectedChannels() {
  return state.channelId === "all"
    ? state.channels
    : state.channels.filter((channel) => channel.id === state.channelId);
}

function selectedSnapshots() {
  const ids = new Set(selectedChannels().map((channel) => channel.id));
  const start = rangeStart();
  return state.snapshots.filter((item) => ids.has(item.channelId) && (!start || dateValue(item.date) >= start));
}

function selectedPosts() {
  const ids = new Set(selectedChannels().map((channel) => channel.id));
  const start = rangeStart();
  return state.posts.filter((item) => ids.has(item.channelId) && (!start || dateValue(item.publishedAt.slice(0, 10)) >= start));
}

function selectedMentions() {
  const start = rangeStart();
  return state.mentions.filter((item) => !start || dateValue(item.publishedAt.slice(0, 10)) >= start);
}

function byChannel(items) {
  return items.reduce((grouped, item) => {
    (grouped[item.channelId] ||= []).push(item);
    return grouped;
  }, {});
}

function latestFor(channelId) {
  return state.snapshots
    .filter((item) => item.channelId === channelId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}

function earliestInRange(channelId) {
  const start = rangeStart();
  const all = state.snapshots
    .filter((item) => item.channelId === channelId)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!all.length) return null;
  if (!start) return all[0];
  return all.find((item) => dateValue(item.date) >= start) || all.at(-1);
}

function percent(numerator, denominator) {
  return denominator ? `${((numerator / denominator) * 100).toFixed(2)}%` : "—";
}

function sourceFreshness(date) {
  const age = Math.max(0, Math.floor((Date.now() - dateValue(date).getTime()) / 86400000));
  if (age === 0) return "today";
  if (age === 1) return "1 day ago";
  return `${age} days ago`;
}

function sourceLabel(source) {
  const labels = {
    "browser-verified": "profile verified",
    "public-baseline": "public baseline",
    "carry-forward": "last verified",
    "instagram-api": "Instagram API",
    "linkedin-api": "LinkedIn API",
    "youtube-api": "YouTube API",
    "x-api": "X API",
  };
  return labels[source] || source || "recorded";
}

function renderHeader() {
  const generated = state.status?.generatedAt ? new Date(state.status.generatedAt) : null;
  const generatedLabel = generated && !Number.isNaN(generated.getTime()) ? longDateTime.format(generated) : "Not yet run";
  $("#last-run").textContent = generatedLabel;
  $("#status-last-run").textContent = generatedLabel;
  const ready = state.status?.providers?.filter((item) => item.status === "ready").length || 0;
  const total = state.status?.providers?.length || 0;
  $("#coverage-note").textContent = `${ready} of ${total} update paths ready`;
  $("#run-status").classList.toggle("attention", ready < total);
}

function setView(view, { updateHash = true } = {}) {
  const activeView = view === "status" ? "status" : "dashboard";
  document.querySelectorAll("[data-view]").forEach((button) => {
    const isActive = button.dataset.view === activeView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  $("#dashboard-view").hidden = activeView !== "dashboard";
  $("#status-view").hidden = activeView !== "status";
  if (updateHash) {
    history.replaceState(null, "", activeView === "status" ? "#data-status" : "#top");
  }
  if (activeView === "dashboard") requestAnimationFrame(drawChart);
}

function renderKpis() {
  const channels = selectedChannels();
  const posts = selectedPosts();
  const latest = channels.map((channel) => latestFor(channel.id)).filter(Boolean);
  const current = latest.reduce((sum, item) => sum + item.audience, 0);
  const growth = channels.reduce((sum, channel) => {
    const first = earliestInRange(channel.id);
    const last = latestFor(channel.id);
    return sum + (first && last ? last.audience - first.audience : 0);
  }, 0);
  const measuredPosts = posts.filter((post) => Number.isFinite(post.engagements));
  const engagements = measuredPosts.reduce((sum, post) => sum + post.engagements, 0);
  const exposurePosts = measuredPosts.filter((post) => Number.isFinite(post.views) || Number.isFinite(post.impressions));
  const rateEngagements = exposurePosts.reduce((sum, post) => sum + post.engagements, 0);
  const exposure = exposurePosts.reduce((sum, post) => sum + (Number.isFinite(post.views) ? post.views : post.impressions), 0);
  const engagementIsMinimum = measuredPosts.some((post) => post.engagementsPrecision === "visible-minimum");
  const rateIsMinimum = exposurePosts.some((post) => post.engagementsPrecision === "visible-minimum");
  const audienceIsRounded = latest.some((item) => item.precision === "rounded" || item.precision === "api-rounded");

  $("#kpi-audience").textContent = latest.length ? `${audienceIsRounded ? "≈" : ""}${fullNumber.format(current)}` : "—";
  $("#kpi-audience-note").textContent = `${latest.length} of ${channels.length} selected channels reporting`;
  $("#kpi-growth").textContent = growth ? `${growth > 0 ? "+" : ""}${fullNumber.format(growth)}` : "0";
  $("#kpi-growth-note").textContent = state.days ? `During the last ${state.days} days` : "Across the full archive";
  $("#kpi-posts").textContent = fullNumber.format(posts.length);
  $("#kpi-posts-note").textContent = state.days ? `Tracked during the last ${state.days} days` : "Tracked across the full archive";
  $("#kpi-engagements").textContent = measuredPosts.length ? `${engagementIsMinimum ? "≥" : ""}${fullNumber.format(engagements)}` : "—";
  $("#kpi-engagement-rate").textContent = exposure
    ? `Engagement rate ${rateIsMinimum ? "≥" : ""}${percent(rateEngagements, exposure)} on posts with visible reach`
    : measuredPosts.length ? "Reach metrics not visible" : "Engagement metrics not visible";
}

function renderChannelList() {
  const posts = byChannel(selectedPosts());
  $("#channel-list").innerHTML = selectedChannels()
    .map((channel) => {
      const latest = latestFor(channel.id);
      const first = earliestInRange(channel.id);
      const delta = latest && first ? latest.audience - first.audience : 0;
      const activity = posts[channel.id]?.length || 0;
      const activityVerified = channel.activityTracking?.status === "verified";
      const activityValue = activity ? fullNumber.format(activity) : activityVerified ? "0" : "—";
      const activityLabel = activity || activityVerified ? "posts tracked" : "not tracked";
      return `<a class="channel-row" href="${safeUrl(channel.profileUrl)}" target="_blank" rel="noreferrer">
        <span class="channel-dot" style="--channel-color:${channel.color}"></span>
        <span class="channel-identity"><strong>${escapeHtml(channel.name)}</strong><small>${escapeHtml(channel.platform)} · ${escapeHtml(channel.displayHandle || channel.handle)}</small></span>
        <span class="channel-activity"><strong>${activityValue}</strong><small>${activityLabel}</small></span>
        <span class="channel-value"><strong>${latest ? `${latest.precision === "rounded" || latest.precision === "api-rounded" ? "≈" : ""}${fullNumber.format(latest.audience)}` : "—"}</strong><small>${latest ? `${delta >= 0 ? "+" : ""}${fullNumber.format(delta)} · ${sourceFreshness(latest.date)} · ${sourceLabel(latest.source)}` : "Awaiting first value"}</small></span>
      </a>`;
    })
    .join("");
}

function renderCoverage() {
  const providers = state.status?.providers || [];
  const ready = providers.filter((item) => item.status === "ready").length;
  const coverage = providers.length ? Math.round((ready / providers.length) * 100) : 0;
  $("#coverage-bar").style.width = `${coverage}%`;
  $("#coverage-summary").textContent = `${coverage}% of update paths are ready. Missing credentials never erase the last verified value.`;
  $("#provider-list").innerHTML = providers
    .map((provider) => `<div class="provider-row">
      <span class="provider-state ${provider.status}"></span>
      <span><strong>${escapeHtml(provider.label)}</strong><small>${escapeHtml(provider.detail)}</small></span>
      <em>${escapeHtml(provider.mode)}</em>
    </div>`)
    .join("");
}

function renderPosts() {
  const channelMap = Object.fromEntries(state.channels.map((channel) => [channel.id, channel]));
  const posts = selectedPosts().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || (b.engagements || 0) - (a.engagements || 0));
  $("#content-range").textContent = state.days ? `Last ${state.days} days` : "Full archive";
  $("#post-empty").hidden = Boolean(posts.length);
  $("#post-table").innerHTML = posts
    .map((post) => {
      const channel = channelMap[post.channelId];
      const exposure = Number.isFinite(post.views) ? post.views : Number.isFinite(post.impressions) ? post.impressions : null;
      const title = post.title || post.text || "View post";
      const hasEngagements = Number.isFinite(post.engagements);
      const engagementPrefix = post.engagementsPrecision === "visible-minimum" ? "≥" : "";
      const exposureCell = Number.isFinite(exposure)
        ? fullNumber.format(exposure)
        : post.reachStatus === "not-visible"
          ? `<span class="metric-unavailable" title="This platform did not expose reach during verification">Not visible</span>`
          : "—";
      return `<tr>
        <td>${post.datePrecision?.startsWith("relative") ? "≈" : ""}${shortDate.format(new Date(post.publishedAt))}</td>
        <td><span class="table-channel"><i style="--channel-color:${channel?.color || "#64748b"}"></i>${escapeHtml(channel?.platform || post.channelId)}</span></td>
        <td><a href="${safeUrl(post.url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a></td>
        <td>${exposureCell}</td>
        <td>${hasEngagements ? `${engagementPrefix}${fullNumber.format(post.engagements)}` : "—"}</td>
        <td>${hasEngagements && exposure ? `${engagementPrefix}${percent(post.engagements, exposure)}` : "—"}</td>
      </tr>`;
    })
    .join("");
}

function mentionTypeLabel(type) {
  const labels = {
    "podcast-guest": "Podcast guest",
    interview: "Interview",
    "social-mention": "Social mention",
    repost: "Repost",
    article: "Article",
    "book-mention": "Book mention",
  };
  return labels[type] || type || "Mention";
}

function renderMentions() {
  const mentions = selectedMentions().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const appearances = mentions.filter((item) => ["podcast-guest", "interview"].includes(item.type));
  const visibleReach = mentions
    .map((item) => Number.isFinite(item.views) ? item.views : Number.isFinite(item.impressions) ? item.impressions : null)
    .filter(Number.isFinite);
  const totalReach = visibleReach.reduce((sum, value) => sum + value, 0);

  $("#mention-range").textContent = state.days ? `Last ${state.days} days` : "Full archive";
  $("#mention-count").textContent = fullNumber.format(mentions.length);
  $("#mention-guest-count").textContent = fullNumber.format(appearances.length);
  $("#mention-reach").textContent = visibleReach.length ? fullNumber.format(totalReach) : "—";
  $("#mention-empty").hidden = Boolean(mentions.length);
  $("#mention-list").innerHTML = mentions
    .map((mention) => {
      const reach = Number.isFinite(mention.views)
        ? mention.views
        : Number.isFinite(mention.impressions)
          ? mention.impressions
          : null;
      const platforms = Array.isArray(mention.platforms) && mention.platforms.length
        ? mention.platforms.join(" · ")
        : mention.platform || "Public web";
      const reachLabel = Number.isFinite(reach)
        ? fullNumber.format(reach)
        : mention.reachStatus === "not-visible"
          ? "Not visible"
          : "—";
      return `<article class="mention-row">
        <time datetime="${escapeHtml(mention.publishedAt)}">${mention.datePrecision?.startsWith("relative") ? "≈" : ""}${shortDate.format(new Date(mention.publishedAt))}</time>
        <span class="mention-type">${escapeHtml(mentionTypeLabel(mention.type))}</span>
        <span class="mention-main">
          <a href="${safeUrl(mention.url)}" target="_blank" rel="noreferrer">${escapeHtml(mention.title || "View mention")}</a>
          <small>${escapeHtml(mention.publisher)} · ${escapeHtml(platforms)}</small>
        </span>
        <span class="mention-reach ${Number.isFinite(reach) ? "" : "unavailable"}"><small>Public reach</small><strong>${reachLabel}</strong></span>
      </article>`;
    })
    .join("");
}

function drawChart() {
  const canvas = $("#trend-chart");
  const empty = $("#chart-empty");
  const channels = selectedChannels();
  const snapshots = selectedSnapshots();
  const series = byChannel(snapshots);
  const drawable = channels.filter((channel) => (series[channel.id] || []).length);
  empty.hidden = Boolean(drawable.length);
  canvas.hidden = !drawable.length;
  $("#chart-legend").innerHTML = drawable.map((channel) => `<span><i style="--channel-color:${channel.color}"></i>${channel.platform}</span>`).join("");
  if (!drawable.length) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);
  const pad = { top: 18, right: 18, bottom: 34, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = snapshots.map((item) => item.audience);
  const dates = snapshots.map((item) => dateValue(item.date).getTime());
  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  if (minY === maxY) { minY *= 0.95; maxY *= 1.05; }
  const yMargin = Math.max((maxY - minY) * 0.12, 1);
  minY = Math.max(0, minY - yMargin);
  maxY += yMargin;
  let minX = Math.min(...dates);
  let maxX = Math.max(...dates);
  if (minX === maxX) { minX -= 43200000; maxX += 43200000; }
  const x = (value) => pad.left + ((value - minX) / (maxX - minX)) * plotW;
  const y = (value) => pad.top + (1 - (value - minY) / (maxY - minY)) * plotH;

  ctx.font = "11px Geist, sans-serif";
  ctx.textBaseline = "middle";
  for (let step = 0; step <= 4; step += 1) {
    const py = pad.top + (plotH * step) / 4;
    const label = maxY - ((maxY - minY) * step) / 4;
    ctx.strokeStyle = "#e6ebf2";
    ctx.beginPath(); ctx.moveTo(pad.left, py); ctx.lineTo(width - pad.right, py); ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(fullNumber.format(Math.round(label)), pad.left - 10, py);
  }
  [0, 0.5, 1].forEach((position) => {
    const value = minX + (maxX - minX) * position;
    ctx.fillStyle = "#64748b";
    ctx.textAlign = position === 0 ? "left" : position === 1 ? "center" : "right";
    ctx.fillText(shortDate.format(new Date(value)), pad.left + plotW * position, height - 12);
  });

  drawable.forEach((channel) => {
    const points = [...series[channel.id]].sort((a, b) => a.date.localeCompare(b.date));
    ctx.strokeStyle = channel.color;
    ctx.fillStyle = channel.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((point, index) => {
      const px = x(dateValue(point.date).getTime());
      const py = y(point.audience);
      if (index) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
    points.forEach((point) => {
      const px = x(dateValue(point.date).getTime());
      const py = y(point.audience);
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
    });
  });
}

function render() {
  renderHeader();
  renderKpis();
  renderChannelList();
  renderCoverage();
  renderPosts();
  renderMentions();
  drawChart();
}

async function loadData() {
  $("#refresh-data").disabled = true;
  try {
    const cacheBust = `?v=${Date.now()}`;
    const responses = await Promise.all(Object.values(DATA_FILES).map((url) => fetch(url + cacheBust)));
    if (responses.some((response) => !response.ok)) throw new Error("One or more data files could not be loaded.");
    [state.channels, state.snapshots, state.posts, state.status, state.mentions] = await Promise.all(responses.map((response) => response.json()));
    const select = $("#channel-filter");
    select.innerHTML = `<option value="all">All channels</option>${state.channels.map((channel) => `<option value="${escapeHtml(channel.id)}">${escapeHtml(channel.platform)} · ${escapeHtml(channel.name)}</option>`).join("")}`;
    select.value = state.channelId;
    render();
  } catch (error) {
    $("#coverage-note").textContent = "Data could not be loaded";
    $("#coverage-summary").textContent = error.message;
  } finally {
    $("#refresh-data").disabled = false;
  }
}

function downloadArchive() {
  const rows = [["date", "channel", "platform", "audience", "source", "precision"]];
  const channels = Object.fromEntries(state.channels.map((channel) => [channel.id, channel]));
  state.snapshots.forEach((item) => rows.push([
    item.date,
    channels[item.channelId]?.name || item.channelId,
    channels[item.channelId]?.platform || "",
    item.audience,
    item.source,
    item.precision || "",
  ]));
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `geoff-social-audience-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadMentions() {
  const rows = [["date", "type", "publisher", "title", "distribution", "url", "views", "impressions", "engagements", "source"]];
  state.mentions.forEach((item) => rows.push([
    item.publishedAt.slice(0, 10),
    mentionTypeLabel(item.type),
    item.publisher,
    item.title,
    (item.platforms || [item.platform]).filter(Boolean).join(" | "),
    item.url,
    item.views,
    item.impressions,
    item.engagements,
    item.source,
  ]));
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `geoff-earned-mentions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-range]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", item === button ? "true" : "false");
    });
    state.days = Number(button.dataset.range);
    render();
  });
});

$("#channel-filter").addEventListener("change", (event) => { state.channelId = event.target.value; render(); });
$("#refresh-data").addEventListener("click", loadData);
$("#download-data").addEventListener("click", downloadArchive);
$("#download-mentions").addEventListener("click", downloadMentions);
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
window.addEventListener("hashchange", () => setView(location.hash === "#data-status" ? "status" : "dashboard", { updateHash: false }));
new ResizeObserver(drawChart).observe($("#trend-chart").parentElement);
setView(location.hash === "#data-status" ? "status" : "dashboard", { updateHash: false });
loadData();
