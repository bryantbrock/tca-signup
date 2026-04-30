// POST /api/events/:id/unbook — release a booking.
// Body: { date, time, bookingId }
//
// Knowledge of the bookingId is the proof of ownership (it was returned to
// the client when the booking was created and stored in localStorage).

import { json, isValidDate, isValidTime } from "../../../_lib.js";

export async function onRequestPost({ request, params, env }) {
  const id = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";

  if (!isValidDate(date)) return json({ error: "invalid_date" }, 400);
  if (!isValidTime(time)) return json({ error: "invalid_time" }, 400);
  if (!bookingId || !/^[a-f0-9]{8,64}$/.test(bookingId)) {
    return json({ error: "invalid_booking_id" }, 400);
  }

  // Try the multi-key form first (capacity-N slots).
  const multiKey = `booking:${id}:${date}:${time}:${bookingId}`;
  const multiRaw = await env.TCA_SIGNUPS.get(multiKey);
  if (multiRaw) {
    await env.TCA_SIGNUPS.delete(multiKey);
    return json({ ok: true });
  }

  // Otherwise check the canonical single-key form (capacity-1 slots).
  // The booker's id must match the stored id to be allowed to cancel.
  const singleKey = `booking:${id}:${date}:${time}`;
  const singleRaw = await env.TCA_SIGNUPS.get(singleKey);
  if (singleRaw) {
    try {
      const parsed = JSON.parse(singleRaw);
      if (parsed && parsed.id === bookingId) {
        await env.TCA_SIGNUPS.delete(singleKey);
        return json({ ok: true });
      }
      return json({ error: "wrong_booking_id" }, 403);
    } catch {
      // corrupt entry — let the user delete it
      await env.TCA_SIGNUPS.delete(singleKey);
      return json({ ok: true });
    }
  }

  // Idempotent: nothing to delete.
  return json({ ok: true, alreadyGone: true });
}
