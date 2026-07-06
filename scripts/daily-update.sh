#!/usr/bin/env bash
#
# DriftAI — daily job refresh + auto-deploy
# Fetches fresh Canada/USA jobs, and if the board actually changed,
# commits and pushes data/jobs.json. Netlify then auto-redeploys the live site.
#
# Run manually:   bash scripts/daily-update.sh
# Or via launchd (see com.driftai.jobs.plist) every morning.
#
# Requires the same env vars as the fetcher:
#   ADZUNA_APP_ID, ADZUNA_APP_KEY, and optionally OPENROUTER_API_KEY.

set -euo pipefail

# Always run from the repo root, wherever this script is called from.
cd "$(dirname "$0")/.."

# Which branch Netlify deploys from (change to "july-2026" while testing).
DEPLOY_BRANCH="${DRIFTAI_DEPLOY_BRANCH:-main}"

echo "▶ DriftAI daily update — $(date '+%Y-%m-%d %H:%M')"

# 1. Fetch fresh jobs (safe: leaves jobs.json untouched if keys/API fail).
node scripts/fetch-jobs.js

# 2. Only commit + push if the job data actually changed.
if git diff --quiet -- data/jobs.json; then
  echo "✔ No job changes today — nothing to deploy."
  exit 0
fi

git add data/jobs.json
git commit -m "chore: daily job refresh $(date '+%Y-%m-%d')"
git push origin "HEAD:${DEPLOY_BRANCH}"
echo "✅ Pushed job update to ${DEPLOY_BRANCH} — Netlify will redeploy."
