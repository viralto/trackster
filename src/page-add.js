// Add shipments: paste tracking numbers, one per line.

import { THEME_HEAD, THEME_CSS, WHO_JS, sidebar } from "./theme.js";

export const ADD_PAGE = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dot Logistics: Add shipments</title>
${THEME_HEAD}
<style>
${THEME_CSS}
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .main > .section:first-of-type { margin-top: 0; }
  .add { max-width: 900px; }
  .add label { color: var(--ink); font-weight: 500; display: block; margin-bottom: 4px; }
  textarea { width: 100%; min-height: 220px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
  .row-actions { display: flex; align-items: center; gap: 14px; margin-top: 12px; flex-wrap: wrap; }
  .meta { color: var(--muted); font-size: 13.5px; }
  .notice { margin-top: 10px; font-size: 14px; color: var(--ink); }
  .notice ul { margin: 4px 0 0; padding-left: 18px; }
  .notice .after { margin: 12px 0 0; color: var(--muted); }
  .err { color: var(--red-ink); }
</style>
</head>
<body>
<div class="shell">
${sidebar("add")}
<main class="main">
  <h1 class="sr">Add shipments</h1>

  <section class="card section add" aria-label="Add shipments">
    <label for="paste">Add shipments</label>
    <p class="hint">One tracking number per line, up to 20 at a time. Add the customer or a note after a comma if you like,
      for example: 1Z999AA10123456784, Acme order 4471</p>
    <textarea id="paste" spellcheck="false" autocomplete="off" autofocus></textarea>
    <div class="row-actions">
      <button class="primary" id="addBtn">Add to tracker</button>
      <span class="meta" id="quota"></span>
    </div>
    <div class="notice" id="addNotice" role="status"></div>
  </section>
</main>
</div>

<script>
(function () {
${WHO_JS}
  var data = null;
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

  // Only needed here for the sidebar counts and the monthly allowance.
  function load() {
    return api("GET", "/api/shipments").then(function (j) {
      data = j;
      var full = j.quota.used >= j.quota.limit;
      $("quota").textContent = full
        ? "This month's tracking allowance has been used up. New shipments can be added again next month." : "";
      $("addBtn").disabled = full;
      showUser(j.user);
      showStats(j.shipments);
    }).catch(function () {});
  }

  var RESULT_TEXT = {
    added: "added",
    duplicate: "already on the board",
    restored: "was removed before, now back on the board",
    over_limit: "not added: this month's tracking allowance has been used up",
    failed: "not added: the tracking service rejected it",
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
          force.title = "Adds it without checking that the number is the right shape";
          force.addEventListener("click", function () {
            submit([{ trackingNumber: r.trackingNumber, label: labels[r.trackingNumber] || "", force: true }]);
          });
          li.appendChild(force);
        }
        ul.appendChild(li);
      });
      notice.appendChild(ul);
      var added = j.report.filter(function (r) { return r.result === "added" || r.result === "restored"; }).length;
      if (added) {
        var go = el("p", "after");
        var a = el("a", null, added === 1 ? "See it on the board" : "See them on the board");
        a.href = "/";
        go.appendChild(a);
        go.appendChild(document.createTextNode('. New shipments say "Looking it up" for a minute or two while the carrier answers.'));
        notice.appendChild(go);
      }
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


  load();
})();
</script>
</body>
</html>`;
