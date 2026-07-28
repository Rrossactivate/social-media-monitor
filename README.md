# AIL Social Media Monitoring

A static, mobile-friendly dashboard that keeps a dated archive of audience counts, recent post performance, and earned-media mentions for Geoff Woods and AI Leadership. The private dashboard is hosted through Sites, while GitHub is retained only as a private source backup and change history.

The interface follows the [AITP design system](https://www.figma.com/design/mvypBgzGL0MnZnlqK9wFyI/AITP-DS--TailwindCSS-v4.1.6--?node-id=2006-6102): Leadership Blue, Deep Blue, Electric Blue, Geist product typography, tight headline hierarchy, and consistent product-like spacing.

## Public dashboard

The public dashboard is published through GitHub Pages at:

<https://rrossactivate.github.io/social-media-monitor/>

The Pages workflow only packages and publishes the already verified static dashboard. It does not collect platform data or rewrite the daily archive.

## What it tracks

- A follower or subscriber snapshot for each connected channel, once per day
- Follower growth over 1, 7, 30, or all archived days
- Recent post counts, views or impressions, engagements, and engagement rate
- Non-owned mentions, podcast guest appearances, interviews, reposts, and articles as a separate earned-media timeline
- Source status so an API error never silently looks like fresh data
- Manual overrides for channels whose official APIs do not expose the required metric

The seeded figures are public baseline observations, not live API results. A value marked `carry-forward` is deliberately stale: it keeps the daily archive continuous without claiming the platform was re-measured.

Earned media is never added to Geoff’s owned audience total. One appearance is counted once even when it is syndicated to multiple platforms, and third-party reach stays blank unless the publisher exposes a verifiable public metric.

## Daily update process

The Codex daily automation is the single collection path. It verifies owned-channel audience and activity using available signed-in sessions, searches for earned-media mentions, preserves previously verified values when a platform is unavailable, validates the dashboard, saves one dated archive update, and publishes the private Sites version.

GitHub does not run a second data update. A push publishes the already verified static dashboard to GitHub Pages without overwriting browser-verified measurements.

## Credentials

All credentials are optional and are used only when running `npm run update-data` manually. Missing credentials leave the most recent verified value in place and mark that provider as needing setup.

| Secret or variable | Used for |
| --- | --- |
| `YOUTUBE_API_KEY` | Subscriber count and recent video metrics |
| `X_BEARER_TOKEN` | Follower count and recent public post metrics |
| `INSTAGRAM_ACCESS_TOKEN` | Professional-account follower and media metrics |
| `INSTAGRAM_USER_ID` | Instagram professional account ID |
| `LINKEDIN_ACCESS_TOKEN` | Approved LinkedIn organization access |
| `LINKEDIN_ORGANIZATION_ID` | AI Leadership organization ID |
| `META_GRAPH_VERSION` | Optional repository variable; defaults to `v24.0` |
| `LINKEDIN_VERSION` | Optional repository variable; defaults to `202606` |

Never put credentials in `public/`, the HTML, or the JSON files. Supply them only as temporary environment variables during a manual update.

API notes:

- YouTube's channel statistics include subscriber count, but YouTube reports it with limited precision for public display. See the [official Channels API](https://developers.google.com/youtube/v3/docs/channels).
- LinkedIn organization follower data requires the right product access and organization permissions. See the [official follower statistics documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/follower-statistics).
- TikTok follower and recent-video metrics are captured through the daily signed-in browser verification and remain marked `browser-verified`.
- A personal LinkedIn follower count generally needs a manual override unless Geoff's approved LinkedIn access includes the relevant member capability.

## Manual entries

Edit `config/manual-overrides.json` and add a snapshot:

```json
{
  "snapshots": [
    {
      "date": "2026-07-21",
      "channelId": "linkedin-geoff",
      "audience": 18000,
      "precision": "exact"
    }
  ],
  "posts": []
}
```

The `channelId` must match an entry in `public/data/channels.json`. Manual posts use this shape:

```json
{
  "id": "linkedin:unique-post-id",
  "channelId": "linkedin-geoff",
  "publishedAt": "2026-07-21T15:30:00Z",
  "text": "Short post description",
  "url": "https://www.linkedin.com/feed/update/...",
  "impressions": 12000,
  "engagements": 540
}
```

## Work locally

Requires Node.js 22 or newer.

```bash
npm install
npm run update-data
npm run prepare-static
npm run dev
```

The website opens at `http://localhost:3000/`. The standalone GitHub Pages build is written to `_site/`.

## Data files

- `public/data/channels.json`: channel catalog and profile links
- `public/data/snapshots.json`: append-only audience archive
- `public/data/posts.json`: latest known post metrics
- `public/data/mentions.json`: verified non-owned mentions and guest appearances
- `public/data/status.json`: latest provider run status
- `config/manual-overrides.json`: hand-entered values merged by every run
- `.github/workflows/pages.yml`: publishing-only GitHub Pages deployment
- `.openai/hosting.json`: existing private Sites project
