# DriftAI Auto-Apply — Chrome Extension (MVP v0.1)

Auto-fills job applications on **Greenhouse, Lever, and Ashby** from a saved
profile. It **never submits** — you attach your resume, review, and click Submit
yourself. This runs in *your own browser* (not a server bot), so applications
are genuinely user-initiated.

## Load it (developer / unpacked)
1. Open Chrome → go to `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** → select this `extension/` folder
4. The DriftAI icon appears in your toolbar

## Use it
1. Click the toolbar icon → **Edit my profile** → fill it in once → Save
2. Open any job application on Greenhouse / Lever / Ashby
   (e.g. a `boards.greenhouse.io/…`, `jobs.lever.co/…`, or `jobs.ashbyhq.com/…` apply page)
3. A **DriftAI panel** appears bottom-right → click **⚡ Fill this application**
4. **Attach your resume**, review everything, and **Submit** yourself

## What it fills
First/last name, email, phone, LinkedIn, GitHub, website, city, and
work-authorization / sponsorship yes-no questions. It matches fields by their
label / name / placeholder, so it adapts across the 3 ATSes.

## What it deliberately does NOT do
- **No auto-submit** — the human always clicks Submit (legal, user-initiated).
- **No resume file attach** — browsers block extensions from setting file
  inputs (a good security rule); you attach the PDF yourself.
- **No CAPTCHA/bot-detection bypass.**

## Roadmap
- Pull the profile + tailored resume straight from the DriftAI account (Supabase)
- More ATSes (Workday, iCIMS)
- Per-job tailored-resume download button inside the panel
- Publish to the Chrome Web Store
