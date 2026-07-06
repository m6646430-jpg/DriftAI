# DriftAI — Admin Dashboard + Daily Job Board

## Goal
1. Admin dashboard (`admin.html`) — revenue vs $5K goal, order pipeline, content checklist. Secret URL, no login (approach #2 from brainstorm).
2. Dynamic job board — `jobs.html` renders from `data/jobs.json` instead of hardcoded cards.
3. Daily auto-update of Canada + USA jobs via `scripts/fetch-jobs.js` (Adzuna free API) run by launchd.

## Architecture decisions
- **No backend.** Data lives in JSON files served statically. Matches existing static-site setup + Netlify hosting.
- **Jobs source: Adzuna API** — free tier (250 calls/mo), real CA/US jobs with salary + apply URL. Requires free app_id + app_key.
- **Fallback:** curated sample jobs ship in `data/jobs.json` so the board works before the API key is added and if a fetch fails.
- **Daily run:** launchd plist runs `fetch-jobs.js` each morning, rewrites `data/jobs.json`. Re-deploy (Netlify) picks up the new file — or use Netlify build hook (documented in README).

## Files
- `data/jobs.json` — job listings + `updated` timestamp
- `data/dashboard.json` — orders, revenue, content checklist
- `js/jobs.js` — renders board, country + category filters
- `js/admin.js` — renders dashboard
- `admin.html` — dashboard page (unlinked from nav)
- `scripts/fetch-jobs.js` — Adzuna fetcher, writes data/jobs.json
- `scripts/com.driftai.jobs.plist` — launchd daily schedule
- `DASHBOARD-AND-JOBS-README.md` — setup + daily-update instructions

## Deviations
- Added hybrid AI step (`scripts/ai-enhance.js`) per user choice "follow 1". Reuses OpenRouter
  (OPENROUTER_API_KEY) + free nvidia nemotron models — matching stock-digest's llm.py pattern,
  NOT raw Gemini. AI only adds blurb/category/visa/ranking; facts + apply URLs preserved by
  merging on index. Graceful passthrough when key missing or call fails. stock-digest untouched.

## Open questions
- Hosting: Netlify static file update needs redeploy. If user wants true live daily update without manual redeploy, use Netlify build hook (curl in the daily script). Documented; not wired until user confirms Netlify.
