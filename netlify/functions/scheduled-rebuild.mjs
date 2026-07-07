// DriftAI — Netlify Scheduled Function
// Runs on Netlify's servers (NOT your Mac) twice a day and triggers a site
// rebuild. The rebuild runs the Gemini job fetch (see netlify.toml build
// command), so the job board refreshes automatically in the cloud.
//
// Requires one env var: BUILD_HOOK_URL (a Netlify build hook you create once).

export const config = {
  // Netlify cron is UTC. 14:00 & 18:00 UTC = 9 AM & 1 PM EST.
  // (During EDT/summer this lands at 10 AM & 2 PM — cron doesn't shift for DST.)
  schedule: "0 14,18 * * *",
};

export default async () => {
  const hook = process.env.BUILD_HOOK_URL;
  if (!hook) {
    console.error("BUILD_HOOK_URL is not set — cannot trigger rebuild.");
    return new Response("BUILD_HOOK_URL not configured", { status: 500 });
  }
  const res = await fetch(hook, { method: "POST" });
  console.log(`Triggered Netlify rebuild — status ${res.status}`);
  return new Response("Rebuild triggered");
};
