// Stand-in for Ship24 so the tool can be tested without spending real slots.
import http from "node:http";

const trackers = new Map();
const calls = new Map();
const dayFrom = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10) + "T00:00:00.000Z";
let n = 0;
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
const ev = (id, tn, d, status, code, category, milestone, location, courier = "ups") => ({
  eventId: id, trackingNumber: tn, status, occurrenceDatetime: daysAgo(d), location,
  courierCode: courier, statusCode: code, statusCategory: category, statusMilestone: milestone,
});

function scenario(tn, call = 1) {
  // ONTIME: estimate seen in transit, then delivered on that day.
  if (tn.startsWith("ONTIME")) return call < 2
    ? { milestone: "in_transit", code: null, est: dayFrom(-1), events: [ev("g1", tn, 2, "Departed facility", null, null, "in_transit", "Koeln, DE")] }
    : { milestone: "delivered", code: "delivery_delivered", est: dayFrom(-1), events: [
        ev("g1", tn, 2, "Departed facility", null, null, "in_transit", "Koeln, DE"),
        ev("g2", tn, 1, "Delivered", "delivery_delivered", "delivery", "delivered", "Berlin, DE")] };
  // LATE: carrier moves its own goalposts, then delivers on the revised day.
  if (tn.startsWith("LATE")) {
    const first = ev("h1", tn, 5, "Departed facility", null, null, "in_transit", "Louisville, US");
    if (call < 2) return { milestone: "in_transit", code: null, est: dayFrom(-3), events: [first] };
    if (call < 3) return { milestone: "in_transit", code: null, est: dayFrom(-1), events: [first] };
    return { milestone: "delivered", code: "delivery_delivered", est: dayFrom(-1), events: [first,
      ev("h2", tn, 1, "Delivered", "delivery_delivered", "delivery", "delivered", "Austin, US")] };
  }
  // SLIP: still moving, estimate pushed back.
  if (tn.startsWith("SLIP")) return { milestone: "in_transit", code: null, est: call < 2 ? dayFrom(1) : dayFrom(3),
    events: [ev("i1", tn, 0.3, "Arrived at facility", null, null, "in_transit", "Paris, FR")] };
  if (tn.startsWith("MOVING")) return { milestone: "in_transit", code: null, est: dayFrom(2), events: [
    ev("f1", tn, 0.5, "Arrived at facility", null, null, "in_transit", "Koeln, DE"),
  ]};
  if (tn.startsWith("CUSTOMS")) return { milestone: "in_transit", code: "customs_exception", events: [
    ev("a1", tn, 6, "Picked up", "transit_handover", "transit", "in_transit", "Guildford, GB"),
    ev("a2", tn, 5, "Arrived in destination country", "destination_arrival", "destination", "in_transit", "Cologne, DE"),
    ev("a3", tn, 4, "Presented to customs", "customs_received", "customs", "in_transit", "Cologne, DE"),
    ev("a4", tn, 1, "Held: commercial invoice required", "customs_exception", "customs", "in_transit", "Cologne, DE"),
  ]};
  if (tn.startsWith("CLEARED")) return { milestone: "in_transit", code: "customs_cleared", events: [
    ev("b1", tn, 3, "Held by customs", "customs_exception", "customs", "in_transit", "Paris, FR", "fedex"),
    ev("b2", tn, 0.2, "Cleared customs", "customs_cleared", "customs", "in_transit", "Paris, FR", "fedex"),
  ]};
  if (tn.startsWith("STALE")) return { milestone: "in_transit", code: null, events: [
    ev("c1", tn, 12, "Departed facility", null, null, "in_transit", "East Midlands, GB"),
  ]};
  if (tn.startsWith("DELIVERED")) return { milestone: "delivered", code: "delivery_delivered", events: [
    ev("d1", tn, 2, "Out for delivery", "delivery_out_for_delivery", "delivery", "out_for_delivery", "Leeds, GB"),
    ev("d2", tn, 1, "Delivered", "delivery_delivered", "delivery", "delivered", "Leeds, GB"),
  ]};
  if (tn.startsWith("RETURN")) return { milestone: "exception", code: "exception_return", events: [
    ev("e1", tn, 1, "Returning to sender", "exception_return", "exception", "exception", "Madrid, ES", "fedex"),
  ]};
  if (tn.startsWith("MOVING")) return { milestone: "in_transit", code: null, events: [
    ev("f1", tn, 0.5, "Arrived at facility", null, null, "in_transit", "Koeln, DE"),
  ]};
  return { milestone: "pending", code: null, events: [] };
}

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.headers.authorization !== "Bearer test-key") return send(401, { errors: [{ code: "unauthorized", message: "Bad key" }] });
    if (req.method === "POST" && req.url === "/public/v1/trackers") {
      const { trackingNumber } = JSON.parse(body || "{}");
      if (trackingNumber.startsWith("REJECT")) return send(400, { errors: [{ code: "validation_error", message: "Invalid tracking number" }] });
      const trackerId = "trk-" + ++n;
      trackers.set(trackerId, trackingNumber);
      return send(201, { data: { tracker: { trackerId, trackingNumber, isSubscribed: true } } });
    }
    const m = req.url.match(/^\/public\/v1\/trackers\/([^/]+)\/results$/);
    if (req.method === "GET" && m && trackers.has(m[1])) {
      const tn = trackers.get(m[1]);
      calls.set(m[1], (calls.get(m[1]) || 0) + 1);
      const s = scenario(tn, calls.get(m[1]));
      return send(200, { data: { trackings: [{
        tracker: { trackerId: m[1], trackingNumber: tn },
        shipment: { statusMilestone: s.milestone, statusCode: s.code, destinationCountryCode: "DE",
          delivery: { estimatedDeliveryDate: s.est || null } },
        events: s.events.slice().reverse(),
        statistics: { timestamps: {} },
      }] } });
    }
    send(404, { errors: [{ code: "not_found", message: "Not found" }] });
  });
}).listen(8799, () => console.log("mock ship24 on 8799"));
