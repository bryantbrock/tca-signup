// Pages middleware: redirect / to the configured "active" event id, if any.
// The active event id is stored in KV as `meta:active-event`.

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Only intercept root path.
  if (url.pathname !== "/") {
    return context.next();
  }

  const active = await context.env.TCA_SIGNUPS.get("meta:active-event");
  if (active) {
    return Response.redirect(`${url.origin}/${active}`, 302);
  }

  // No active event configured — fall through to index.html, which handles
  // the "no event selected" message when it can't resolve an event id.
  return context.next();
}
