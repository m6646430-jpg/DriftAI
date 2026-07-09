# 🚀 DriftAI Launch Checklist

Everything left to do before going live. The **code is done** — these are the
dashboard/config steps only you can do (Stripe, Netlify, Supabase, WhatsApp),
then the final deploy.

Work top to bottom. Check items off as you go: `- [x]`.

---

## 🔐 A. Security first (do these before anything else)

Two secrets were pasted in chat during setup and must be rotated:

- [ ] **Rotate the Gemini API key** — Google AI Studio → API keys → delete the
      old one, create a new one → paste into `scripts/.env` as
      `GEMINI_API_KEY=...` (this file is gitignored — never commit it) **and**
      into Netlify env vars (see section C).
- [ ] **Rotate the Google OAuth Client Secret** — Google Cloud Console →
      Credentials → your OAuth client → reset secret → update it in Supabase
      (Auth → Providers → Google).

> The Supabase **anon key** in `js/auth.js` is public-by-design (safe in the
> browser, protected by row-level security) — no need to rotate it.

---

## 💳 B. Stripe

- [ ] **Confirm all Payment Links are LIVE mode**, not Test/Sandbox. In Test
      mode no real money moves. Toggle is top-right of the Stripe dashboard.
- [ ] **Create the 2 missing budget-tier links** (one-time):
  - [ ] Student / Entry — **$29.99 USD** → paste URL into `js/main.js` → `resume_entry`
  - [ ] Mid-Level — **$39.99 USD** → paste URL into `js/main.js` → `resume_mid`
  > Until these exist, those two buttons do nothing (`#`). The other 5 already work.
- [ ] **Set each link's success/redirect URL** so buyers land on the intake page
      with their service pre-filled:

  | Package | Redirect URL |
  |---|---|
  | Student / Entry | `https://driftai.info/order.html?plan=resume_entry` |
  | Mid-Level | `https://driftai.info/order.html?plan=resume_mid` |
  | Resume Only | `https://driftai.info/order.html?plan=resume_only` |
  | Resume + Cover Letter | `https://driftai.info/order.html?plan=resume_rewrite` |
  | Complete Package | `https://driftai.info/order.html?plan=resume_complete` |
  | Job Hunt Program | `https://driftai.info/order.html?plan=jobhunt` |
  | Community | `https://driftai.info/order.html?plan=community` |

- [ ] **Turn on payment email alerts** — Settings → Notifications →
      "Successful payments."
- [ ] **Install the Stripe mobile app** and enable push (buzzes on every sale).

---

## 🌐 C. Netlify

- [ ] **Environment variables** (Site configuration → Environment variables):
  - [ ] `GEMINI_API_KEY` = your rotated Gemini key (powers resume score + tailoring)
  - [ ] `BUILD_HOOK_URL` = your build hook URL (see next item)
- [ ] **Create a build hook** — Site configuration → Build & deploy → Build
      hooks → add one → copy the URL into `BUILD_HOOK_URL` above. (This is what
      the twice-daily scheduled function pings to refresh the job board.)
- [ ] **Confirm the build command** runs the job fetcher
      (`node scripts/fetch-jobs-ats.js`) so jobs regenerate on every deploy.
- [ ] **Form email notifications** — Forms → Notifications → add an email
      notification to **support@driftai.info** for **all three** forms:
  - [ ] `contact`
  - [ ] `reviews`
  - [ ] `order-details`
  > Miss one and those submissions silently collect in the Forms tab with no email.

---

## 👤 D. Accounts / Supabase (auth)

- [ ] **URL configuration** — Supabase → Authentication → URL Configuration →
      add `https://driftai.info` and `https://driftai.info/members.html` to the
      redirect allow-list (so Google/GitHub login returns correctly in prod).
- [ ] **Email confirmation** — decide: keep "Confirm email" ON (users must
      verify) or turn OFF for frictionless signup. (Auth → Providers → Email.)
- [ ] **Do one real Google login test** on the live site after deploy.
- [ ] **Do one real GitHub login test** on the live site after deploy.

---

## 💬 E. WhatsApp Business (+1 647-495-3399)

- [ ] Install **WhatsApp Business** app on the phone with that number.
- [ ] Set **profile**: name (DriftAI), category, description, email, website.
- [ ] Upload **profile picture** — `brand/profile-pic.png`.
- [ ] Set **greeting message** (welcome menu) and **away message**.
- [ ] Add **quick replies**: `/pricing`, `/resume`, `/apply`, `/score`,
      `/countries`, `/pay` — with their images from the `brand/` folder.
- [ ] (Optional) Build the **catalog** with your 5 paid services.
- [ ] **Test**: from a different phone, open `https://wa.me/16474953399` and
      confirm the greeting fires.

---

## 🖼️ F. Brand assets to upload (already generated, in `brand/`)

- [ ] `profile-pic.png` → WhatsApp + Instagram + TikTok + LinkedIn + YouTube avatars
- [ ] `card-pricing.png`, `card-resume.png`, `card-apply.png`, `card-score.png`,
      `card-countries.png`, `card-pay.png` → attach to the matching WhatsApp quick replies

---

## 🚢 G. Deploy

- [ ] Final review of everything on `dev` (local preview).
- [ ] Merge `dev` → `main` (this triggers the live Netlify deploy).
  ```
  cd resume-marketing-site
  git checkout main && git merge dev && git push origin main
  git checkout dev
  ```
  > A dated backup of every push also lives on the `build-2026-07-08` branch.

---

## ✅ H. Post-launch smoke test (on driftai.info)

- [ ] Free resume score — upload a PDF, get a real score
- [ ] Tailor Resume — open a job, upload a resume, confirm it tailors to the JD
- [ ] Job board loads with real apply links (click one → goes to the real posting)
- [ ] Buy the cheapest tier yourself ($9.99 Community) → confirm:
  - [ ] Stripe emails you
  - [ ] You're redirected to `order.html` with the service pre-filled
  - [ ] The intake form emails you the details
- [ ] Submit a test review → confirm it emails you
- [ ] Google + GitHub login work
- [ ] WhatsApp button (nav + footer + score result) opens a chat to your number
- [ ] Check the site on your phone (mobile layout)

---

## 📝 Notes for future-you

- **INR prices are hardcoded** at ~₹83.5/$ in `resume-services.html`,
  `community.html`, and `jobhunt.html` (the `data-inr` attributes). If the
  rupee moves a lot, update those numbers. India visitors are detected by
  browser timezone (`Asia/Kolkata`); billing is always USD.
- **Job board** refreshes on every deploy + twice daily via the scheduled
  function. Add more companies in `scripts/fetch-jobs-ats.js` (the `COMPANIES`
  array).
- **Reviews** are manual: paste approved review cards into `#reviewsGrid` in
  `reviews.html` (template is in the file as a comment).
- **Never push `main` casually** — each deploy uses Netlify build credits.
