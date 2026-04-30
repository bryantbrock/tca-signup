// POST /api/events/:id/book — claim a slot.
// Body: { date, time, name }

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
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!date || !time || !name) {
    return json({ error: "missing_fields", message: "date, time, and name are required" }, 400);
  }
  if (name.length > 80) {
    return json({ error: "name_too_long" }, 400);
  }

  // Verify event exists and the slot is part of its config.
  const eventRaw = await env.TCA_SIGNUPS.get(`event:${id}`);
  if (!eventRaw) {
    return json({ error: "event_not_found" }, 404);
  }
  let event;
  try {
    event = JSON.parse(eventRaw);
  } catch {
    return json({ error: "event_corrupt" }, 500);
  }
  const validDate = Array.isArray(event.dates) && event.dates.some((d) => d.date === date);
  const validTime = Array.isArray(event.slots) && event.slots.some((s) => s.time === time);
  if (!validDate || !validTime) {
    return json({ error: "invalid_slot" }, 400);
  }

  const key = `booking:${id}:${date}:${time}`;

  // Check for existing booking — KV is eventually consistent, so a
  // simultaneous double-book can still slip through; we treat the second
  // write as a soft conflict and prefer the earliest claimedAt.
  const existing = await env.TCA_SIGNUPS.get(key);
  if (existing) {
    let parsed;
    try {
      parsed = JSON.parse(existing);
    } catch {
      parsed = null;
    }
    return json(
      {
        error: "already_booked",
        booking: parsed,
      },
      409,
    );
  }

  const booking = {
    name,
    claimedAt: new Date().toISOString(),
  };
  await env.TCA_SIGNUPS.put(key, JSON.stringify(booking));

  return json({ ok: true, booking }, 201);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
