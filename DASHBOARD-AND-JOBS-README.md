# DriftAI — Dashboard & Daily Jobs

Two things were added: an **admin dashboard** and a **daily-updating job board** (Canada + USA).

---

## 1. Admin Dashboard

Open **`admin.html`** in your browser (locally: http://localhost:4200/admin.html).

It shows:
- Revenue collected vs your **$5,000 goal** (progress bar)
- Total orders, delivered count, amount remaining to goal
- Revenue by market (🇨🇦 🇺🇸 🇮🇳 …)
- Order pipeline board: **New → Writing → Delivered**
- Content calendar checklist (tick reels as you film them)
- When the job board was last refreshed

**To update it:** edit **`data/dashboard.json`** — add orders to the `orders` array, mark reels `"done": true`. Refresh the page.

> ⚠️ The dashboard has no password. It's only hidden (not linked from the site, marked `noindex`). Keep the URL private. When you have real customer data, we should upgrade to a login (Supabase — approach #5 from the brainstorm).

---

## Job source options

Two ways to fill the board with real jobs — pick one:

- **Gemini (default, free, no new signup)** — uses your existing `GEMINI_API_KEY` (same as stock-digest) with Google Search grounding to find real US/CA jobs. Links go to each company's **official careers page** (never a hallucinated posting URL). Script: `scripts/fetch-jobs-gemini.js`.
- **Adzuna (precise apply links)** — free API (250 calls/mo), exact job-posting links + salary. Needs a 2-min signup. Script: `scripts/fetch-jobs.js`.

`scripts/daily-update.sh` automatically uses **Gemini when `GEMINI_API_KEY` is set**, otherwise Adzuna.

### Run the Gemini fetcher (recommended)
```bash
cd /Users/maheshkunasani/IdeaProjects/resume-marketing-site
export GEMINI_API_KEY=your_key      # same key stock-digest uses
node scripts/fetch-jobs-gemini.js   # writes data/jobs.json
```
Then commit + push `data/jobs.json` (or run `bash scripts/daily-update.sh` which does it).

---

## 2. Daily Job Board (Canada + USA) — Adzuna path

The board on **`jobs.html`** now loads from **`data/jobs.json`** and filters by country (USA / Canada) and category. It ships with sample jobs so it works immediately.

To make it **auto-update daily with real jobs**, connect the free Adzuna API:

### Step A — Get free API keys (2 min)
1. Go to **https://developer.adzuna.com/** → Sign up (free)
2. Copy your **App ID** and **App Key** (free tier = 250 calls/month, plenty for daily)

### Step B — Test it once
```bash
cd /Users/maheshkunasani/IdeaProjects/resume-marketing-site
export ADZUNA_APP_ID=your_app_id
export ADZUNA_APP_KEY=your_app_key
node scripts/fetch-jobs.js
```
You should see real jobs written to `data/jobs.json`. Refresh `jobs.html` to see them.

### Step C — Make it run every morning automatically
1. Open `scripts/com.driftai.jobs.plist` and paste your keys into `PASTE_YOUR_APP_ID` / `PASTE_YOUR_APP_KEY`.
2. Install the schedule:
```bash
cp scripts/com.driftai.jobs.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.driftai.jobs.plist
```
Now it fetches fresh CA + USA jobs every day at 6:00 AM. Logs go to `/tmp/driftai-jobs.log`.

To run it right now to test the schedule: `launchctl start com.driftai.jobs`
To stop it: `launchctl unload ~/Library/LaunchAgents/com.driftai.jobs.plist`

### What it pulls
Software engineering, data, finance (Canada) + software, data, marketing (USA) — newest first, last 3 days only. Companies known to sponsor visas get a "PGWP/H-1B friendly" tag automatically. Edit the `QUERIES` list in `scripts/fetch-jobs.js` to change what's pulled.

### Step D (optional) — Add AI curation
The pipeline is **hybrid**: Adzuna provides the real jobs (with real apply links), and an AI agent then curates the best 15, writes a one-line "why apply" blurb, and refines the visa tags. It reuses the **same `OPENROUTER_API_KEY`** as your stock-digest (free models: `nvidia/nemotron-3-ultra…:free`).

```bash
export OPENROUTER_API_KEY=your_key   # same one stock-digest uses
node scripts/fetch-jobs.js           # now curates + adds blurbs
```

Or add it to the launchd plist (`OPENROUTER_API_KEY` slot is already there). **Safety:** the AI only adds judgement fields — it never edits the company, salary, or apply URL, so links can never be hallucinated. If the key is missing or the AI call fails, jobs pass through unchanged (`source: "adzuna"` instead of `"adzuna+ai"`).

---

## When the site is live (Netlify) — auto-deploy is now wired

The repo is on GitHub, so the live site can update itself daily. Flow:

1. Connect the GitHub repo (`m6646430-jpg/DriftAI`) in Netlify → **Add new site → Import from Git**. `netlify.toml` already sets the publish settings.
2. The daily job runs **`scripts/daily-update.sh`**, which:
   - fetches fresh CA/USA jobs,
   - commits `data/jobs.json` **only if it changed**,
   - pushes to the deploy branch → **Netlify auto-redeploys**.

Run it manually any time:
```bash
bash scripts/daily-update.sh
```

The launchd plist (`com.driftai.jobs.plist`) now runs this wrapper at 6 AM daily, so once your keys are in it and it's loaded, the live site refreshes its own job board every morning — no manual steps.

> By default the script pushes to `main`. While testing on the `july-2026` branch, run it with `DRIFTAI_DEPLOY_BRANCH=july-2026 bash scripts/daily-update.sh`.
