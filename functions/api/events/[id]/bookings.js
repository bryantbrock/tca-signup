// GET /api/events/:id/bookings — list all bookings for an event.

export async function onRequestGet({ params, env }) {
  const id = params.id;
  const prefix = `booking:${id}:`;
  const list = await env.TCA_SIGNUPS.list({ prefix });

  const bookings = {};
  await Promise.all(
    list.keys.map(async ({ name }) => {
      const raw = await env.TCA_SIGNUPS.get(name);
      if (!raw) return;
      // key format: booking:<event_id>:<date>:<time>
      const rest = name.slice(prefix.length);
      const sep = rest.indexOf(":");
      if (sep === -1) return;
      const date = rest.slice(0, sep);
      const time = rest.slice(sep + 1);
      try {
        bookings[`${date}|${time}`] = JSON.parse(raw);
      } catch {
        // skip malformed entries
      }
    }),
  );

  return new Response(JSON.stringify({ bookings }), {
    headers: { "content-type": "application/json" },
  });
}
