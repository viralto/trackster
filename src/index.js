// Shipment tracker: engine + board in one Cloudflare Worker.
//
// Engine: registers shipments with Ship24, checks them on a schedule,
//         stores the history, works out a plain-English state.
// Board:  one page served from "/", which talks to the engine's /api routes.
//
// Access control: the Worker refuses every request that has not come through
// Cloudflare Access. If Access is switched off, the tool locks itself.

import { PAGE } from "./page.js";

const SHIP24_DEFAULT_BASE = "https://api.ship24.com/public/v1";
const MAX_PER_PASTE = 20; // keeps one paste inside Cloudflare's per-request limits
const MAX_PER_CRON = 40;

export default {
  async fetch(request, env, ctx) {
    try {
      const user = await whoIsThis(env, ctx);
      if (!user) return lockedOut();
      return await route(request, env, user);
    } catch (err) {
      console.error(err && err.stack ? err.stack : err);
      return json({ error: "Something broke on our side. Try again in a minute." }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshOpenShipments(env));
  },
};

// ---------------------------------------------------------------- access

async function whoIsThis(env, ctx) {
  // Local testing only. This variable must never be set on the live Worker.
  if (env.DEV_NO_AUTH === "true") return { email: "local-test@example.com" };
  if (!ctx || !ctx.access) return null;
  let email = "unknown";
  try {
    const identity = await ctx.access.getIdentity();
    if (identity && identity.email) email = identity.email;
  } catch (e) {
    // Identity lookup failed, but Access did authenticate the request.
  }
  return { email };
}

function lockedOut() {
  return new Response(
    "Locked. This tool only answers requests that have signed in through Cloudflare Access. " +
      "If you are the owner: Workers & Pages > trackster > Settings > Domains & Routes > Enable Cloudflare Access.",
    { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

// ---------------------------------------------------------------- routing

async function route(request, env, user) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/") {
    return new Response(PAGE, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
      },
    });
  }

  if (!path.startsWith("/api/")) return json({ error: "Not found" }, 404);

  if (method !== "GET") {
    // Changes must come from our own page, as JSON.
    const type = request.headers.get("content-type") || "";
    if (!type.includes("application/json") || request.headers.get("x-tracker") !== "1") {
      return json({ error: "Bad request" }, 400);
    }
  }

  if (method === "GET" && path === "/api/shipments") return listShipments(env, user);
  if (method === "POST" && path === "/api/shipments") return addShipments(request, env, user);

  const m = path.match(/^\/api\/shipments\/(\d+)(?:\/(events|star|refresh|label|remove))?$/);
  if (m) {
    const id = Number(m[1]);
    const action = m[2];
    if (method === "GET" && action === "events") return shipmentEvents(env, id);
    if (method === "POST" && action === "star") return setStar(request, env, id);
    if (method === "POST" && action === "label") return setLabel(request, env, id);
    if (method === "POST" && action === "refresh") return refreshOne(env, id);
    if (method === "POST" && action === "remove") return removeShipment(env, id);
  }
  return json({ error: "Not found" }, 404);
}

// ---------------------------------------------------------------- board data

