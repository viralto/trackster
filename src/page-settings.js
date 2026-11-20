// The Settings page: who gets alert emails, about what, and when.

import { THEME_HEAD, THEME_CSS, WHO_JS, sidebar } from "./theme.js";

export const SETTINGS_PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dot Logistics: Alert settings</title>
${THEME_HEAD}
<style>
${THEME_CSS}
  .main { max-width: 1040px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  #banners:empty + .section { margin-top: 0; }
  #banners .banner:first-child { margin-top: 0; }
  .banner { border-radius: 8px; padding: 11px 14px; margin-top: 16px; font-size: 14px; }
  .banner.warn { background: var(--amber-wash); color: var(--amber-ink); }
  .banner.bad { background: var(--red-wash); color: var(--red-ink); }
  .banner.ok { background: var(--teal-pill); color: var(--teal-deep); border: 1px solid var(--teal-line); }
  textarea { width: 100%; min-height: 70px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
  input[type=number] { width: 74px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: center; font-size: 13.5px; font-weight: 300; color: var(--muted); padding: 6px 6px 12px; }
  th:first-child { text-align: left; }
  td { border-top: 1px solid var(--line); padding: 13px 6px; vertical-align: top; }
  td.pick { text-align: center; width: 120px; }
  td .what { color: var(--ink); font-weight: 500; }
  td .desc { color: var(--muted); font-size: 13.5px; }
  .line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0; color: var(--ink); }
  .days label { display: inline-flex; align-items: center; gap: 5px; margin-right: 12px; }
  .bar { position: sticky; bottom: 0; background: var(--page); border-top: 1px solid var(--line);
    padding: 14px 0; margin-top: 22px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  #msg { font-size: 14px; }
  .dim { opacity: .45; }
</style>
</head>
<body>
<div class="shell">
${sidebar("settings")}
<main class="main">
  <h1 class="sr">Alert settings</h1>

  <div id="banners"></div>

  <section class="card section">
    <h2>Who gets the emails</h2>
    <p class="hint">One address per line. Everyone listed gets the same emails. A new address must be verified in
      Cloudflare before it can receive anything, so ask whoever looks after this tool to add it there first.</p>
    <textarea id="recipients" spellcheck="false" autocomplete="off" aria-label="Recipient email addresses"></textarea>
  </section>

  <section class="card section">
    <h2>What to email about</h2>
    <p class="hint">Straight away means within about half an hour of the carrier reporting it.</p>
    <table>
      <thead><tr><th>Event</th><th>Straight away</th><th>Morning summary only</th><th>Never</th></tr></thead>
      <tbody id="events"></tbody>
    </table>
  </section>

  <section class="card section">
    <h2>Morning summary</h2>
    <p class="hint">One email listing every shipment that still needs attention. Nothing is sent on a morning with nothing to report.</p>
    <div class="line"><label><input type="checkbox" id="sumOn"> Send a morning summary</label></div>
    <div class="line" id="sumOpts">
      <label>at <select id="sumHour"></select></label>
      <span class="days" id="sumDays"></span>
    </div>
  </section>

  <section class="card section">
    <h2>Working hours</h2>
    <p class="hint">Holds "straight away" emails overnight and at weekends, then sends them at the start of the next working day. UK time, Monday to Friday.</p>
    <div class="line"><label><input type="checkbox" id="whOn"> Only email during working hours</label></div>
    <div class="line" id="whOpts">
      <label>from <select id="whStart"></select></label>
      <label>to <select id="whEnd"></select></label>
    </div>
  </section>

  <section class="card section">
    <h2>When a shipment gets flagged</h2>
    <div class="line"><label>Stalled after <input type="number" id="stallDays" min="1" max="30"> working days without a scan</label></div>
    <div class="line"><label>Customs hold after <input type="number" id="customsHours" min="1" max="240"> hours with customs and not released</label></div>
    <p class="hint">A shipment where customs asks for documents or payment is flagged immediately, whatever this is set to.</p>
  </section>

  <div class="bar">
    <button class="primary" id="save">Save settings</button>
    <button id="test">Save and send a test email</button>
    <span id="msg" role="status"></span>
  </div>
</main>
</div>

<script>
(function () {
${WHO_JS}
  var EVENTS = [
    { key: "customs",   what: "Customs hold",  desc: "Customs wants documents or payment, has rejected it, or has kept it too long", summary: true },
    { key: "problem",   what: "Problem",       desc: "Failed delivery, refused, being returned, lost or destroyed", summary: true },
    { key: "stalled",   what: "Stalled",       desc: "No scan for the number of working days set below, or past its expected delivery date", summary: true },
    { key: "notfound",  what: "Not found",     desc: "Two hours after being added, no carrier recognises the tracking number", summary: true },
    { key: "resolved",  what: "Resolved",      desc: "A shipment you were emailed about is moving again or has been delivered", summary: false },
    { key: "delivered", what: "Delivered",     desc: "Any shipment is delivered", summary: false },
    { key: "starred",   what: "Starred shipments", desc: "Every carrier update on a shipment someone has starred", summary: false }
  ];
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function hourLabel(h) { return (h < 10 ? "0" : "") + h + ":00"; }
  function fillHours(sel, from, to) {
    for (var h = from; h <= to; h++) {
      var o = el("option", null, hourLabel(h));
      o.value = String(h);
      sel.appendChild(o);
    }
  }
  function api(method, path, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers["content-type"] = "application/json";
      opts.headers["x-tracker"] = "1";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (!res.ok) throw new Error(j.error || ("Request failed (" + res.status + ")"));
        return j;
      });
    });
  }

  // Build the fixed parts of the form.
  EVENTS.forEach(function (ev) {
    var tr = el("tr");
    var td = el("td");
    td.appendChild(el("div", "what", ev.what));
    td.appendChild(el("div", "desc", ev.desc));
    tr.appendChild(td);
    ["now", "summary", "off"].forEach(function (mode) {
      var cell = el("td", "pick");
      if (mode === "summary" && !ev.summary) {
        cell.appendChild(el("span", "desc", "n/a"));
      } else {
        var r = el("input");
        r.type = "radio";
        r.name = "ev-" + ev.key;
        r.value = mode;
        r.setAttribute("aria-label", ev.what + ": " + (mode === "now" ? "straight away" : mode === "summary" ? "morning summary only" : "never"));
        cell.appendChild(r);
      }
      tr.appendChild(cell);
    });
    $("events").appendChild(tr);
  });
  fillHours($("sumHour"), 5, 12);
  fillHours($("whStart"), 5, 12);
  fillHours($("whEnd"), 13, 22);
  DAYS.forEach(function (d, i) {
    var lab = el("label");
    var c = el("input");
    c.type = "checkbox";
    c.value = String(i + 1);
    lab.appendChild(c);
    lab.appendChild(document.createTextNode(d));
    $("sumDays").appendChild(lab);
  });

  function dim() {
    $("sumOpts").className = "line" + ($("sumOn").checked ? "" : " dim");
    $("whOpts").className = "line" + ($("whOn").checked ? "" : " dim");
  }
  $("sumOn").addEventListener("change", dim);
  $("whOn").addEventListener("change", dim);

  function setSelect(sel, value) {
    var v = String(value);
    var found = false;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === v) found = true;
    if (!found) {
      var o = el("option", null, hourLabel(Number(value)));
      o.value = v;
      sel.appendChild(o);
    }
    sel.value = v;
  }

  // Stored as "<time> <details>". Show the time the way people read it.
  function stamp(v) {
    var i = v.indexOf(" ");
    var d = new Date(i === -1 ? v : v.slice(0, i));
    if (isNaN(d)) return v;
    var t = d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return t + (i === -1 ? "" : ": " + v.slice(i + 1));
  }

  function show(j) {
    var s = j.settings;
    if (j.user) showUser(j.user);
    $("recipients").value = s.recipients.join("\\n");
    EVENTS.forEach(function (ev) {
      var radios = document.getElementsByName("ev-" + ev.key);
      for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === s.events[ev.key];
    });
    $("sumOn").checked = s.summary.enabled;
    setSelect($("sumHour"), s.summary.hour);
    var boxes = $("sumDays").getElementsByTagName("input");
    for (var i = 0; i < boxes.length; i++) boxes[i].checked = s.summary.days.indexOf(Number(boxes[i].value)) !== -1;
    $("whOn").checked = s.workingHours.enabled;
    setSelect($("whStart"), s.workingHours.start);
    setSelect($("whEnd"), s.workingHours.end);
    $("stallDays").value = s.stallDays;
    $("customsHours").value = s.customsHours;
    dim();

    var b = $("banners");
    b.textContent = "";
    var st = j.status;
    if (!st.senderReady) {
      b.appendChild(el("div", "banner bad", "Email sending has not been set up for this tool yet, so nothing below will be sent. Whoever looks after the tool needs to switch it on in Cloudflare."));
    } else if (!st.hasRecipients) {
      b.appendChild(el("div", "banner warn", "Nobody is listed to receive emails yet. Add an address below and save."));
    }
    if (st.lastError) b.appendChild(el("div", "banner bad", "The last email could not be delivered. " + stamp(st.lastError)));
    if (st.lastSent) b.appendChild(el("div", "banner ok", "Last email sent " + stamp(st.lastSent)));
  }

  function collect() {
    var events = {};
    EVENTS.forEach(function (ev) {
      var radios = document.getElementsByName("ev-" + ev.key);
      for (var i = 0; i < radios.length; i++) if (radios[i].checked) events[ev.key] = radios[i].value;
    });
    var days = [];
    var boxes = $("sumDays").getElementsByTagName("input");
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) days.push(Number(boxes[i].value));
    return {
      events: events,
      summary: { enabled: $("sumOn").checked, hour: Number($("sumHour").value), days: days },
      workingHours: { enabled: $("whOn").checked, start: Number($("whStart").value), end: Number($("whEnd").value) },
      stallDays: Number($("stallDays").value),
      customsHours: Number($("customsHours").value),
      recipients: $("recipients").value.split(/[\\n,;]+/).map(function (x) { return x.trim(); }).filter(Boolean)
    };
  }

  function say(text, bad) {
    $("msg").textContent = text;
    $("msg").style.color = bad ? "var(--red-ink)" : "";
  }

  function save() {
    var typed = collect().recipients.length;
    return api("POST", "/api/settings", { settings: collect() }).then(function (j) {
      show(j);
      var kept = j.settings.recipients.length;
      say(kept < typed ? "Saved, but " + (typed - kept) + " address" + (typed - kept === 1 ? " was" : "es were") + " dropped for not looking like an email address." : "Saved.", kept < typed);
      return j;
    });
  }

  $("save").addEventListener("click", function () {
    say("Saving");
    save().catch(function (e) { say(e.message, true); });
  });

  $("test").addEventListener("click", function () {
    say("Saving, then sending");
    $("test").disabled = true;
    save().then(function () {
      return api("POST", "/api/settings/test", {});
    }).then(function (j) {
      // Redraw the banners: the test has just replaced any older failure note.
      return api("GET", "/api/settings").then(show).catch(function () {}).then(function () { return j; });
    }).then(function (j) {
      if (j.failures && j.failures.length) say("Sent to " + j.sent + ". Failed: " + j.failures.join("; "), true);
      else say("Test email sent to " + j.sent + (j.sent === 1 ? " address" : " addresses") + ". Check the inbox, and the junk folder the first time.");
    }).catch(function (e) { say(e.message, true); }).then(function () { $("test").disabled = false; });
  });

  api("GET", "/api/shipments").then(function (j) { showStats(j.shipments); }).catch(function () {});
  api("GET", "/api/settings").then(show).catch(function (e) { say("Could not load settings: " + e.message, true); });
})();
</script>
</body>
</html>`;
