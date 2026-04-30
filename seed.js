#!/usr/bin/env node
// Seed the initial video shoot event.
//
// Usage:
//   node seed.js                            # seeds production deployment
//   node seed.js --base http://localhost:8788  # seeds local `wrangler pages dev`
//
// The script POSTs to /api/events. If the event already exists, the create
// returns 409 and the script reports it as already seeded.

const args = process.argv.slice(2);
let base = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base") {
    base = args[i + 1];
    i++;
  }
}

if (!base) {
  base = process.env.TCA_SIGNUP_BASE || "https://tca-signup.pages.dev";
}

const event = {
  id: "video-shoot-2026",
  title: "TCA Video Shoot",
  description:
    "Grab a 20-minute slot for your video interview. Wear solid earth tones, no logos or patterns.",
  slotDurationMinutes: 20,
  dates: [
    { date: "2026-05-14", label: "Wednesday, May 14" },
    { date: "2026-05-21", label: "Wednesday, May 21" },
  ],
  slots: [
    { time: "16:00", label: "4:00 PM" },
    { time: "16:20", label: "4:20 PM" },
    { time: "16:40", label: "4:40 PM" },
    { time: "17:00", label: "5:00 PM" },
    { time: "17:20", label: "5:20 PM" },
    { time: "17:40", label: "5:40 PM" },
  ],
};

async function main() {
  console.log(`Seeding ${event.id} at ${base}...`);
  const res = await fetch(`${base}/api/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (res.status === 201) {
    console.log(`Created event ${event.id}.`);
    console.log(`Event URL: ${base}/${event.id}`);
    return;
  }
  if (res.status === 409) {
    console.log(`Event ${event.id} already exists. Skipping.`);
    console.log(`Event URL: ${base}/${event.id}`);
    return;
  }
  console.error(`Unexpected response ${res.status}:`, data);
  process.exit(1);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
