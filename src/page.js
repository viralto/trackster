// The board. One page, no build step. Kept in its own file so the engine
// (index.js) can later serve a different screen without being touched.

import { THEME_HEAD, THEME_CSS, ROW_CSS, ROW_JS, FILTER_CSS, filterHtml, SORT_BUTTON, FILTER_JS, WHO_JS, sidebar } from "./theme.js";

export const PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dot Logistics: Shipments</title>
${THEME_HEAD}
<style>
${THEME_CSS}
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .main > .section:first-of-type { margin-top: 0; }
  .notice { margin: 10px 4px 0; font-size: 14px; }
  .notice:empty { display: none; }
  .err { color: var(--red-ink); }
${FILTER_CSS}

  .group { margin-top: 24px; padding: 6px 26px 10px; }
  .grouphead { display: flex; align-items: center; gap: 10px; padding: 16px 0 14px; border-bottom: 1px solid var(--line);
    color: var(--muted); font-size: 14.5px; font-weight: 300; }
  .grouphead .count { background: var(--teal-pill); color: var(--teal-deep); border: 1px solid var(--teal-line);
    border-radius: 4px; padding: 0 8px; font-size: 12.5px; font-weight: 400; }
  .grouphead button { margin-left: auto; }
  .grouphead .headlinks { margin-left: auto; display: flex; gap: 18px; align-items: center; }
  .grouphead .headlinks button { margin-left: 0; }
  .grouphead .sortbtn { padding: 5px 11px; font-size: 13.5px; }
  .grouphead .headlinks a { font-size: 14.5px; text-decoration: none; }
${ROW_CSS}
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
  <h1 class="sr">Shipments</h1>

${filterHtml()}
  <div class="notice err" id="boardNotice" role="status"></div>

  <section class="card group" id="sec-open">
    <div class="grouphead"><span id="openTitle">Open shipments</span> <span class="count" id="c-open">0</span>
      <button class="link" id="showAll" hidden>Show all</button></div>
    <div id="g-open"></div>
  </section>

  <section class="card group" id="sec-done">
    <div class="grouphead">Delivered, last 14 days <span class="count" id="c-done">0</span>
      <span class="headlinks">${SORT_BUTTON}<a href="/history">All history</a><button class="link" id="toggleDone">Show</button></span></div>
    <div id="g-done" hidden></div>
  </section>
</main>
</div>

<script>
(function () {
${WHO_JS}
${FILTER_JS}
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
      $("boardNotice").textContent = "";
      render();
    }).catch(function (e) {
      $("boardNotice").textContent = "Could not load shipments: " + e.message;
    });
  }

  // A new shipment is blank until the tracking service has heard back from the carrier.
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
    var found = 0;
    var narrowed = filterOn();
    data.shipments.forEach(function (s) {
      var def = STATE[s.state] || STATE.transit;
      groups[def.group].push(s);
    });
    Object.keys(groups).forEach(function (g) {
      groups[g].sort(function (a, b) {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        if (g === "done") {
          // Delivered shipments follow the newest/oldest button, by the day they arrived.
          var ka = String(a.deliveredAt || ""), kb = String(b.deliveredAt || "");
          return F.sort === "old" ? ka.localeCompare(kb) : kb.localeCompare(ka);
        }
        // Open shipments: the ones needing attention first, then longest without a scan.
        var oa = (STATE[a.state] || STATE.transit).order, ob = (STATE[b.state] || STATE.transit).order;
        if (oa !== ob) return oa - ob;
        return String(a.lastEventAt || a.createdAt).localeCompare(String(b.lastEventAt || b.createdAt));
      });
      var box = $("g-" + g);
      box.textContent = "";
      var list = groups[g];
      var total = list.length;
      list = list.filter(filterMatches);
      if (g === "open") {
        if (statFilter) list = list.filter(function (s) { return statFilter.states.indexOf(s.state) !== -1; });
        $("openTitle").textContent = statFilter ? statFilter.label : "Open shipments";
        $("c-open").textContent = statFilter || narrowed ? list.length + " of " + total : String(total);
        $("showAll").hidden = !statFilter;
      } else {
        $("c-" + g).textContent = narrowed ? list.length + " of " + total : String(total);
        if (narrowed && list.length) setDone(true);
      }
      found += list.length;
      if (!list.length) {
        box.appendChild(el("div", "empty", narrowed
          ? (g === "done" ? "Nothing delivered in the last 14 days matches." : "No open shipments match.")
          : g === "done" ? "Nothing delivered in the last 14 days." :
            statFilter ? "No shipments are in this state right now." : "No open shipments."));
        if (g === "open" && !narrowed && !statFilter && !total) {
          var go = el("a", null, "Add some shipments");
          go.href = "/add";
          box.lastChild.appendChild(document.createTextNode(" "));
          box.lastChild.appendChild(go);
          box.lastChild.appendChild(document.createTextNode("."));
        }
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
    setMonths(data.firstMonth);
    var hand = el("span");
    hand.appendChild(document.createTextNode(" Older ones are in "));
    var link = el("a", null, "History");
    link.href = "/history?" + filterQuery();
    hand.appendChild(link);
    hand.appendChild(document.createTextNode("."));
    showFilterMeta(found === 1 ? "1 shipment on the board" : found + " shipments on the board", hand);
    chaseNewOnes();
    showUser(data.user);
    showStats(data.shipments);
  }

${ROW_JS}
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
    var due = dueLine(s.timing);
    if (due) mid.appendChild(el("div", "sub" + (s.timing.status === "late" || overdue(s.timing) ? " err" : ""), due));
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
        var li = el("li", e.customs ? "c-" + e.customs : null);
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
    remove.title = "Hides it from the board. It stays in History, where it can be restored.";
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
    d.appendChild(el("div", "sub", "Last checked " + (s.checkedAt ? ago(s.checkedAt) : "not yet") + "."));
    return d;
  }

  initFilters(function () { if (data) render(); });

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
