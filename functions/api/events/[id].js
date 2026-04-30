// GET /api/events/:id — return event config.

export async function onRequestGet({ params, env }) {
  const id = params.id;
  const raw = await env.TCA_SIGNUPS.get(`event:${id}`);
  if (!raw) {
    return json({ error: "not_found" }, 404);
  }
  return new Response(raw, {
    headers: { "content-type": "application/json" },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
