// GET /api/events/:id/bookings — claim counts per slot.
//
// Privacy: never exposes claimant names. Returns only how many spots are
// taken in each (date,time) cell, which lets the client render
// "X/Y claimed" for capacity > 1 slots and grey-out fully booked cells.

import { json } from "../../../_lib.js";

export async function onRequestGet({ params, env }) {
  const id = params.id;
  const prefix = `booking:${id}:`;
  const bookings = {};

  // Pages KV list returns up to 1000 keys per request and supports cursor paging.
  let cursor;
  do {
    const page = await env.TCA_SIGNUPS.list({ prefix, cursor });
    for (const { name: kvKey } of page.keys) {
      // Two formats:
      //   booking:<event>:<date>:<HH>:<MM>            (single-key, capacity 1)
      //   booking:<event>:<date>:<HH>:<MM>:<bookingId> (multi-key, capacity > 1)
      const rest = kvKey.slice(prefix.length);
      const parts = rest.split(":");
      if (parts.length !== 3 && parts.length !== 4) continue;
      const date = parts[0];
      const time = `${parts[1]}:${parts[2]}`;
      const slotKey = `${date}|${time}`;
      bookings[slotKey] = bookings[slotKey] || { claimed: 0 };
      bookings[slotKey].claimed += 1;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return json({ bookings });
}
