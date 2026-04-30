// GET /api/events/:id/bookings — list which slots are claimed for an event.
//
// Privacy: names are not exposed publicly. The response only signals
// that a slot is taken (and when), not who took it. Each browser
// remembers its own booked names locally and renders them client-side.

export async function onRequestGet({ params, env }) {
  const id = params.id;
  const prefix = `booking:${id}:`;
  const list = await env.TCA_SIGNUPS.list({ prefix });

  const bookings = {};
  for (const { name: kvKey } of list.keys) {
    // kvKey format: booking:<event_id>:<date>:<time>
    const rest = kvKey.slice(prefix.length);
    const sep = rest.indexOf(":");
    if (sep === -1) continue;
    const date = rest.slice(0, sep);
    const time = rest.slice(sep + 1);
    bookings[`${date}|${time}`] = { claimed: true };
  }

  return new Response(JSON.stringify({ bookings }), {
    headers: { "content-type": "application/json" },
  });
}
