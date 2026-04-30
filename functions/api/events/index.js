// POST /api/events — create a new event.
//
// Auth: requires `Authorization: Bearer <ADMIN_TOKEN>` matching env.ADMIN_TOKEN.
// Body: full Event JSON (must include `id`, `title`, `dates`, `slots`).
//
// On success, returns the created event including the per-event `adminToken`
// the caller should save (URL: /<id>/admin?token=<adminToken>).

import { json, generateId, isValidEventId, bearerToken, isValidDate, isValidTime } from "../../_lib.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_TOKEN) {
    return json({ error: "admin_not_configured" }, 503);
  }
  if (bearerToken(request) !== env.ADMIN_TOKEN) {
    return json({ error: "unauthorized" }, 401);
  }

  let event;
  try {
    event = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!event || !isValidEventId(event.id)) {
    return json(
      { error: "invalid_id", message: "id must be lowercase alphanumeric with dashes; 'admin', 'api', and 'new' are reserved" },
      400,
    );
  }
  if (typeof event.title !== "string" || !event.title.trim()) {
    return json({ error: "invalid_title" }, 400);
  }
  if (!Array.isArray(event.dates) || event.dates.length === 0) {
    return json({ error: "invalid_dates" }, 400);
  }
  for (const d of event.dates) {
    if (!d || !isValidDate(d.date)) return json({ error: "invalid_date_format", date: d }, 400);
  }
  if (!Array.isArray(event.slots) || event.slots.length === 0) {
    return json({ error: "invalid_slots" }, 400);
  }
  for (const s of event.slots) {
    if (!s || !isValidTime(s.time)) return json({ error: "invalid_slot_format", slot: s }, 400);
    if (s.capacity !== undefined && (!Number.isInteger(s.capacity) || s.capacity < 1)) {
      return json({ error: "invalid_capacity", slot: s }, 400);
    }
  }

  const key = `event:${event.id}`;
  const existing = await env.TCA_SIGNUPS.get(key);
  if (existing) {
    return json({ error: "exists", message: `event ${event.id} already exists` }, 409);
  }

  // Stamp server-side fields.
  event.adminToken = generateId(16);
  event.createdAt = new Date().toISOString();

  await env.TCA_SIGNUPS.put(key, JSON.stringify(event));
  return json({ ok: true, event }, 201);
}
