// GET /api/events/:id/ics?date=&time=&bookingId= — download a calendar invite
// for a specific booking. The bookingId acts as proof the request is from
// the person who claimed the slot (we don't expose ICS for bookings the
// caller can't identify).

import { buildIcs, isValidDate, isValidTime, json } from "../../../_lib.js";

export async function onRequestGet({ request, params, env }) {
  const id = params.id;
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") || "").trim();
  const time = (url.searchParams.get("time") || "").trim();
  const bookingId = (url.searchParams.get("bookingId") || "").trim();

  if (!isValidDate(date)) return json({ error: "invalid_date" }, 400);
  if (!isValidTime(time)) return json({ error: "invalid_time" }, 400);
  if (!/^[a-f0-9]{8,64}$/.test(bookingId)) return json({ error: "invalid_booking_id" }, 400);

  const eventRaw = await env.TCA_SIGNUPS.get(`event:${id}`);
  if (!eventRaw) return json({ error: "event_not_found" }, 404);
  const event = JSON.parse(eventRaw);

  // Try multi-key first, then single-key (capacity-1).
  let bookingRaw = await env.TCA_SIGNUPS.get(`booking:${id}:${date}:${time}:${bookingId}`);
  if (!bookingRaw) {
    const singleRaw = await env.TCA_SIGNUPS.get(`booking:${id}:${date}:${time}`);
    if (singleRaw) {
      try {
        const parsed = JSON.parse(singleRaw);
        if (parsed && parsed.id === bookingId) bookingRaw = singleRaw;
      } catch {}
    }
  }
  if (!bookingRaw) return json({ error: "booking_not_found" }, 404);
  const booking = JSON.parse(bookingRaw);

  const ics = buildIcs({
    uid: booking.id,
    title: event.title,
    description: event.description,
    location: event.location,
    date,
    time,
    durationMinutes: event.slotDurationMinutes || 30,
  });

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${id}.ics"`,
    },
  });
}
