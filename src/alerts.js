// Alerts: decides who needs telling about what, and writes the emails.
//
// Each kind of event has a mode, chosen on the Settings page:
//   "now"     email as soon as it is noticed (within 30 minutes)
//   "summary" no email of its own; it appears in the morning summary
//   "off"     never mentioned
// Everything found in one run goes out as a single email.

import { loadSettings, getMeta, setMeta } from "./settings.js";

export const ATTENTION = ["customs", "problem", "stalled", "notfound"];

export const STATE_LABEL = {
  customs: "Customs hold",
  problem: "Problem",
  stalled: "Stalled",
  notfound: "Not found",
  out: "Out for delivery",
  transit: "In transit",
  label: "Label created",
  looking: "Looking it up",
  delivered: "Delivered",
};

// What we last did about a shipment is kept in one small field:
//   null        nothing outstanding
//   "customs"   we emailed about this state
//   "~customs"  we noticed this state but stayed silent (summary or off)
//   "done"      delivered and dealt with
const emailed = (a) => !!a && a !== "done" && !a.startsWith("~");
const stateOf = (a) => (a && a !== "done" ? a.replace(/^~/, "") : null);

// Pure: works out what this run should say and what to remember afterwards.
// shipments: [{ id, state, alertState, deliveredAt, createdAt, ... }]
export function planAlerts(shipments, settings, opts = {}) {
  const holdForHours = !!opts.outsideWorkingHours;
  const raised = [];
  const resolved = [];
  const delivered = [];
  const updates = []; // { id, alertState }

  for (const s of shipments) {
    const prev = s.alertState || null;

    if (s.state === "delivered") {
      if (prev === "done") continue;
      const alreadyDeliveredWhenAdded = s.deliveredAt && s.createdAt && s.deliveredAt < s.createdAt;
      if (emailed(prev) && settings.events.resolved === "now") {
        if (holdForHours) continue;
        resolved.push(s);
      } else if (!alreadyDeliveredWhenAdded && settings.events.delivered === "now") {
        if (holdForHours) continue;
        delivered.push(s);
      }
      updates.push({ id: s.id, alertState: "done" });
      continue;
    }

    if (ATTENTION.includes(s.state)) {
      if (stateOf(prev) === s.state) continue;
      const mode = settings.events[s.state];
      if (mode === "now") {
        if (holdForHours) continue; // picked up at the start of working hours
        raised.push(s);
        updates.push({ id: s.id, alertState: s.state });
      } else {
        updates.push({ id: s.id, alertState: "~" + s.state });
      }
      continue;
    }

    // Moving normally.
    if (prev && prev !== "done") {
      if (emailed(prev) && settings.events.resolved === "now") {
        if (holdForHours) continue;
        resolved.push(s);
      }
      updates.push({ id: s.id, alertState: null });
    }
  }
  return { raised, resolved, delivered, updates };
}

// Pure: what belongs in the morning summary.
export function planSummary(shipments, settings, excludeIds = []) {
  return shipments.filter(
    (s) => ATTENTION.includes(s.state) && settings.events[s.state] !== "off" && !excludeIds.includes(s.id)
  );
}

