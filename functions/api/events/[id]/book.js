// POST /api/events/:id/book — claim a slot.
// Body: { date, time, name, email? }
//
// Returns: { ok, bookingId, booking, icsUrl }.
// The bookingId is the cancellation token; the client must store it
// (localStorage) to be able to cancel later.

import {
  json,
  generateId,
  isValidDate,
  isValidTime,
  looksLikeEmail,
  sendEmail,
  buildIcs,
} from "../../../_lib.js";

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
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!isValidDate(date)) return json({ error: "invalid_date" }, 400);
  if (!isValidTime(time)) return json({ error: "invalid_time" }, 400);
  if (!name) return json({ error: "name_required" }, 400);
  if (name.length > 80) return json({ error: "name_too_long" }, 400);
  if (email && !looksLikeEmail(email)) return json({ error: "invalid_email" }, 400);

  const eventRaw = await env.TCA_SIGNUPS.get(`event:${id}`);
  if (!eventRaw) return json({ error: "event_not_found" }, 404);
  let event;
  try {
    event = JSON.parse(eventRaw);
  } catch {
    return json({ error: "event_corrupt" }, 500);
  }

  if (!Array.isArray(event.dates) || !event.dates.some((d) => d.date === date)) {
    return json({ error: "invalid_date" }, 400);
  }
  const slot = Array.isArray(event.slots) && event.slots.find((s) => s.time === time);
  if (!slot) return json({ error: "invalid_time" }, 400);

  if (event.captureEmail && !email) {
    return json({ error: "email_required" }, 400);
  }

  const capacity = Number.isInteger(slot.capacity) && slot.capacity >= 1 ? slot.capacity : 1;

  const bookingId = generateId(16);
  const booking = {
    id: bookingId,
    name,
    email: email || undefined,
    claimedAt: new Date().toISOString(),
  };

  // Capacity-1 slots use a single canonical key. KV.get is strongly
  // consistent on the writing edge, so the existence check here actually
  // prevents double-booking (within that edge's coherence window).
  //
  // Capacity-N slots use multi-key under a prefix. KV.list is eventually
  // consistent (~60s), so the count check is best-effort: at the last
  // spot, two simultaneous claims can both succeed. Acceptable for school
  // signup volumes; document via README.
  if (capacity === 1) {
    const key = `booking:${id}:${date}:${time}`;
    const existing = await env.TCA_SIGNUPS.get(key);
    if (existing) return json({ error: "already_booked" }, 409);
    await env.TCA_SIGNUPS.put(key, JSON.stringify(booking));
  } else {
    const slotPrefix = `booking:${id}:${date}:${time}:`;
    const list = await env.TCA_SIGNUPS.list({ prefix: slotPrefix });
    if (list.keys.length >= capacity) {
      return json({ error: "already_booked" }, 409);
    }
    await env.TCA_SIGNUPS.put(`${slotPrefix}${bookingId}`, JSON.stringify(booking));
  }

  // Best-effort emails. We don't await — Pages keeps the worker alive long
  // enough for short fetches. If RESEND_API_KEY is unset, sendEmail no-ops.
  fireEmails({ env, event, booking, date, time, slot }).catch(() => {});

  return json(
    {
      ok: true,
      bookingId,
      booking: { name, email: email || undefined, claimedAt: booking.claimedAt },
      icsUrl: `/api/events/${encodeURIComponent(id)}/ics?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&bookingId=${encodeURIComponent(bookingId)}`,
    },
    201,
  );
}

async function fireEmails({ env, event, booking, date, time, slot }) {
  const slotLabel = (slot.label || time);
  const dateRow = (event.dates || []).find((d) => d.date === date);
  const dateLabel = (dateRow && dateRow.label) || date;
  const subject = `[${event.title}] ${booking.name} signed up — ${dateLabel} at ${slotLabel}`;

  // Organizer notification.
  if (event.contactEmail) {
    const lines = [
      `${booking.name} just claimed a slot.`,
      ``,
      `Event: ${event.title}`,
      `When: ${dateLabel} at ${slotLabel}`,
      booking.email ? `Email: ${booking.email}` : null,
      event.location ? `Location: ${event.location}` : null,
      ``,
      `Manage signups: https://tca-signup.pages.dev/${event.id}/admin?token=${event.adminToken}`,
    ].filter(Boolean);
    await sendEmail({
      env,
      to: event.contactEmail,
      subject,
      text: lines.join("\n"),
    });
  }

  // Attendee confirmation with .ics attachment.
  if (booking.email) {
    const ics = buildIcs({
      uid: booking.id,
      title: event.title,
      description: event.description,
      location: event.location,
      date,
      time,
      durationMinutes: event.slotDurationMinutes || 30,
    });
    const icsB64 = btoa(unescape(encodeURIComponent(ics)));
    const html = renderConfirmHtml({ event, booking, dateLabel, slotLabel });
    await sendEmail({
      env,
      to: booking.email,
      subject: `You're signed up: ${event.title}`,
      html,
      text: `You're confirmed for ${event.title} on ${dateLabel} at ${slotLabel}. Calendar invite attached.`,
      attachments: [
        {
          filename: `${event.id}.ics`,
          content: icsB64,
        },
      ],
    });
  }
}

function renderConfirmHtml({ event, booking, dateLabel, slotLabel }) {
  const esc = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html>
<html><body style="font-family:Georgia,serif;color:#003622;background:#fbf5e3;padding:32px;">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-top:4px solid #dea06d;">
  <h1 style="font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;margin:0 0 8px;">You're signed up</h1>
  <p style="margin:0 0 24px;font-style:italic;color:#a97142;">${esc(event.title)}</p>
  <p>Hi ${esc(booking.name)},</p>
  <p>Your spot is reserved for <strong>${esc(dateLabel)} at ${esc(slotLabel)}</strong>.</p>
  ${event.location ? `<p><strong>Where:</strong> ${esc(event.location)}</p>` : ""}
  ${event.description ? `<p>${esc(event.description)}</p>` : ""}
  <p style="color:rgba(0,54,34,0.6);font-size:14px;margin-top:32px;">A calendar invite is attached to this email.</p>
</div>
</body></html>`;
}
