# DriftAI

Canada/USA-focused resume marketing & AI job-application service. Static site + a daily job pipeline.

## Site pages
- `index.html` — homepage
- `jobs.html` — free job board (Canada + USA, updated daily)
- `community.html` — $9.99/mo community membership
- `resume-services.html` — human-written resume packages
- `jobhunt.html` — done-for-you application tiers
- `admin.html` — private command-center dashboard (unlinked, `noindex`)

## Run locally
```bash
npx serve -p 4200
```
Then open http://localhost:4200

## Daily job pipeline
Real jobs from the Adzuna free API, optionally AI-curated via OpenRouter.
See **[DASHBOARD-AND-JOBS-README.md](DASHBOARD-AND-JOBS-README.md)** for full setup.

```bash
node scripts/fetch-jobs.js   # writes data/jobs.json
```

## Stack
Static HTML/CSS/JS · Stripe Payment Links · Node (job fetcher) · Adzuna API + OpenRouter (AI curation)
