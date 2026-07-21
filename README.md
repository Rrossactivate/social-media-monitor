# Geoff Woods Social Audience Tracker

A static, mobile-friendly dashboard that keeps a dated archive of audience counts and recent post performance for Geoff Woods and AI Leadership. It is designed for GitHub Pages and includes a scheduled GitHub Actions workflow.

## What it tracks

- A follower or subscriber snapshot for each connected channel, once per day
- Follower growth over 7, 30, 90, or all archived days
- Recent post counts, views or impressions, engagements, and engagement rate
- Source status so an API error never silently looks like fresh data
- Manual overrides for channels whose official APIs do not expose the required metric

The seeded figures are public baseline observations, not live API results. A value marked `carry-forward` is deliberately stale: it keeps the daily archive continuous without claiming the platform was re-measured.

## Publish with GitHub Pages

1. Create a GitHub repository and copy this project into it.
2. Use `main` as the default branch.
3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. In **Settings → Secrets and variables → Actions**, add whichever credentials you have from the list below.
5. Run **Actions → Update social tracker → Run workflow** once.

The workflow runs every day at 6:17 a.m. in `America/Vancouver`, commits the updated JSON archive, and publishes the dashboard. GitHub documents both [scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule) and [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Credentials

All credentials are optional. Missing credentials leave the most recent verified value in place and mark that provider as needing setup.

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

Never put credentials in `public/`, the HTML, or the JSON files. GitHub injects them only while the private workflow runner is updating the archive.

API notes:

- YouTube's channel statistics include subscriber count, but YouTube reports it with limited precision for public display. See the [official Channels API](https://developers.google.com/youtube/v3/docs/channels).
- LinkedIn organization follower data requires the right product access and organization permissions. See the [official follower statistics documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/follower-statistics).
- Spotify's public show endpoints expose episode data but not podcast follower counts, so Spotify remains a manual entry. See [Get Show](https://developer.spotify.com/documentation/web-api/reference/get-a-show).
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
- `public/data/status.json`: latest provider run status
- `config/manual-overrides.json`: hand-entered values merged by every run
- `.github/workflows/daily-tracker.yml`: daily automation and Pages deployment