function name(s) {
  return s.label ? s.label + " (" + s.trackingNumber + ")" : s.trackingNumber;
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function lastScan(s) {
  if (!s.lastEventText) return "No scans yet.";
  return "Last scan " + when(s.lastEventAt) + ": " + s.lastEventText + (s.lastEventLocation ? " (" + s.lastEventLocation + ")" : "");
}

function carrier(s) {
  return (s.courier ? s.courier.toUpperCase() : "Carrier unknown") + (s.destCountry ? " to " + s.destCountry : "");
}

const attentionItem = (s) => ({
  head: STATE_LABEL[s.state] + ": " + name(s),
  lines: [s.reason, carrier(s), lastScan(s)].filter(Boolean),
});

// Builds one email from the pieces. Returns null when there is nothing to say.
export function composeEmail({ raised = [], resolved = [], delivered = [], starred = [], summary = null, boardUrl = "" }) {
  const sections = [];
  if (raised.length) sections.push({ title: "Needs attention", items: raised.map(attentionItem) });
  if (resolved.length) {
    sections.push({
      title: "No longer a problem",
      items: resolved.map((s) => ({
        head: name(s) + " is now " + (STATE_LABEL[s.state] || s.state).toLowerCase(),
        lines: ["Was: " + (STATE_LABEL[stateOf(s.alertState)] || "flagged"), lastScan(s)],
      })),
    });
  }
  if (delivered.length) {
    sections.push({ title: "Delivered", items: delivered.map((s) => ({ head: name(s), lines: [carrier(s), lastScan(s)] })) });
  }
  if (starred.length) {
    sections.push({
      title: "Updates on starred shipments",
      items: starred.map((x) => ({
        head: name(x.shipment),
        lines: x.events.map((e) => when(e.at) + ": " + (e.text || "Update") + (e.location ? " (" + e.location + ")" : "")),
      })),
    });
  }
  if (summary && summary.length) sections.push({ title: "Still unresolved", items: summary.map(attentionItem) });
  if (!sections.length) return null;

  const first = (list) => list[0].label || list[0].trackingNumber;
  let subject;
  if (raised.length === 1) subject = STATE_LABEL[raised[0].state] + ": " + first(raised);
  else if (raised.length > 1) subject = raised.length + " shipments need attention";
  else if (summary && summary.length) subject = summary.length + (summary.length === 1 ? " shipment still unresolved" : " shipments still unresolved");
  else if (resolved.length === 1) subject = "Resolved: " + first(resolved);
  else if (resolved.length > 1) subject = resolved.length + " shipments resolved";
  else if (delivered.length === 1) subject = "Delivered: " + first(delivered);
  else if (delivered.length > 1) subject = delivered.length + " shipments delivered";
  else subject = "Update: " + (starred[0].shipment.label || starred[0].shipment.trackingNumber) + (starred.length > 1 ? " and " + (starred.length - 1) + " more" : "");

  const text =
    sections
      .map((sec) => sec.title.toUpperCase() + "\n\n" + sec.items.map((i) => i.head + "\n" + i.lines.map((l) => "  " + l).join("\n")).join("\n\n"))
      .join("\n\n\n") +
    (boardUrl ? "\n\n\nOpen the board: " + boardUrl + "\nChange what you are emailed about: " + boardUrl + "/settings\n" : "\n");

  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html =
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;color:#1c1b19;max-width:640px">' +
    sections
      .map(
        (sec) =>
          '<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#6b6860;margin:24px 0 8px">' + esc(sec.title) + "</h2>" +
          sec.items
            .map(
              (i) =>
                '<div style="border:1px solid #e2dfd8;border-radius:8px;padding:10px 12px;margin:0 0 8px">' +
                '<div style="font-weight:600">' + esc(i.head) + "</div>" +
                i.lines.map((l) => '<div style="color:#55524b;font-size:14px">' + esc(l) + "</div>").join("") +
                "</div>"
            )
            .join("")
      )
      .join("") +
    (boardUrl
      ? '<p style="margin-top:20px"><a href="' + esc(boardUrl) + '">Open the board</a> &nbsp;|&nbsp; <a href="' + esc(boardUrl) + '/settings">Change what you are emailed about</a></p>'
      : "") +
    "</div>";

  return { subject: "[Shipments] " + subject, text, html };
}

// Sends to each recipient. Returns the list of failures (empty = all sent).
export async function sendEmail(env, recipients, email) {
  const failures = [];
  for (const to of recipients) {
    try {
      await env.EMAIL.send({
        to,
        from: { email: env.ALERT_FROM, name: "Shipment tracker" },
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (e) {
      failures.push(to + ": " + String((e && e.message) || e).slice(0, 200));
    }
  }
  return failures;
}

// UK clock for a moment in time. day: 1 = Monday ... 7 = Sunday.
export function ukClock(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday) + 1,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    date: parts.year + "-" + parts.month + "-" + parts.day,
  };
}

export function outsideWorkingHours(settings, clock) {
  if (!settings.workingHours.enabled) return false;
  const weekday = clock.day >= 1 && clock.day <= 5;
  return !(weekday && clock.hour >= settings.workingHours.start && clock.hour < settings.workingHours.end);
}

export function summaryDue(settings, clock, lastSentDate) {
  return (
    settings.summary.enabled &&
    settings.summary.days.includes(clock.day) &&
    clock.hour === settings.summary.hour &&
    clock.minute < 30 &&
    lastSentDate !== clock.date
  );
}

// The scheduled job calls this after refreshing shipments.
// present(row, now, stallDays, customsHours) turns a database row into the
// same shape the board uses.
export async function runAlerts(env, present, now = new Date()) {
  const settings = await loadSettings(env);
  if (!env.EMAIL || !env.ALERT_FROM || !settings.recipients.length) return { skipped: "not set up" };

  const { results } = await env.DB.prepare(
    `SELECT * FROM shipments
     WHERE archived = 0 AND (delivered_at IS NULL OR alert_state IS NULL OR alert_state != 'done')`
  ).all();
  const shipments = results.map((row) => ({
    ...present(row, now, settings.stallDays, settings.customsHours),
    alertState: row.alert_state || null,
    starredSeenAt: row.starred_seen_at || null,
  }));

  const clock = ukClock(now);
  const held = outsideWorkingHours(settings, clock);
  const plan = planAlerts(shipments, settings, { outsideWorkingHours: held });

  // Starred shipments: every carrier update since we last reported.
  const starred = [];
  const starUpdates = [];
  for (const s of shipments.filter((x) => x.starred)) {
    const since = s.starredSeenAt || s.createdAt;
    const ev = await env.DB.prepare(
      "SELECT occurred_at, status_text, location FROM events WHERE shipment_id = ? AND occurred_at > ? ORDER BY occurred_at"
    )
      .bind(s.id, since)
      .all();
    if (!ev.results.length) continue;
    const latest = ev.results[ev.results.length - 1].occurred_at;
    if (settings.events.starred === "now") {
      if (held) continue;
      starred.push({ shipment: s, events: ev.results.map((e) => ({ at: e.occurred_at, text: e.status_text, location: e.location })) });
    }
    starUpdates.push({ id: s.id, seen: latest });
  }

  let summary = null;
  const lastSummary = await getMeta(env, "summary_date");
  const doSummary = summaryDue(settings, clock, lastSummary);
  if (doSummary) summary = planSummary(shipments, settings, plan.raised.map((s) => s.id));

  const email = composeEmail({
    raised: plan.raised, resolved: plan.resolved, delivered: plan.delivered, starred, summary,
    boardUrl: (env.BOARD_URL || "").replace(/\/+$/, ""),
  });

  if (email) {
    const failures = await sendEmail(env, settings.recipients, email);
    if (failures.length === settings.recipients.length) {
      // Nobody got it. Remember nothing, so the next run tries again.
      await setMeta(env, "alert_error", now.toISOString() + " " + failures.join("; "));
      return { failed: failures };
    }
    await setMeta(env, "alert_last_sent", now.toISOString() + " " + email.subject);
    await setMeta(env, "alert_error", failures.length ? now.toISOString() + " " + failures.join("; ") : "");
  }

  const statements = plan.updates.map((u) =>
    env.DB.prepare("UPDATE shipments SET alert_state = ? WHERE id = ?").bind(u.alertState, u.id)
  );
  for (const u of starUpdates) {
    statements.push(env.DB.prepare("UPDATE shipments SET starred_seen_at = ? WHERE id = ?").bind(u.seen, u.id));
  }
  if (statements.length) await env.DB.batch(statements);
  if (doSummary) await setMeta(env, "summary_date", clock.date);
  return { sent: !!email, subject: email ? email.subject : null };
}
