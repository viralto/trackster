// History: every shipment that has been delivered or removed, newest first.
// Reads /api/history a page at a time; the search box is answered by the engine.

import { THEME_HEAD, THEME_CSS, ROW_CSS, ROW_JS, FILTER_CSS, FILTER_HTML, FILTER_JS, WHO_JS, sidebar } from "./theme.js";

export const HISTORY_PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Shipment history</title>
${THEME_HEAD}
<style>
${THEME_CSS}
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .main > .section:first-of-type { margin-top: 0; }
${FILTER_CSS}
  .tools-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin: 16px 4px 0; }
  a.dl { text-decoration: none; border: 1px solid #dcdfe6; border-radius: 6px; padding: 8px 16px; font-weight: 400;
    color: var(--text); background: #fff; white-space: nowrap; }
  a.dl:hover { border-color: var(--teal); color: var(--teal-deep); }
  .meta { color: var(--muted); font-size: 13.5px; }
  .err { color: var(--red-ink); }
  .group { margin-top: 24px; padding: 6px 26px 10px; }
  .grouphead { display: flex; align-items: baseline; gap: 16px; padding: 16px 0 14px; border-bottom: 1px solid var(--line);
    color: var(--ink); font-size: 16px; font-weight: 500; flex-wrap: wrap; }
  .grouphead .tally { color: var(--muted); font-size: 14px; font-weight: 300; }
${ROW_CSS}
  .summary { grid-template-columns: 28px 170px 1fr auto; }
  .ship.gone .summary > .dot, .ship.gone .summary > .state, .ship.gone .summary > .mid { opacity: .5; }
  .s-removed { background: #f5f5f6; color: var(--text); border-color: var(--line); }
  .empty { padding: 20px 4px; color: var(--muted); }
  .more { text-align: center; margin-top: 24px; }
</style>
</head>
<body>
<div class="shell">
${sidebar("history")}
<main class="main">
  <h1 class="sr">Shipment history</h1>

${FILTER_HTML}
  <div class="tools-row">
    <span class="meta" id="meta" role="status">&nbsp;</span>
    <a class="dl" id="dl" href="/api/history.csv">Download as spreadsheet</a>
  </div>

  <div id="list"></div>
  <div class="more"><button id="more" hidden>Show more</button></div>
</main>
</div>

<script>
(function () {
${WHO_JS}
${FILTER_JS}
  var STATE_LABEL = {
    customs: "Customs hold", problem: "Problem", stalled: "Stalled", notfound: "Not found",
    out: "Out for delivery", transit: "In transit", label: "Label created", looking: "Looking it up",
    delivered: "Delivered"
  };
  var items = [];      // rows loaded so far
  var months = {};     // month totals from the engine
  var nextOffset = null;
  var open = {};
  var eventsCache = {};
  var asked = 0;       // guards against a slow answer overwriting a newer search

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
  function when(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function monthName(ym) {
    var d = new Date(ym + "-15T12:00:00Z");
    return isNaN(d) ? ym : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  }
${ROW_JS}

  function fetchPage(offset) {
    var mine = ++asked;
    var fq = filterQuery();
    var narrowed = filterOn();
    var path = "/api/history?offset=" + offset + (fq ? "&" + fq : "");
    return api("GET", path).then(function (j) {
      if (mine !== asked) return;
      items = offset ? items.concat(j.items) : j.items;
      months = j.months;
      nextOffset = j.nextOffset;
      showUser(j.user);
      var shown = items.length;
      $("meta").className = "meta";
      $("meta").textContent = !j.total
        ? (narrowed ? "Nothing in history matches that." : "Nothing here yet. Shipments appear once they are delivered or removed.")
        : (shown < j.total ? "Showing " + shown + " of " + j.total : j.total + (j.total === 1 ? " shipment" : " shipments"));
      setMonths(j.firstMonth);
      showFilterMeta(j.total === 1 ? "1 shipment in history" : j.total + " shipments in history");
      render();
    }).catch(function (e) {
      if (mine !== asked) return;
      $("meta").className = "meta err";
      $("meta").textContent = "Could not load history: " + e.message;
    });
  }
  function reload() { return fetchPage(0); }

  function tally(m) {
    var t = months[m];
    if (!t) return "";
    var bits = [];
    bits.push(t.delivered + " delivered");
    if (t.judged) bits.push(t.ontime + " of " + t.judged + " on time");
    if (t.removed) bits.push(t.removed + " removed");
    return bits.join(", ");
  }

  function render() {
    var list = $("list");
    list.textContent = "";
    var current = null, box = null;
    items.forEach(function (s) {
      if (s.month !== current) {
        current = s.month;
        var card = el("section", "card group");
        var head = el("div", "grouphead");
        head.appendChild(el("span", null, monthName(current)));
        head.appendChild(el("span", "tally", tally(current)));
        card.appendChild(head);
        box = el("div");
        card.appendChild(box);
        list.appendChild(card);
      }
      box.appendChild(shipRow(s));
    });
    $("more").hidden = nextOffset === null;
    var fq = filterQuery();
    $("dl").href = "/api/history.csv" + (fq ? "?" + fq : "");
  }

  function shipRow(s) {
    var wrap = el("div", "ship" + (s.removed ? " gone" : ""));
    var sum = el("div", "summary");
    sum.setAttribute("role", "button");
    sum.setAttribute("tabindex", "0");
    sum.setAttribute("aria-expanded", open[s.id] ? "true" : "false");

    sum.appendChild(el("span", "dot d-" + s.state));
    var st = el("div", "state");
    st.appendChild(s.removed ? el("span", "pill s-removed", "Removed") : el("span", "pill s-" + s.state, STATE_LABEL[s.state] || s.state));
    sum.appendChild(st);

    var mid = el("div", "mid");
    mid.appendChild(el("div", "title", s.label || s.trackingNumber));
    var idLine = (s.courier ? s.courier.toUpperCase() + "  " : "") + (s.label ? s.trackingNumber : "") +
      (s.destCountry ? "  to " + s.destCountry : "");
    if (idLine.trim()) mid.appendChild(el("div", "tn", idLine.trim()));
    var line = s.deliveredAt
      ? "Delivered " + when(s.deliveredAt) + (s.lastEventLocation ? " (" + s.lastEventLocation + ")" : "")
      : (s.lastEventText ? "Last scan " + when(s.lastEventAt) + ": " + s.lastEventText : "No scans were ever received") +
        ". Was " + (STATE_LABEL[s.state] || s.state).toLowerCase() + " when removed.";
    mid.appendChild(el("div", "sub", line));
    var due = dueLine(s.timing);
    if (due && s.deliveredAt) mid.appendChild(el("div", "sub" + (s.timing.status === "late" ? " err" : ""), due));
    sum.appendChild(mid);

    if (s.removed) {
      var back = el("button", "small", "Restore");
      back.title = "Puts it back on the board";
      back.addEventListener("click", function (ev) {
        ev.stopPropagation();
        back.disabled = true;
        api("POST", "/api/shipments/" + s.id + "/restore", {}).then(function () {
          return fetchPage(0);
        }).then(refreshStats).catch(function (e) {
          back.disabled = false;
          $("meta").className = "meta err";
          $("meta").textContent = "Could not restore it: " + e.message;
        });
      });
      sum.appendChild(back);
    } else {
      sum.appendChild(el("span"));
    }

    function toggle() { open[s.id] = !open[s.id]; render(); }
    sum.addEventListener("click", toggle);
    sum.addEventListener("keydown", function (ev) {
      if (ev.target !== sum) return;
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
        li.appendChild(el("div", null, "No history from the carrier."));
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
    else api("GET", "/api/shipments/" + s.id + "/events").then(function (j) {
      eventsCache[s.id] = j.events;
      fill(j.events);
    }).catch(function () {});
    d.appendChild(el("div", "sub", "Added " + when(s.createdAt) + "."));
    return d;
  }

  // Typing waits a moment before asking; buttons and dates ask straight away.
  var typing = null;
  initFilters(function (now) {
    clearTimeout(typing);
    open = {};
    if (now) reload(); else typing = setTimeout(reload, 250);
  });
  $("more").addEventListener("click", function () {
    if (nextOffset === null) return;
    $("more").disabled = true;
    fetchPage(nextOffset).then(function () { $("more").disabled = false; });
  });

  function refreshStats() {
    return api("GET", "/api/shipments").then(function (j) { showStats(j.shipments); }).catch(function () {});
  }
  reload();
  refreshStats();
})();
</script>
</body>
</html>`;
