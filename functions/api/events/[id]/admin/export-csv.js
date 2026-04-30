// GET /api/events/:id/admin/export-csv?token=<adminToken> — CSV download.

import { json } from "../../../../_lib.js";

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
  const rows = [["date", "time", "name", "email", "claimed_at", "booking_id"]];
  let cursor;
  do {
    const page = await env.TCA_SIGNUPS.list({ prefix, cursor });
    for (const { name: kvKey } of page.keys) {
      const raw = await env.TCA_SIGNUPS.get(kvKey);
      if (!raw) continue;
      const rest = kvKey.slice(prefix.length);
      const parts = rest.split(":");
      if (parts.length !== 3 && parts.length !== 4) continue;
      const date = parts[0];
      const time = `${parts[1]}:${parts[2]}`;
      try {
        const b = JSON.parse(raw);
        const bookingId = parts.length === 4 ? parts[3] : (b.id || "");
        rows.push([
          date,
          time,
          b.name || "",
          b.email || "",
          b.claimedAt || "",
          bookingId,
        ]);
      } catch {
        // skip
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  // Sort by date+time ascending for organizer convenience (header row first).
  const header = rows[0];
  const body = rows.slice(1).sort((a, b) => {
    const ad = `${a[0]} ${a[1]}`;
    const bd = `${b[0]} ${b[1]}`;
    return ad.localeCompare(bd);
  });

  const csv = [header, ...body]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${id}-bookings.csv"`,
    },
  });
}

function csvCell(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
