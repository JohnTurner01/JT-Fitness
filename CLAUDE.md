# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apex Health is a personal health and performance dashboard — a single-page application (SPA) that aggregates data from WHOOP, Strava, Excel/CSV uploads, and manual entry, then provides AI-powered insights via the Claude API. It is a personal-use-only app with no traditional backend.

## Architecture

### Single-File Frontend
The entire application lives in `index.html` (~2,960 lines total):
- **~900 lines CSS** — embedded in `<style>`, uses CSS custom properties for the design system
- **~1,900 lines JavaScript** — embedded in `<script>`, vanilla JS with no build step
- **~150 lines HTML** — minimal markup; pages are shown/hidden via `.page.active` class toggling

There is no build process, no package manager, and no bundler. All dependencies are loaded from CDN:
- Chart.js 4.4.1 (charts)
- XLSX 0.18.5 (Excel/CSV parsing)
- Google Fonts (Syne, Space Mono)

### Serverless Function
`netlify/functions/whoop-auth.js` — handles WHOOP OAuth2 token exchange server-side (to keep `client_secret` off the client). It also fetches initial WHOOP data and returns it alongside the access token.

### State Management
A single global `STATE` object holds all app data and is persisted to/from `localStorage` via `saveState()` / `loadState()`. No state library is used.

```javascript
const STATE = {
  whoop: { connected: false, data: [] },
  strava: { connected: false, data: [] },
  excel: { loaded: false, data: [] },
  manual: { workouts: [], nutrition: [], biometrics: [] },
  settings: { apiKey: '', goals: {} },
  charts: {},
  currentRange: 7
};
```

### Page Navigation
6 pages: Setup, Dashboard, AI Insights, Log Entry, Raw Data, Settings. Navigation works by adding/removing the `.active` class on `.page` elements.

### Data Flow
All data sources (WHOOP, Strava, Excel, manual) are normalized to a common schema keyed by `date` and `source`, then aggregated for display and chart rendering.

**Normalized schema:**
```javascript
{
  date, source,                          // identity
  activity, duration, distance,          // workout
  recovery, strain, hrv, rhr,            // WHOOP metrics
  sleepHours, sleepScore, deepSleep, remSleep,
  calories, protein, carbs, fat, water, fibre,
  weight, mood, stress, notes, name
}
```

### AI Integration
The AI Insights page sends a summary of recent data to the Anthropic API (using the user's own API key stored in localStorage). The chat interface also lets users query their data directly. The API key is never sent to any backend — it goes straight from the browser to `api.anthropic.com`.

## Development

**No build step required.** Open `index.html` in a browser to run the app locally. For WHOOP OAuth to work, the Netlify function must be running — use the Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

This serves the site with the function available at `/.netlify/functions/whoop-auth`.

**Strava OAuth** works with just a browser redirect since the token exchange is done client-side.

## Configuration

All configuration is done through the Settings UI and stored in localStorage:
- `anthropic_api_key` — Anthropic Claude API key for AI Insights
- WHOOP `client_id` / `client_secret` — user's own WHOOP Developer app
- Strava `client_id` / `client_secret` — user's own Strava API app
- Supabase URL + anon key — optional cloud sync

## Design System

CSS custom properties (defined on `:root`):
- `--accent`: `#00ff88` (green, primary)
- `--accent2`: `#ff6b35` (orange, Strava)
- `--accent3`: `#7c3aed` (purple, Excel/custom)
- `--bg`: `#0a0a0f`, `--surface`: `#111118`
- Fonts: **Syne** for headings, **Space Mono** for data/labels/inputs
