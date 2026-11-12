// The board. One page, no build step. Kept in its own file so the engine
// (index.js) can later serve a different screen without being touched.

export const PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Shipment tracker</title>
<style>
  :root {
    --bg: #f6f5f2; --card: #ffffff; --ink: #1c1b19; --muted: #6b6860; --line: #e2dfd8;
    --accent: #1f5fbf;
    --customs-bg: #fde8e4; --customs-ink: #a12a14;
    --problem-bg: #fde8e4; --problem-ink: #a12a14;
    --stalled-bg: #fdf0d2; --stalled-ink: #7a5200;
    --transit-bg: #e4eefb; --transit-ink: #1b4d91;
    --label-bg: #ecebe7; --label-ink: #55524b;
    --out-bg: #e2f3e6; --out-ink: #1d6331;
    --delivered-bg: #ecebe7; --delivered-ink: #55524b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #161614; --card: #201f1d; --ink: #ecebe7; --muted: #a09c93; --line: #35332f;
      --accent: #7fb0ff;
      --customs-bg: #4a1f17; --customs-ink: #ffb4a4;
      --problem-bg: #4a1f17; --problem-ink: #ffb4a4;
      --stalled-bg: #45360f; --stalled-ink: #ffd98a;
      --transit-bg: #1b2f4d; --transit-ink: #a9cbff;
      --label-bg: #2e2c29; --label-ink: #c2beb5;
      --out-bg: #17381f; --out-ink: #9fe0b0;
      --delivered-bg: #2e2c29; --delivered-ink: #c2beb5;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 20px 16px 60px; }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  h1 { font-size: 22px; margin: 0; }
  .meta { color: var(--muted); font-size: 13px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted);
    margin: 28px 0 8px; display: flex; align-items: center; gap: 8px; }
  h2 .count { background: var(--line); color: var(--ink); border-radius: 10px; padding: 0 8px; font-size: 12px; letter-spacing: 0; }
  h2 button { margin-left: auto; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; }
  .add { padding: 14px; margin-top: 16px; }
  .add label { font-weight: 600; display: block; margin-bottom: 6px; }
  .add .hint { color: var(--muted); font-size: 13px; margin: 0 0 8px; }
  textarea, input[type=text] { width: 100%; font: inherit; color: var(--ink); background: var(--bg);
    border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
  textarea { min-height: 76px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
  .row-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
  button { font: inherit; border-radius: 8px; border: 1px solid var(--line); background: var(--card);
    color: var(--ink); padding: 7px 12px; cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  @media (prefers-color-scheme: dark) { button.primary { color: #10203a; } }
  button:disabled { opacity: .5; cursor: default; }
  button.link { border: 0; background: none; color: var(--accent); padding: 0; }
  button.small { padding: 4px 9px; font-size: 13px; }
  .notice { margin-top: 10px; font-size: 14px; }
  .notice ul { margin: 4px 0 0; padding-left: 18px; }
  .err { color: var(--problem-ink); }
  .list { overflow: hidden; }
  .ship { border-top: 1px solid var(--line); }
  .ship:first-child { border-top: 0; }
  .summary { display: grid; grid-template-columns: 132px 1fr auto; gap: 12px; align-items: start;
    padding: 12px 14px; cursor: pointer; }
  .summary:hover { background: color-mix(in srgb, var(--line) 30%, transparent); }
  .pill { display: inline-block; border-radius: 6px; padding: 2px 8px; font-size: 12.5px; font-weight: 700; white-space: nowrap; }
  .s-customs { background: var(--customs-bg); color: var(--customs-ink); }
  .s-problem { background: var(--problem-bg); color: var(--problem-ink); }
  .s-stalled { background: var(--stalled-bg); color: var(--stalled-ink); }
  .s-transit { background: var(--transit-bg); color: var(--transit-ink); }
  .s-label { background: var(--label-bg); color: var(--label-ink); }
  .s-out { background: var(--out-bg); color: var(--out-ink); }
  .s-delivered { background: var(--delivered-bg); color: var(--delivered-ink); }
  .s-looking { background: var(--label-bg); color: var(--label-ink); }
  .s-notfound { background: var(--stalled-bg); color: var(--stalled-ink); }
  .title { font-weight: 600; }
  .tn { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; color: var(--muted); }
  .reason { margin-top: 2px; }
  .sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
  .star { border: 0; background: none; font-size: 20px; line-height: 1; padding: 2px 4px; color: var(--muted); }
  .star.on { color: #d99a00; }
  .detail { padding: 0 14px 14px 158px; }
  .timeline { list-style: none; margin: 0 0 12px; padding: 0; border-left: 2px solid var(--line); }
  .timeline li { padding: 4px 0 8px 12px; position: relative; }
  .timeline li::before { content: ""; position: absolute; left: -5px; top: 10px; width: 8px; height: 8px;
    border-radius: 50%; background: var(--muted); }
  .timeline .when { color: var(--muted); font-size: 12.5px; }
  .tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tools input[type=text] { max-width: 280px; padding: 5px 8px; font-size: 13px; }
  .empty { padding: 18px 14px; color: var(--muted); }
  @media (max-width: 640px) {
    .summary { grid-template-columns: 1fr auto; }
    .summary .state { grid-column: 1 / -1; }
    .detail { padding-left: 14px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Shipment tracker</h1>
    <div class="meta" id="meta">Loading</div>
  </header>

  <section class="card add" aria-label="Add shipments">
    <label for="paste">Add shipments</label>
    <p class="hint">One tracking number per line. Add a note after a comma if you like, for example:
      1Z999AA10123456784, Acme order 4471</p>
    <textarea id="paste" spellcheck="false" autocomplete="off"></textarea>
    <div class="row-actions">
      <button class="primary" id="addBtn">Add to tracker</button>
      <span class="meta" id="quota"></span>
    </div>
    <div class="notice" id="addNotice" role="status"></div>
  </section>

  <h2>Needs attention <span class="count" id="c-attention">0</span></h2>
  <div class="card list" id="g-attention"></div>

  <h2>On the way <span class="count" id="c-moving">0</span></h2>
  <div class="card list" id="g-moving"></div>

  <h2>Delivered, last 14 days <span class="count" id="c-done">0</span>
    <button class="link" id="toggleDone">Show</button></h2>
  <div class="card list" id="g-done" hidden></div>
</div>

<script>
(function () {
  var STATE = {
    customs:   { label: "Customs hold",     group: "attention", order: 0 },
    problem:   { label: "Problem",          group: "attention", order: 1 },
    stalled:   { label: "Stalled",          group: "attention", order: 2 },
    notfound:  { label: "Not found",        group: "attention", order: 2.5 },
    out:       { label: "Out for delivery", group: "moving",    order: 3 },
    transit:   { label: "In transit",       group: "moving",    order: 4 },
    label:     { label: "Label created",    group: "moving",    order: 5 },
    looking:   { label: "Looking it up",    group: "moving",    order: 5.5 },
    delivered: { label: "Delivered",        group: "done",      order: 6 }
  };
  var open = {};       // shipment id -> true when expanded
  var eventsCache = {};
  var data = null;
  var lastState = {};      // shipment id -> state at the previous refresh
  var doneTouched = false; // true once the user has opened or closed Delivered themselves
  function setDone(show) {
    $("g-done").hidden = !show;
    $("toggleDone").textContent = show ? "Hide" : "Show";
  }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
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

  function ago(iso) {
    if (!iso) return "";
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (isNaN(mins)) return "";
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 36) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    var days = Math.round(hrs / 24);
    return days + " days ago";
  }
  function when(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function load() {
    return api("GET", "/api/shipments").then(function (j) {
      data = j;
      render();
    }).catch(function (e) {
      $("meta").textContent = "Could not load: " + e.message;
    });
  }

  // A new shipment is blank until Ship24 has heard back from the carrier.
  // While any are that fresh, keep asking so the board fills in by itself.
  var chaseTimer = null;
  function chaseNewOnes() {
    if (chaseTimer || !data) return;
    var fresh = data.shipments.filter(function (s) { return s.state === "looking"; });
    if (!fresh.length) return;
    var veryNew = fresh.some(function (s) {
      return (Date.now() - new Date(s.createdAt).getTime()) < 15 * 60000;
    });
    chaseTimer = setTimeout(function () {
      var chain = Promise.resolve();
      fresh.forEach(function (s) {
        chain = chain.then(function () {
          return api("POST", "/api/shipments/" + s.id + "/refresh", {}).catch(function () {});
        });
      });
      chain.then(function () { chaseTimer = null; return load(); });
    }, veryNew ? 20000 : 120000);
  }

  function render() {
    var groups = { attention: [], moving: [], done: [] };
    data.shipments.forEach(function (s) {
      var def = STATE[s.state] || STATE.transit;
      groups[def.group].push(s);
    });
    Object.keys(groups).forEach(function (g) {
      groups[g].sort(function (a, b) {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        var oa = (STATE[a.state] || STATE.transit).order, ob = (STATE[b.state] || STATE.transit).order;
        if (oa !== ob) return oa - ob;
        return String(a.lastEventAt || a.createdAt).localeCompare(String(b.lastEventAt || b.createdAt));
      });
      var box = $("g-" + g);
      box.textContent = "";
      $("c-" + g).textContent = groups[g].length;
      if (!groups[g].length) {
        box.appendChild(el("div", "empty", g === "attention" ? "Nothing needs you right now." :
          g === "moving" ? "No shipments on the way." : "Nothing delivered in the last 14 days."));
      }
      groups[g].forEach(function (s) { box.appendChild(shipRow(s)); });
    });
    // Never let a shipment vanish into a closed section: if one has just
    // been delivered, or was added in the last day, open Delivered.
    var reveal = groups.done.some(function (s) {
      var moved = lastState[s.id] && lastState[s.id] !== "delivered";
      var recent = (Date.now() - new Date(s.createdAt).getTime()) < 24 * 3600000;
      return moved || (recent && !doneTouched);
    });
    if (reveal) setDone(true);
    data.shipments.forEach(function (s) { lastState[s.id] = s.state; });
    $("quota").textContent = data.quota.used + " of " + data.quota.limit + " Ship24 slots used this month";
    $("addBtn").disabled = data.quota.used >= data.quota.limit;
    chaseNewOnes();
    $("meta").textContent = "Signed in as " + data.user + ". Flags after " + data.stallDays +
      " working days without a scan.";
  }

  function shipRow(s) {
    var def = STATE[s.state] || STATE.transit;
    var wrap = el("div", "ship");
    var sum = el("div", "summary");
    sum.setAttribute("role", "button");
    sum.setAttribute("tabindex", "0");
    sum.setAttribute("aria-expanded", open[s.id] ? "true" : "false");

    var st = el("div", "state");
    st.appendChild(el("span", "pill s-" + s.state, def.label));
    sum.appendChild(st);

    var mid = el("div");
    mid.appendChild(el("div", "title", s.label || s.trackingNumber));
    var idLine = (s.courier ? s.courier.toUpperCase() + "  " : "") + (s.label ? s.trackingNumber : "") +
      (s.destCountry ? "  to " + s.destCountry : "");
    if (idLine.trim()) mid.appendChild(el("div", "tn", idLine.trim()));
    if (s.reason) mid.appendChild(el("div", "reason", s.reason));
    var last = s.lastEventText
      ? "Last scan " + ago(s.lastEventAt) + ": " + s.lastEventText + (s.lastEventLocation ? " (" + s.lastEventLocation + ")" : "")
      : "No scans yet. Added " + ago(s.createdAt) + ".";
    mid.appendChild(el("div", "sub", last));
    if (s.error) mid.appendChild(el("div", "sub err", "Last check failed: " + s.error));
    sum.appendChild(mid);

    var star = el("button", "star" + (s.starred ? " on" : ""), s.starred ? "\\u2605" : "\\u2606");
    star.title = s.starred ? "Starred. Click to unstar." : "Star to pin this to the top";
    star.setAttribute("aria-label", star.title);
    star.setAttribute("aria-pressed", s.starred ? "true" : "false");
    star.addEventListener("click", function (ev) {
      ev.stopPropagation();
      api("POST", "/api/shipments/" + s.id + "/star", { starred: !s.starred }).then(load);
    });
    sum.appendChild(star);

    function toggle() {
      open[s.id] = !open[s.id];
      render();
    }
    sum.addEventListener("click", toggle);
    sum.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); }
    });
    wrap.appendChild(sum);
    if (open[s.id]) wrap.appendChild(detail(s));
    return wrap;
  }

  function detail(s) {
    var d = el("div", "detail");
    var tl = el("ul", "timeline");
    d.appendChild(tl);

    function fill(events) {
      tl.textContent = "";
      if (!events.length) {
        var li = el("li");
        li.appendChild(el("div", null, "No history from the carrier yet."));
        tl.appendChild(li);
        return;
      }
      events.forEach(function (e) {
        var li = el("li");
        li.appendChild(el("div", null, e.text || e.code || "Update"));
        li.appendChild(el("div", "when", when(e.at) + (e.location ? ", " + e.location : "")));
        tl.appendChild(li);
      });
    }
    if (eventsCache[s.id]) fill(eventsCache[s.id]);
    api("GET", "/api/shipments/" + s.id + "/events").then(function (j) {
      eventsCache[s.id] = j.events;
      fill(j.events);
    }).catch(function () {});

    var tools = el("div", "tools");
    var note = el("input");
    note.type = "text";
    note.value = s.label;
    note.placeholder = "Note, e.g. customer or order";
    note.setAttribute("aria-label", "Note for this shipment");
    var save = el("button", "small", "Save note");
    save.addEventListener("click", function () {
      api("POST", "/api/shipments/" + s.id + "/label", { label: note.value }).then(load);
    });
    var refresh = el("button", "small", "Check now");
    refresh.addEventListener("click", function () {
      refresh.disabled = true;
      refresh.textContent = "Checking";
      api("POST", "/api/shipments/" + s.id + "/refresh", {}).then(function () {
        delete eventsCache[s.id];
        return load();
      }).catch(function (e) {
        refresh.disabled = false;
        refresh.textContent = "Check now";
        window.console.error(e);
        tools.appendChild(el("span", "sub err", e.message));
      });
    });
    var remove = el("button", "small", "Remove");
    remove.title = "Hides it from the board. The Ship24 slot it used is not refunded.";
    remove.addEventListener("click", function () {
      if (remove.dataset.sure !== "1") {
        remove.dataset.sure = "1";
        remove.textContent = "Click again to remove";
        return;
      }
      api("POST", "/api/shipments/" + s.id + "/remove", {}).then(function () {
        delete open[s.id];
        return load();
      });
    });
    tools.appendChild(note);
    tools.appendChild(save);
    tools.appendChild(refresh);
    tools.appendChild(remove);
    d.appendChild(tools);
    d.appendChild(el("div", "sub", "Last checked with Ship24 " + (s.checkedAt ? ago(s.checkedAt) : "not yet") + "."));
    return d;
  }

  var RESULT_TEXT = {
    added: "added",
    duplicate: "already on the board",
    restored: "was removed before, now back on the board",
    over_limit: "not added: this month's Ship24 slots are used up",
    failed: "not added: Ship24 rejected it",
    suspect: "not added"
  };

  function norm(tn) { return String(tn || "").replace(/\\s+/g, "").toUpperCase(); }

  function submit(items) {
    var notice = $("addNotice");
    var btn = $("addBtn");
    var labels = {};
    items.forEach(function (x) { labels[norm(x.trackingNumber)] = x.label || ""; });
    notice.textContent = "";
    notice.className = "notice";
    btn.disabled = true;
    btn.textContent = "Adding";
    return api("POST", "/api/shipments", { items: items }).then(function (j) {
      var ul = el("ul");
      var allGood = true;
      j.report.forEach(function (r) {
        if (r.result !== "added") allGood = false;
        var li = el("li", null, r.trackingNumber + ": " + (RESULT_TEXT[r.result] || r.result) +
          (r.detail ? ". " + r.detail : ""));
        if (r.result === "suspect") {
          var force = el("button", "small", "Add it anyway");
          force.style.marginLeft = "8px";
          force.title = "Uses one Ship24 slot even if the number turns out to be wrong";
          force.addEventListener("click", function () {
            submit([{ trackingNumber: r.trackingNumber, label: labels[r.trackingNumber] || "", force: true }]);
          });
          li.appendChild(force);
        }
        ul.appendChild(li);
      });
      notice.appendChild(ul);
      if (allGood) $("paste").value = "";
      return load();
    }).catch(function (e) {
      notice.className = "notice err";
      notice.textContent = e.message;
    }).then(function () {
      btn.textContent = "Add to tracker";
      btn.disabled = data ? data.quota.used >= data.quota.limit : false;
    });
  }

  $("addBtn").addEventListener("click", function () {
    var items = $("paste").value.split(/\\r?\\n/).map(function (line) {
      var i = line.indexOf(",");
      var tn = (i === -1 ? line : line.slice(0, i)).trim();
      var label = i === -1 ? "" : line.slice(i + 1).trim();
      return { trackingNumber: tn, label: label };
    }).filter(function (x) { return x.trackingNumber; });
    if (!items.length) {
      $("addNotice").className = "notice";
      $("addNotice").textContent = "Paste at least one tracking number.";
      return;
    }
    submit(items);
  });

  $("toggleDone").addEventListener("click", function () {
    doneTouched = true;
    setDone($("g-done").hidden);
  });

  load();
  setInterval(load, 5 * 60 * 1000);
})();
</script>
</body>
</html>`;
