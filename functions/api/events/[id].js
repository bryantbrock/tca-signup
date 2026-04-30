// GET /api/events/:id — return public event config (adminToken stripped).

import { json, publicEvent } from "../../_lib.js";

export async function onRequestGet({ params, env }) {
  const raw = await env.TCA_SIGNUPS.get(`event:${params.id}`);
  if (!raw) return json({ error: "not_found" }, 404);
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "event_corrupt" }, 500);
  }
  return json(publicEvent(event));
}
