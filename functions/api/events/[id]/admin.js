// GET /api/events/:id/admin?token=<adminToken> — full booking data for organizers.
//
// The token is the per-event adminToken stamped at creation time. Returns
// the public event plus a flat list of bookings with names, emails, and
// timestamps.

import { json } from "../../../_lib.js";

export async function onRequestGet({ request, params, env }) {
  const id = params.id;
  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim();

  const eventRaw = await env.TCA_SIGNUPS.get(`event:${id}`);
  if (!eventRaw) return json({ error: "event_not_found" }, 404);
  const event = JSON.parse(eventRaw);

  if (!event.adminToken || token !== event.adminToken) {
    return json({ error: "unauthorized" }, 401);
  }

  const prefix = `booking:${id}:`;
  const bookings = [];
  let cursor;
  do {
    const page = await env.TCA_SIGNUPS.list({ prefix, cursor });
    for (const { name: kvKey } of page.keys) {
      const raw = await env.TCA_SIGNUPS.get(kvKey);
      if (!raw) continue;
      const rest = kvKey.slice(prefix.length);
      const parts = rest.split(":");
      // single-key: 3 parts; multi-key: 4 parts.
      if (parts.length !== 3 && parts.length !== 4) continue;
      const date = parts[0];
      const time = `${parts[1]}:${parts[2]}`;
      try {
        const b = JSON.parse(raw);
        const bookingId = parts.length === 4 ? parts[3] : b.id;
        bookings.push({ date, time, bookingId, ...b });
      } catch {
        // skip malformed
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  // Sort newest first.
  bookings.sort((a, b) => (b.claimedAt || "").localeCompare(a.claimedAt || ""));

  return json({ event, bookings });
}
