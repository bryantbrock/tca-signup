#!/usr/bin/env node
// Seed an event by POSTing it to /api/events.
//
// Usage:
//   ADMIN_TOKEN=<token> node seed.js
//   ADMIN_TOKEN=<token> node seed.js --base http://localhost:8788
//
// The script seeds the initial video-shoot-2026 event. To seed a different
// event, edit the `event` object below or pass a JSON path:
//   ADMIN_TOKEN=<token> node seed.js --file my-event.json

const fs = require("fs");

const args = process.argv.slice(2);
let base = process.env.TCA_SIGNUP_BASE || "https://tca-signup.pages.dev";
let file = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base") { base = args[++i]; continue; }
  if (args[i] === "--file") { file = args[++i]; continue; }
}

const adminToken = process.env.ADMIN_TOKEN;
if (!adminToken) {
  console.error("Set ADMIN_TOKEN env var to the master admin secret.");
  process.exit(1);
}

const defaultEvent = {
  id: "video-shoot-2026",
  title: "TCA Video Shoot",
  description:
    "Grab a 20-minute slot for your video interview. Wear solid earth tones, no logos or patterns.",
  slotDurationMinutes: 20,
  location: "Trinity Classical Academy, Birmingham AL",
  host: "Bryant Brock",
  contactEmail: "bryant@brock.software",
  captureEmail: false,
  dates: [
    { date: "2026-05-14", label: "Wednesday, May 14" },
    { date: "2026-05-21", label: "Wednesday, May 21" },
  ],
  slots: [
    { time: "16:00", label: "4:00 PM", capacity: 1 },
    { time: "16:20", label: "4:20 PM", capacity: 1 },
    { time: "16:40", label: "4:40 PM", capacity: 1 },
    { time: "17:00", label: "5:00 PM", capacity: 1 },
    { time: "17:20", label: "5:20 PM", capacity: 1 },
    { time: "17:40", label: "5:40 PM", capacity: 1 },
  ],
};

const event = file ? JSON.parse(fs.readFileSync(file, "utf8")) : defaultEvent;

(async () => {
  console.log(`Seeding ${event.id} at ${base}...`);
  const res = await fetch(`${base}/api/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(event),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (res.status === 201) {
    console.log(`Created event ${event.id}.`);
    console.log(`Public URL: ${base}/${event.id}`);
    if (data.event && data.event.adminToken) {
      console.log(`Admin URL:  ${base}/${event.id}/admin?token=${data.event.adminToken}`);
      console.log(`(Save the admin URL — the token won't be shown again.)`);
    }
    return;
  }
  if (res.status === 409) {
    console.log(`Event ${event.id} already exists. Skipping create.`);
    console.log(`Public URL: ${base}/${event.id}`);
    return;
  }
  console.error(`Unexpected response ${res.status}:`, data);
  process.exit(1);
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
