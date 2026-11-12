// The board. One page, no build step. Kept in its own file so the engine
// (index.js) can later serve a different screen without being touched.

import { THEME_HEAD, THEME_CSS, WHO_JS, sidebar } from "./theme.js";

export const PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Shipments</title>
${THEME_HEAD}
<style>
${THEME_CSS}
  .add label { color: var(--ink); font-weight: 500; display: block; margin-bottom: 4px; }
  textarea { width: 100%; min-height: 76px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
  .row-actions { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
  .meta { color: var(--muted); font-size: 13.5px; }
  .notice { margin-top: 10px; font-size: 14px; }
  .notice ul { margin: 4px 0 0; padding-left: 18px; }
  .err { color: var(--red-ink); }

  .group { margin-top: 24px; padding: 6px 26px 10px; }
  .grouphead { display: flex; align-items: center; gap: 10px; padding: 16px 0 14px; border-bottom: 1px solid var(--line);
    color: var(--muted); font-size: 14.5px; font-weight: 300; }
  .grouphead .count { background: var(--teal-pill); color: var(--teal-deep); border: 1px solid var(--teal-line);
    border-radius: 4px; padding: 0 8px; font-size: 12.5px; font-weight: 400; }
  .grouphead button { margin-left: auto; }
  .ship { border-bottom: 1px solid var(--line); }
  .ship:last-child { border-bottom: 0; }
  .summary { display: grid; grid-template-columns: 28px 170px 1fr auto; gap: 14px; align-items: center;
    padding: 16px 4px; cursor: pointer; }
  .summary:hover { background: var(--row-alt); }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--grey-dot); justify-self: center; }
  .d-customs, .d-problem { background: var(--red); }
  .d-stalled, .d-notfound { background: var(--amber); }
  .d-transit, .d-out { background: var(--teal); }
  .d-delivered { background: var(--green); }
  .pill { display: inline-block; border-radius: 4px; padding: 4px 10px; font-size: 12.5px; font-weight: 400;
    letter-spacing: .03em; text-transform: uppercase; white-space: nowrap;
    background: var(--teal-pill); color: var(--teal-deep); border: 1px solid var(--teal-line); }
  .s-customs, .s-problem { background: var(--red-wash); color: var(--red-ink); border-color: #f3cfd4; }
  .s-stalled, .s-notfound { background: var(--amber-wash); color: var(--amber-ink); border-color: #f3e0b3; }
  .s-label, .s-looking, .s-delivered { background: #f5f5f6; color: var(--text); border-color: var(--line); }
  .title { color: var(--ink); font-weight: 500; }
  .tn { font-size: 13.5px; color: var(--muted); letter-spacing: .02em; }
  .reason { color: var(--ink); margin-top: 2px; }
  .sub { color: var(--muted); font-size: 13.5px; margin-top: 2px; }
  .star { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #dcdfe6; background: #fff; font-size: 18px;
    line-height: 1; padding: 0; color: var(--muted); }
  .star.on { background: var(--teal); border-color: var(--teal); color: #fff; }
  .detail { padding: 2px 4px 18px 216px; }
  .timeline { list-style: none; margin: 0 0 14px; padding: 0; border-left: 2px solid var(--line); }
  .timeline li { padding: 4px 0 8px 14px; position: relative; color: var(--ink); }
  .timeline li::before { content: ""; position: absolute; left: -6px; top: 11px; width: 10px; height: 10px;
    border-radius: 50%; background: var(--teal); border: 2px solid #fff; }
  .timeline .when { color: var(--muted); font-size: 13px; }
  .tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .tools input[type=text] { max-width: 280px; padding: 5px 9px; font-size: 13.5px; }
  .empty { padding: 20px 4px; color: var(--muted); }
  @media (max-width: 860px) {
    .summary { grid-template-columns: 22px 1fr auto; }
    .summary .state { grid-column: 2; }
    .summary .mid { grid-column: 2; }
    .summary .star { grid-row: 1; grid-column: 3; }
    .detail { padding-left: 40px; }
  }
</style>
</head>
<body>
<div class="shell">
${sidebar("board")}
<main class="main">
  <div class="card pagehead">
    <h1>Shipments</h1>
    <div class="tag" id="meta">Where every parcel is, and which ones need you</div>
  </div>

  <section class="card section add" aria-label="Add shipments">
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

  <section class="card group" id="sec-open">
    <div class="grouphead"><span id="openTitle">Open shipments</span> <span class="count" id="c-open">0</span>
      <button class="link" id="showAll" hidden>Show all</button></div>
    <div id="g-open"></div>
  </section>

  <section class="card group" id="sec-done">
    <div class="grouphead">Delivered, last 14 days <span class="count" id="c-done">0</span>
      <button class="link" id="toggleDone">Show</button></div>
    <div id="g-done" hidden></div>
  </section>
</main>
</div>

<script>
(function () {
${WHO_JS}
  var STATE = {
    customs:   { label: "Customs hold",     group: "open", order: 0 },
    problem:   { label: "Problem",          group: "open", order: 1 },
    stalled:   { label: "Stalled",          group: "open", order: 2 },
    notfound:  { label: "Not found",        group: "open", order: 2.5 },
    out:       { label: "Out for delivery", group: "open",    order: 3 },
    transit:   { label: "In transit",       group: "open",    order: 4 },
    label:     { label: "Label created",    group: "open",    order: 5 },
    looking:   { label: "Looking it up",    group: "open",    order: 5.5 },
    delivered: { label: "Delivered",        group: "done",      order: 6 }
  };
  var open = {};       // shipment id -> true when expanded
  var eventsCache = {};
  var data = null;
  var statFilter = null;   // set when a sidebar count has been clicked
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
    var groups = { open: [], done: [] };
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
      var list = groups[g];
      if (g === "open") {
        var total = list.length;
        if (statFilter) list = list.filter(function (s) { return statFilter.states.indexOf(s.state) !== -1; });
        $("openTitle").textContent = statFilter ? statFilter.label : "Open shipments";
        $("c-open").textContent = statFilter ? list.length + " of " + total : String(total);
        $("showAll").hidden = !statFilter;
      } else {
        $("c-" + g).textContent = list.length;
      }
      if (!list.length) {
        box.appendChild(el("div", "empty", g === "done" ? "Nothing delivered in the last 14 days." :
          statFilter ? "No shipments are in this state right now." : "No open shipments."));
      }
      list.forEach(function (s) { box.appendChild(shipRow(s)); });
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
    showUser(data.user);
    showStats(data.shipments);
  }

  function shipRow(s) {
    var def = STATE[s.state] || STATE.transit;
    var wrap = el("div", "ship");
    var sum = el("div", "summary");
    sum.setAttribute("role", "button");
    sum.setAttribute("tabindex", "0");
    sum.setAttribute("aria-expanded", open[s.id] ? "true" : "false");

    sum.appendChild(el("span", "dot d-" + s.state));
    var st = el("div", "state");
    st.appendChild(el("span", "pill s-" + s.state, def.label));
    sum.appendChild(st);

    var mid = el("div", "mid");
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

  // A sidebar count narrows the list to that state. Delivered opens its section.
  function followHash() {
    var h = location.hash.slice(1);
    var target = null;
    if (h.indexOf("show-") === 0) {
      var key = h.slice(5);
      statFilter = STAT_ROWS.filter(function (r) { return r.key === key; })[0] || null;
      target = $("sec-open");
    } else if (h === "sec-done") {
      doneTouched = true;
      setDone(true);
      target = $("sec-done");
    } else {
      statFilter = null;
      if (h === "sec-open") target = $("sec-open");
    }
    if (data) render();
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("showAll").addEventListener("click", function () { location.hash = "sec-open"; });
  window.addEventListener("hashchange", followHash);

  load().then(followHash);
  setInterval(load, 5 * 60 * 1000);
})();
</script>
</body>
</html>`;