async function listShipments(env, user) {
  const now = new Date();
  const stallDays = stallDaysOf(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM shipments
     WHERE archived = 0
       AND (delivered_at IS NULL OR delivered_at >= ?)
     ORDER BY created_at DESC`
  )
    .bind(new Date(now.getTime() - 14 * 86400000).toISOString())
    .all();

  const shipments = results.map((row) => present(row, now, stallDays));
  const quota = await quotaStatus(env, now);
  return json({ shipments, quota, user: user.email, stallDays, now: now.toISOString() });
}

function present(row, now, stallDays) {
  const s = deriveState(row, now, stallDays);
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    label: row.label || "",
    courier: row.courier || "",
    state: s.state,
    reason: s.reason,
    lastEventAt: row.last_event_at,
    lastEventText: row.last_event_text || "",
    lastEventLocation: row.last_event_location || "",
    estDelivery: row.est_delivery,
    destCountry: row.dest_country || "",
    starred: !!row.starred,
    createdAt: row.created_at,
    checkedAt: row.checked_at,
    deliveredAt: row.delivered_at,
    error: row.last_error || "",
  };
}

// The seven plain states. "stalled" is our own judgement: Ship24 and the
// carriers do not announce that nothing has happened.
export function deriveState(row, now, stallDays) {
  const ms = row.milestone || "pending";
  const code = row.status_code || "";

  if (ms === "delivered") return { state: "delivered", reason: "" };

  if (ms === "exception") return { state: "problem", reason: problemText(code) || "Carrier reports it cannot be delivered" };
  if (ms === "failed_attempt") return { state: "problem", reason: "Delivery attempt failed" };
  if (code === "delivery_exception" || code === "delivery_refused") {
    return { state: "problem", reason: problemText(code) };
  }

  if (row.customs_state === "hold") {
    return { state: "customs", reason: code === "customs_rejected" ? "Rejected by customs" : "Held in customs: documents or payment may be needed" };
  }

  if (ms === "out_for_delivery") return { state: "out", reason: "" };
  if (ms === "available_for_pickup") return { state: "out", reason: "Waiting to be collected" };

  const today = now.toISOString().slice(0, 10);
  if (row.est_delivery && row.est_delivery.slice(0, 10) < today) {
    return { state: "stalled", reason: "Past its expected delivery date (" + row.est_delivery.slice(0, 10) + ")" };
  }
  const since = row.last_event_at || row.created_at;
  const quietDays = workingDaysBetween(new Date(since), now);
  if (quietDays >= stallDays) {
    const what = row.last_event_at ? "No scan for " : "No tracking data found for ";
    return { state: "stalled", reason: what + quietDays + " working days" };
  }

  if (ms === "pending") return { state: "label", reason: "Carrier has no tracking data yet" };
  if (ms === "info_received") return { state: "label", reason: "" };
  return { state: "transit", reason: row.customs_state === "in" ? "In customs" : "" };
}

function problemText(code) {
  return (
    {
      exception_return: "Being returned to sender",
      exception_lost: "Reported lost by the carrier",
      exception_discarded: "Destroyed by the carrier",
      delivery_exception: "Delivery problem reported by the carrier",
      delivery_refused: "Refused by the recipient",
    }[code] || ""
  );
}

// Whole weekdays that have passed between two moments.
export function workingDaysBetween(from, to) {
  if (!(from instanceof Date) || isNaN(from) || to <= from) return 0;
  let days = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() > end) break;
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

function stallDaysOf(env) {
  const n = parseInt(env.STALL_DAYS || "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

async function quotaStatus(env, now) {
  const limit = parseInt(env.MAX_SHIPMENTS_PER_MONTH || "10", 10) || 10;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM shipments WHERE tracker_id IS NOT NULL AND created_at >= ?"
  )
    .bind(monthStart)
    .first();
  return { used: row ? row.n : 0, limit };
}

// ---------------------------------------------------------------- adding

async function addShipments(request, env, user) {
  if (!env.SHIP24_API_KEY) return json({ error: "The Ship24 key has not been added to the Worker yet." }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Could not read that." }, 400);
  }
  const lines = Array.isArray(body && body.items) ? body.items : [];
  const wanted = [];
  const seen = new Set();
  for (const item of lines) {
    const tn = cleanTrackingNumber(item && item.trackingNumber);
    if (!tn || seen.has(tn)) continue;
    seen.add(tn);
    wanted.push({ tn, label: String((item && item.label) || "").trim().slice(0, 120) });
  }
  if (!wanted.length) return json({ error: "No tracking numbers found in that." }, 400);
  if (wanted.length > MAX_PER_PASTE) {
    return json({ error: "Add up to " + MAX_PER_PASTE + " at a time." }, 400);
  }

  const now = new Date();
  const quota = await quotaStatus(env, now);
  let room = quota.limit - quota.used;
  const report = [];

  for (const w of wanted) {
    const existing = await env.DB.prepare("SELECT id, archived FROM shipments WHERE tracking_number = ?").bind(w.tn).first();
    if (existing) {
      if (existing.archived) {
        await env.DB.prepare("UPDATE shipments SET archived = 0 WHERE id = ?").bind(existing.id).run();
        report.push({ trackingNumber: w.tn, result: "restored" });
      } else {
        report.push({ trackingNumber: w.tn, result: "duplicate" });
      }
      continue;
    }
    if (room <= 0) {
      report.push({ trackingNumber: w.tn, result: "over_limit" });
      continue;
    }

    let trackerId;
    try {
      trackerId = await ship24CreateTracker(env, w.tn);
    } catch (e) {
      report.push({ trackingNumber: w.tn, result: "failed", detail: String(e.message || e).slice(0, 200) });
      continue;
    }
    room--;
    const inserted = await env.DB.prepare(
      `INSERT INTO shipments (tracking_number, label, tracker_id, milestone, added_by, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?) RETURNING id`
    )
      .bind(w.tn, w.label || null, trackerId, user.email, now.toISOString())
      .first();
    report.push({ trackingNumber: w.tn, result: "added" });

    // First look. Often empty this early; the schedule picks it up later.
    try {
      await refreshShipment(env, { id: inserted.id, tracker_id: trackerId });
    } catch (e) {
      // Not fatal.
    }
  }
  return json({ report });
}

function cleanTrackingNumber(v) {
  const tn = String(v || "").replace(/\s+/g, "").toUpperCase();
  if (tn.length < 5 || tn.length > 50) return "";
  if (!/^[A-Z0-9_-]+$/.test(tn)) return "";
  return tn;
}

// ---------------------------------------------------------------- Ship24

function ship24Base(env) {
  return (env.SHIP24_API_BASE || SHIP24_DEFAULT_BASE).replace(/\/+$/, "");
}

async function ship24(env, method, path, body) {
  const res = await fetch(ship24Base(env) + path, {
    method,
    headers: {
      authorization: "Bearer " + env.SHIP24_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // Non-JSON reply.
  }
  if (!res.ok) {
    const msg =
      (data && data.errors && data.errors[0] && (data.errors[0].message || data.errors[0].code)) ||
      (data && data.error && (data.error.message || data.error.code)) ||
      "Ship24 replied " + res.status;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function ship24CreateTracker(env, trackingNumber) {
  const data = await ship24(env, "POST", "/trackers", { trackingNumber });
  const id = data && data.data && data.data.tracker && data.data.tracker.trackerId;
  if (!id) throw new Error("Ship24 did not return a tracker id");
  return id;
}

async function ship24Results(env, trackerId) {
  const data = await ship24(env, "GET", "/trackers/" + encodeURIComponent(trackerId) + "/results");
  const list = (data && data.data && data.data.trackings) || [];
  return list[0] || null;
}

// ---------------------------------------------------------------- refreshing

async function refreshShipment(env, row) {
  const nowIso = new Date().toISOString();
  let tracking;
  try {
    tracking = await ship24Results(env, row.tracker_id);
  } catch (e) {
    await env.DB.prepare("UPDATE shipments SET checked_at = ?, last_error = ? WHERE id = ?")
      .bind(nowIso, String(e.message || e).slice(0, 200), row.id)
      .run();
    throw e;
  }
  if (!tracking) {
    await env.DB.prepare("UPDATE shipments SET checked_at = ?, last_error = NULL WHERE id = ?").bind(nowIso, row.id).run();
    return;
  }
  await storeTracking(env, row.id, tracking, nowIso);
}

// Turns one Ship24 result into our stored summary plus the event history.
export function summarise(tracking) {
  const shipment = tracking.shipment || {};
  const events = (Array.isArray(tracking.events) ? tracking.events : [])
    .filter((e) => e && e.eventId)
    .slice()
    .sort((a, b) => String(a.occurrenceDatetime || "").localeCompare(String(b.occurrenceDatetime || "")));

  // Walk the history in order: the most recent customs event decides.
  let customs = null;
  for (const e of events) {
    if (e.statusCode === "customs_received") customs = "in";
    else if (e.statusCode === "customs_exception" || e.statusCode === "customs_rejected") customs = "hold";
    else if (e.statusCode === "customs_cleared") customs = "cleared";
  }

  const last = events[events.length - 1] || null;
  const milestone = shipment.statusMilestone || (last && last.statusMilestone) || "pending";
  const delivery = shipment.delivery || {};
  const est =
    delivery.estimatedDeliveryDate ||
    (delivery.courierEstimatedDeliveryDate && (delivery.courierEstimatedDeliveryDate.to || delivery.courierEstimatedDeliveryDate.from)) ||
    null;

  let deliveredAt = null;
  if (milestone === "delivered") {
    const stamp = tracking.statistics && tracking.statistics.timestamps && tracking.statistics.timestamps.deliveredDatetime;
    deliveredAt = stamp || (last && last.occurrenceDatetime) || null;
  }

  return {
    milestone,
    statusCode: shipment.statusCode || (last && last.statusCode) || null,
    customs,
    courier: (last && last.courierCode) || null,
    lastEventAt: last ? toIso(last.occurrenceDatetime) : null,
    lastEventText: last ? last.status || null : null,
    lastEventLocation: last ? last.location || null : null,
    estDelivery: est,
    destCountry: shipment.destinationCountryCode || null,
    deliveredAt: deliveredAt ? toIso(deliveredAt) : null,
    events,
  };
}

function toIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toISOString();
}

async function storeTracking(env, shipmentId, tracking, nowIso) {
  const s = summarise(tracking);
  const statements = [
    env.DB.prepare(
      `UPDATE shipments SET
         milestone = ?, status_code = ?, customs_state = ?,
         courier = COALESCE(?, courier),
         last_event_at = ?, last_event_text = ?, last_event_location = ?,
         est_delivery = ?, dest_country = COALESCE(?, dest_country),
         delivered_at = ?, checked_at = ?, last_error = NULL
       WHERE id = ?`
    ).bind(
      s.milestone,
      s.statusCode,
      s.customs,
      s.courier,
      s.lastEventAt,
      s.lastEventText,
      s.lastEventLocation,
      s.estDelivery,
      s.destCountry,
      s.deliveredAt,
      nowIso,
      shipmentId
    ),
  ];
  for (const e of s.events) {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO events
           (shipment_id, event_id, occurred_at, status_text, location, courier, status_code, status_category, milestone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        shipmentId,
        String(e.eventId),
        toIso(e.occurrenceDatetime),
        e.status || null,
        e.location || null,
        e.courierCode || null,
        e.statusCode || null,
        e.statusCategory || null,
        e.statusMilestone || null
      )
    );
  }
  await env.DB.batch(statements);
}

async function refreshOpenShipments(env) {
  if (!env.SHIP24_API_KEY) return;
  const { results } = await env.DB.prepare(
    `SELECT id, tracker_id FROM shipments
     WHERE archived = 0 AND delivered_at IS NULL AND tracker_id IS NOT NULL
     ORDER BY COALESCE(checked_at, '') ASC
     LIMIT ?`
  )
    .bind(MAX_PER_CRON)
    .all();
  for (const row of results) {
    try {
      await refreshShipment(env, row);
    } catch (e) {
      console.error("refresh failed for shipment " + row.id + ": " + (e.message || e));
    }
  }
}

async function refreshOne(env, id) {
  const row = await env.DB.prepare("SELECT id, tracker_id FROM shipments WHERE id = ? AND archived = 0").bind(id).first();
  if (!row || !row.tracker_id) return json({ error: "Not found" }, 404);
  try {
    await refreshShipment(env, row);
  } catch (e) {
    return json({ error: "Ship24 did not answer: " + String(e.message || e).slice(0, 200) }, 502);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------- small actions

async function shipmentEvents(env, id) {
  const { results } = await env.DB.prepare(
    `SELECT occurred_at, status_text, location, courier, status_code
     FROM events WHERE shipment_id = ? ORDER BY occurred_at DESC, id DESC`
  )
    .bind(id)
    .all();
  return json({
    events: results.map((e) => ({
      at: e.occurred_at,
      text: e.status_text || "",
      location: e.location || "",
      courier: e.courier || "",
      code: e.status_code || "",
    })),
  });
}

async function setStar(request, env, id) {
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare("UPDATE shipments SET starred = ? WHERE id = ?").bind(body.starred ? 1 : 0, id).run();
  return json({ ok: true });
}

async function setLabel(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const label = String(body.label || "").trim().slice(0, 120);
  await env.DB.prepare("UPDATE shipments SET label = ? WHERE id = ?").bind(label || null, id).run();
  return json({ ok: true });
}

async function removeShipment(env, id) {
  await env.DB.prepare("UPDATE shipments SET archived = 1 WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
