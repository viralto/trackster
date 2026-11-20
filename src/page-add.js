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
  .preview { margin-top: 14px; border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; background: var(--row-alt); }
  .phead { color: var(--ink); font-weight: 500; margin-bottom: 8px; }
  .ptable { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  .ptable th { text-align: left; font-weight: 400; color: var(--muted); padding: 4px 14px 4px 0; border-bottom: 1px solid var(--line); }
  .ptable td { padding: 5px 14px 5px 0; border-bottom: 1px solid var(--line); color: var(--ink); vertical-align: top; }
  .ptable tr:last-child td { border-bottom: 0; }
  .ptable .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; white-space: nowrap; }
  .ptable tr.odd td { color: var(--amber-ink); }
</style>
</head>
<body>
<div class="shell">
${sidebar("add")}
<main class="main">
  <h1 class="sr">Add shipments</h1>

  <section class="card section add" aria-label="Add shipments">
    <label for="paste">Add shipments</label>
    <p class="hint">Paste tracking numbers however they come: one per line, or several separated by commas.
      Add the customer or a note after a number if you like, for example: 1Z999AA10123456784, Acme order 4471.
      The list underneath shows how it will be read before anything is added.</p>
    <textarea id="paste" spellcheck="false" autocomplete="off" autofocus></textarea>
    <div id="preview" class="preview" aria-live="polite" hidden></div>
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

  function showReport(report, items) {
    var notice = $("addNotice");
    var labels = {};
    items.forEach(function (x) { labels[norm(x.trackingNumber)] = x.label || ""; });
    var ul = el("ul");
    var allGood = true;
    report.forEach(function (r) {
      if (r.result !== "added") allGood = false;
      var li = el("li", null, r.trackingNumber + ": " + (RESULT_TEXT[r.result] || r.result) +
        (r.detail ? ". " + r.detail : ""));
      if (r.result === "suspect") {
        var force = el("button", "small", "Add it anyway");
        force.style.marginLeft = "8px";
        force.title = "Adds it without checking that the number is the right shape";
        force.addEventListener("click", function () {
          force.disabled = true;
          api("POST", "/api/shipments", { items: [{ trackingNumber: r.trackingNumber, label: labels[r.trackingNumber] || "", force: true }] })
            .then(function (j) {
              var res = j.report[0] || {};
              li.textContent = r.trackingNumber + ": " + (RESULT_TEXT[res.result] || res.result || "not added");
              return load();
            }).catch(function (e) { force.disabled = false; li.appendChild(el("span", "err", " " + e.message)); });
        });
        li.appendChild(force);
      }
      ul.appendChild(li);
    });
    notice.appendChild(ul);
    var added = report.filter(function (r) { return r.result === "added" || r.result === "restored"; }).length;
    if (added) {
      var go = el("p", "after");
      var a = el("a", null, added === 1 ? "See it on the board" : "See them on the board");
      a.href = "/";
      go.appendChild(a);
      go.appendChild(document.createTextNode('. New shipments say "Looking it up" for a minute or two while the carrier answers.'));
      notice.appendChild(go);
    }
    if (allGood) { $("paste").value = ""; parsed = []; showPreview(); }
  }
  // What the engine makes of the box, refreshed as you type. The same list is what gets added.
  var parsed = [];
  var parseTimer = null, parseAsk = 0;
  function readBox() {
    var text = $("paste").value;
    var mine = ++parseAsk;
    if (!text.trim()) { parsed = []; showPreview(); return Promise.resolve(); }
    return api("POST", "/api/parse", { text: text }).then(function (j) {
      if (mine !== parseAsk) return;
      parsed = j.items;
      showPreview();
    }).catch(function () {});
  }
  function showPreview() {
    var box = $("preview");
    box.textContent = "";
    box.hidden = !parsed.length;
    if (!parsed.length) return;
    var good = parsed.filter(function (x) { return x.ok; }).length;
    var odd = parsed.length - good;
    var head = el("div", "phead", (parsed.length === 1 ? "1 shipment" : parsed.length + " shipments") + " found" +
      (odd ? ". " + odd + (odd === 1 ? " does" : " do") + " not look right and will be held back for you to check" : "") + ".");
    box.appendChild(head);
    var table = el("table", "ptable");
    var hr = el("tr");
    ["Carrier", "Tracking number", "Customer or note"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    table.appendChild(hr);
    parsed.forEach(function (x) {
      var tr = el("tr", x.ok ? null : "odd");
      tr.appendChild(el("td", null, x.ok ? (x.carrier === "ups" ? "UPS" : "FedEx") : "?"));
      tr.appendChild(el("td", "mono", x.trackingNumber));
      tr.appendChild(el("td", x.ok ? null : "why", x.ok ? (x.label || "") : x.why + (x.label ? " Note: " + x.label : "")));
      table.appendChild(tr);
    });
    box.appendChild(table);
  }
  $("paste").addEventListener("input", function () {
    clearTimeout(parseTimer);
    parseTimer = setTimeout(readBox, 250);
  });

  // Sent in small batches so a long list never trips the engine's per-request limits.
  var BATCH = 10;
  function submitAll(items) {
    var notice = $("addNotice");
    var btn = $("addBtn");
    var report = [];
    var chain = Promise.resolve();
    notice.textContent = "";
    notice.className = "notice";
    btn.disabled = true;
    for (var i = 0; i < items.length; i += BATCH) {
      (function (chunk, upTo) {
        chain = chain.then(function () {
          btn.textContent = "Adding " + Math.min(upTo, items.length) + " of " + items.length;
          return api("POST", "/api/shipments", { items: chunk }).then(function (j) { report = report.concat(j.report); });
        });
      })(items.slice(i, i + BATCH), i + BATCH);
    }
    return chain.then(function () {
      showReport(report, items);
    }).catch(function (e) {
      if (report.length) showReport(report, items);
      var p = el("p", "err", (report.length ? "Stopped part way: " : "") + e.message);
      notice.appendChild(p);
    }).then(function () {
      btn.textContent = "Add to tracker";
      return load();
    });
  }

  $("addBtn").addEventListener("click", function () {
    clearTimeout(parseTimer);
    readBox().then(function () {
      if (!parsed.length) {
        $("addNotice").className = "notice";
        $("addNotice").textContent = "Paste at least one tracking number.";
        return;
      }
      submitAll(parsed.map(function (x) { return { trackingNumber: x.trackingNumber, label: x.label }; }));
    });
  });

  load();
})();
</script>
</body>
</html>`;
