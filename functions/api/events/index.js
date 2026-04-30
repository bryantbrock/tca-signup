// POST /api/events — create a new event.
// Body: full Event JSON (must include `id`).

export async function onRequestPost({ request, env }) {
  let event;
  try {
    event = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!event || typeof event.id !== "string" || !event.id.match(/^[a-z0-9-]+$/)) {
    return json({ error: "invalid_id", message: "id must be lowercase alphanumeric with dashes" }, 400);
  }
  if (!Array.isArray(event.dates) || !Array.isArray(event.slots)) {
    return json({ error: "invalid_shape", message: "dates and slots must be arrays" }, 400);
  }

  const key = `event:${event.id}`;
  const existing = await env.TCA_SIGNUPS.get(key);
  if (existing) {
    return json({ error: "exists", message: `event ${event.id} already exists` }, 409);
  }

  await env.TCA_SIGNUPS.put(key, JSON.stringify(event));
  return json({ ok: true, id: event.id }, 201);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
