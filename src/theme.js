// Shared look for every page, matched to VTAP Cloud: white sidebar, teal
// accents, light type, white cards on a near-white page.
// Colours were sampled from VTAP Cloud itself. Two are our own additions:
// --teal-deep (small teal text and solid buttons need more contrast than the
// brand teal gives on white) and the amber used for "Stalled".

export const THEME_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet">`;

export const THEME_CSS = `
  :root {
    --teal: #6cbacd; --teal-deep: #2b7a8c; --teal-wash: #f0f8fa; --teal-pill: #edf8fa; --teal-line: #d5ecf2;
    --page: #fafafa; --card: #ffffff; --line: #ebedf4; --row-alt: #f5f7fa;
    --ink: #343436; --text: #616266; --muted: #909297; --label: #6e6b6a; --faint: #b4b4b4;
    --red: #c63144; --red-wash: #fbeaec; --red-ink: #a3283a;
    --amber: #e0a030; --amber-wash: #fdf4df; --amber-ink: #855a00;
    --green: #88c148; --grey-dot: #b4b4b4;
    --shadow: 0 6px 24px rgba(52, 52, 54, 0.06);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { background: var(--page); color: var(--text);
    font: 300 15px/1.55 "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  a { color: var(--teal-deep); }
  .shell { display: grid; grid-template-columns: 270px 1fr; min-height: 100vh; }

  /* sidebar */
  .side { background: var(--card); border-right: 1px solid var(--line); display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  .brand { padding: 30px 28px 26px; border-bottom: 1px solid var(--line); }
  .brand .name { color: var(--teal); font-size: 25px; white-space: nowrap; font-weight: 300; letter-spacing: .04em; line-height: 1.1; text-transform: uppercase; }
  .brand .sub { color: var(--ink); font-size: 13px; margin-top: 2px; }
  .who { display: flex; align-items: center; gap: 14px; padding: 18px 24px; border-bottom: 1px solid var(--line); }
  .avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--teal); color: #fff; flex: none;
    display: flex; align-items: center; justify-content: center; font-weight: 400; font-size: 14px; letter-spacing: .03em; }
  .who .n { color: var(--ink); font-weight: 600; font-size: 14.5px; line-height: 1.3; overflow-wrap: anywhere; }
  .who .o { color: var(--ink); font-size: 14px; line-height: 1.3; }
  .navlabel { color: var(--label); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; padding: 34px 28px 8px; }
  .nav a { display: flex; align-items: center; gap: 18px; padding: 13px 28px; color: var(--ink); text-decoration: none;
    font-size: 16.5px; font-weight: 400; border-right: 5px solid transparent; }
  .nav a svg { width: 26px; height: 26px; stroke: var(--teal); fill: none; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; flex: none; }
  .nav a.on { background: var(--teal-wash); border-right-color: var(--teal); }
  .nav a:hover { background: var(--teal-wash); }
  .stats { padding: 2px 0 6px; }
  .stats a { display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 14px;
    padding: 8px 28px 8px 34px; color: var(--ink); text-decoration: none; font-size: 14.5px; font-weight: 300; }
  .stats a:hover { background: var(--teal-wash); }
  .stats .sd { width: 11px; height: 11px; border-radius: 50%; background: var(--grey-dot); }
  .stats .sd.red { background: var(--red); } .stats .sd.amber { background: var(--amber); }
  .stats .sd.teal { background: var(--teal); } .stats .sd.green { background: var(--green); }
  .stats .num { font-weight: 500; font-size: 15px; min-width: 22px; text-align: right; }
  .stats a.zero { color: var(--faint); }
  .stats a.zero .sd { opacity: .35; }
  .stats a.zero .num { font-weight: 300; }
  .stats .total { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 12px; }
  .side .foot { margin-top: auto; padding: 20px 28px; color: var(--teal-deep); font-size: 12.5px; }

  /* main */
  .main { padding: 22px 24px 70px; min-width: 0; }
  .card { background: var(--card); border-radius: 12px; box-shadow: var(--shadow); }
  .pagehead { display: flex; align-items: center; gap: 28px; padding: 22px 26px 26px; flex-wrap: wrap; }
  .pagehead h1 { margin: 0; color: var(--teal); font-size: 34px; font-weight: 300; line-height: 1.2; }
  .pagehead .tag { color: var(--label); font-style: italic; font-size: 16px; border-left: 1px solid var(--line); padding: 10px 0 10px 28px; }
  .section { margin-top: 24px; padding: 22px 26px; }
  h2 { margin: 0 0 4px; color: var(--ink); font-size: 16px; font-weight: 500; }
  .hint { color: var(--muted); font-size: 13.5px; margin: 0 0 12px; }

  /* controls */
  textarea, select, input[type=text], input[type=number] { font: inherit; color: var(--ink); background: #fff;
    border: 1px solid #dcdfe6; border-radius: 6px; padding: 8px 10px; }
  textarea:focus, select:focus, input:focus { outline: 2px solid var(--teal); outline-offset: 1px; border-color: var(--teal); }
  button { font: inherit; font-weight: 400; border-radius: 6px; border: 1px solid #dcdfe6; background: #fff;
    color: var(--text); padding: 8px 16px; cursor: pointer; }
  button:hover { border-color: var(--teal); color: var(--teal-deep); }
  button.primary { background: var(--teal-deep); border-color: var(--teal-deep); color: #fff; font-weight: 500; }
  button.primary:hover { background: #24697a; color: #fff; }
  button:disabled { opacity: .5; cursor: default; }
  button.link { border: 0; background: none; color: var(--teal-deep); padding: 0; }
  button.small { padding: 5px 11px; font-size: 13px; }
  input[type=radio], input[type=checkbox] { width: 18px; height: 18px; accent-color: var(--teal-deep); }

  @media (max-width: 860px) {
    .shell { grid-template-columns: 1fr; }
    .side { border-right: 0; border-bottom: 1px solid var(--line); position: static; height: auto; }
    .brand { padding: 18px 20px 14px; }
    .who, .navlabel, .stats, .side .foot { display: none; }
    .nav { display: flex; }
    .nav a { flex: 1; justify-content: center; padding: 10px 6px; border-right: 0; border-bottom: 4px solid transparent; font-size: 13.5px; gap: 8px; text-align: center; }
    .nav a svg { display: none; }
    .nav a.on { border-bottom-color: var(--teal); }
    .main { padding: 14px 12px 60px; }
    .pagehead .tag { border-left: 0; padding: 0; }
  }
`;

// Shipment rows: used by the board and by History.
export const ROW_CSS = `
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
  .sub.err { color: var(--red-ink); }
  .star { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #dcdfe6; background: #fff; font-size: 18px;
    line-height: 1; padding: 0; color: var(--muted); }
  .star.on { background: var(--teal); border-color: var(--teal); color: #fff; }
  .detail { padding: 2px 4px 18px 216px; }
  .timeline { list-style: none; margin: 0 0 14px; padding: 0; border-left: 2px solid var(--line); }
  .timeline li { padding: 4px 0 8px 14px; position: relative; color: var(--ink); }
  .timeline li::before { content: ""; position: absolute; left: -6px; top: 11px; width: 10px; height: 10px;
    border-radius: 50%; background: var(--teal); border: 2px solid #fff; }
  .timeline li.c-hold::before { background: var(--red); }
  .timeline li.c-in::before { background: var(--amber); }
  .timeline li.c-cleared::before { background: var(--green); }
  .timeline li.c-hold, .timeline li.c-in { font-weight: 400; }
  .timeline .when { color: var(--muted); font-size: 13px; }
`;

// Due / on time / late wording, shared by both pages.
export const ROW_JS = `
  function niceDay(ymd) {
    var d = new Date(ymd + "T12:00:00Z");
    return isNaN(d) ? ymd : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }
  // One line on whether it is due, on time or late, against the carrier's first estimate.
  function overdue(t) {
    return !!t && t.status === "due" && t.due < new Date().toISOString().slice(0, 10);
  }
  function dueLine(t) {
    if (!t || !t.due) return "";
    if (t.status === "due") {
      var now = t.revised ? ". Carrier now says " + niceDay(t.revised) : "";
      return (overdue(t) ? "Was due " + niceDay(t.due) + ", not delivered yet" : "Due " + niceDay(t.due)) + now;
    }
    if (t.status === "ontime") return "Delivered on time. Was due " + niceDay(t.due);
    if (t.status === "late") return "Delivered " + t.daysLate + (t.daysLate === 1 ? " day" : " days") + " late. Was due " + niceDay(t.due);
    return "";
  }

`;

// The filter bar at the top of the board and of History.
export const FILTER_CSS = `
  .filters { padding: 16px 26px; }
  .frow { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
  .frow[hidden] { display: none; }
  .frow input[type=text] { flex: 1; min-width: 240px; padding: 10px 12px; }
  .seg { display: inline-flex; border: 1px solid #dcdfe6; border-radius: 6px; overflow: hidden; }
  .seg button { border: 0; border-radius: 0; border-left: 1px solid #dcdfe6; padding: 9px 16px; background: #fff; }
  .seg button:first-child { border-left: 0; }
  .seg button.on { background: var(--teal-deep); color: #fff; font-weight: 500; }
  .frow label.when { display: inline-flex; align-items: center; gap: 8px; color: var(--ink); white-space: nowrap; }
  .frow select { padding: 9px 10px; }
  .frow.range { margin-top: 12px; color: var(--ink); gap: 10px; }
  .frow input[type=date] { font: inherit; color: var(--ink); border: 1px solid #dcdfe6; border-radius: 6px; padding: 7px 10px; }
  .filters .meta { margin-top: 10px; color: var(--muted); font-size: 13.5px; }
  .filters .meta button.link { margin: 0 6px; }
`;

export const FILTER_HTML = `
  <section class="card section filters" aria-label="Find shipments">
    <div class="frow">
      <label class="sr" for="f-q">Search shipments</label>
      <input type="text" id="f-q" autocomplete="off" spellcheck="false"
        placeholder="Search customer, note, tracking number or place"
        title="Searches the customer or note, tracking number, carrier and place. Two letters on their own, such as DE or US, find a country.">
      <div class="seg" role="group" aria-label="Carrier" id="f-carrier">
        <button type="button" data-c="" class="on" aria-pressed="true">All</button>
        <button type="button" data-c="ups" aria-pressed="false">UPS</button>
        <button type="button" data-c="fedex" aria-pressed="false">FedEx</button>
      </div>
      <label class="when" for="f-when">Shipped <select id="f-when"><option value="">Any time</option></select></label>
    </div>
    <div class="frow range" id="f-range" hidden>
      <label for="f-from">From</label> <input type="date" id="f-from">
      <label for="f-to">to</label> <input type="date" id="f-to">
    </div>
    <div class="meta" id="f-meta" role="status" hidden></div>
  </section>`;

// Shared filter logic. A page calls initFilters(onChange), then reads F,
// filterRange(), filterMatches(shipment) or filterQuery() as it needs.
export const FILTER_JS = `
  var F = { q: "", carrier: "", when: "", from: "", to: "" };
  var CARRIER_NAME = { ups: "UPS", fedex: "FedEx" };
  function fEl(id) { return document.getElementById(id); }
  function ymName(ym, withYear) {
    var d = new Date(ym + "-15T12:00:00Z");
    return isNaN(d) ? ym : d.toLocaleDateString("en-GB", withYear === false ? { month: "long", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" });
  }
  function dayName(ymd) {
    var d = new Date(ymd + "T12:00:00Z");
    return isNaN(d) ? ymd : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  // The dates a "Shipped" choice stands for. A month is only a date range with a nicer name.
  function filterRange() {
    if (/^\\d{4}-\\d{2}$/.test(F.when)) return { from: F.when + "-01", to: F.when + "-31" };
    if (F.when === "custom") {
      var a = F.from, b = F.to;
      if (a && b && a > b) { var x = a; a = b; b = x; }
      return { from: a, to: b };
    }
    return { from: "", to: "" };
  }
  function filterOn() {
    var r = filterRange();
    return !!(F.q || F.carrier || r.from || r.to);
  }
  function filterText() {
    var bits = [], r = filterRange();
    if (F.carrier) bits.push(CARRIER_NAME[F.carrier]);
    if (/^\\d{4}-\\d{2}$/.test(F.when)) bits.push("shipped " + ymName(F.when));
    else if (r.from && r.to) bits.push("shipped " + dayName(r.from) + " to " + dayName(r.to));
    else if (r.from) bits.push("shipped from " + dayName(r.from));
    else if (r.to) bits.push("shipped up to " + dayName(r.to));
    if (F.q) bits.push('matching "' + F.q + '"');
    var s = bits.join(", ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function filterQuery() {
    var p = new URLSearchParams(), r = filterRange();
    if (F.q) p.set("q", F.q);
    if (F.carrier) p.set("carrier", F.carrier);
    if (F.when) p.set("when", F.when);
    if (r.from) p.set("from", r.from);
    if (r.to) p.set("to", r.to);
    return p.toString();
  }
  function filterMatches(s) {
    var term = F.q.toLowerCase();
    if (term) {
      // Two letters on their own mean a country code. Otherwise "de" would also find every FedEx parcel.
      if (/^[a-z]{2}$/.test(term)) { if (String(s.destCountry || "").toLowerCase() !== term) return false; }
      else if ([s.label, s.trackingNumber, s.courier, s.destCountry, s.lastEventLocation].join(" ").toLowerCase().indexOf(term) === -1) return false;
    }
    if (F.carrier && String(s.courier || "").toLowerCase().indexOf(F.carrier) !== 0) return false;
    var r = filterRange();
    if (r.from && s.shipDay < r.from) return false;
    if (r.to && s.shipDay > r.to) return false;
    return true;
  }
  // Fills the "Shipped" list: this month, last month, then every earlier month back to the first shipment.
  function setMonths(firstMonth) {
    var sel = fEl("f-when");
    var now = new Date();
    var y = now.getUTCFullYear(), m = now.getUTCMonth();
    var thisYm = now.toISOString().slice(0, 7);
    var stop = firstMonth && firstMonth < thisYm ? firstMonth : thisYm;
    if (/^\\d{4}-\\d{2}$/.test(F.when) && F.when < stop) stop = F.when;
    sel.textContent = "";
    function opt(v, label) { var o = document.createElement("option"); o.value = v; o.textContent = label; sel.appendChild(o); }
    opt("", "Any time");
    for (var i = 0; i < 60; i++) {
      var ym = new Date(Date.UTC(y, m - i, 15)).toISOString().slice(0, 7);
      if (ym < stop) break;
      opt(ym, i === 0 ? "This month (" + ymName(ym, false) + ")" : i === 1 ? "Last month (" + ymName(ym, false) + ")" : ymName(ym));
    }
    opt("custom", "Custom range\\u2026");
    sel.value = F.when;
  }
  function showFilterState() {
    Array.prototype.forEach.call(fEl("f-carrier").children, function (b) {
      var on = b.getAttribute("data-c") === F.carrier;
      b.className = on ? "on" : "";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    fEl("f-range").hidden = F.when !== "custom";
  }
  // Writes the line under the bar: what is being filtered, how many, and a way out.
  function showFilterMeta(countText, extraNode) {
    var box = fEl("f-meta");
    box.textContent = "";
    box.hidden = !filterOn();
    if (!filterOn()) return;
    box.appendChild(document.createTextNode(filterText() + ": " + countText + "."));
    var clear = document.createElement("button");
    clear.className = "link"; clear.type = "button"; clear.textContent = "Clear";
    clear.addEventListener("click", function () {
      F = { q: "", carrier: "", when: "", from: "", to: "" };
      fEl("f-q").value = ""; fEl("f-from").value = ""; fEl("f-to").value = ""; fEl("f-when").value = "";
      showFilterState();
      filterChanged(true);
    });
    box.appendChild(clear);
    if (extraNode) box.appendChild(extraNode);
  }
  var filterChanged = function () {};
  function initFilters(onChange) {
    filterChanged = onChange;
    // Another page can hand its filters over in the address.
    var p = new URLSearchParams(location.search);
    F.q = (p.get("q") || "").trim().slice(0, 60);
    F.carrier = p.get("carrier") === "ups" || p.get("carrier") === "fedex" ? p.get("carrier") : "";
    var w = p.get("when") || "";
    F.when = /^\\d{4}-\\d{2}$/.test(w) || w === "custom" ? w : "";
    if (F.when === "custom") { F.from = p.get("from") || ""; F.to = p.get("to") || ""; }
    fEl("f-q").value = F.q; fEl("f-from").value = F.from; fEl("f-to").value = F.to;
    setMonths("");
    showFilterState();
    fEl("f-q").addEventListener("input", function () { F.q = fEl("f-q").value.trim(); onChange(false); });
    fEl("f-carrier").addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      F.carrier = b.getAttribute("data-c");
      showFilterState(); onChange(true);
    });
    fEl("f-when").addEventListener("change", function () {
      F.when = fEl("f-when").value;
      showFilterState(); onChange(true);
      if (F.when === "custom") fEl("f-from").focus();
    });
    fEl("f-from").addEventListener("change", function () { F.from = fEl("f-from").value; onChange(true); });
    fEl("f-to").addEventListener("change", function () { F.to = fEl("f-to").value; onChange(true); });
  }
`;

const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';
const ICON_BOX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0M12 3V2"/></svg>';

// The left-hand column. active is "add", "board", "history" or "settings".
export function sidebar(active) {
  return `<aside class="side">
    <div class="brand"><div class="name">Dot Logistics</div><div class="sub">UPS and FedEx tracking</div></div>
    <div class="who"><div class="avatar" id="avatar"></div><div><div class="n" id="userName">&nbsp;</div><div class="o">Dot Origin</div></div></div>
    <div class="navlabel">Menu</div>
    <nav class="nav" aria-label="Main">
      <a href="/add"${active === "add" ? ' class="on" aria-current="page"' : ""}>${ICON_PLUS}<span>Add shipments</span></a>
      <a href="/"${active === "board" ? ' class="on" aria-current="page"' : ""}>${ICON_BOX}<span>Shipments</span></a>
      <a href="/history"${active === "history" ? ' class="on" aria-current="page"' : ""}>${ICON_CLOCK}<span>History</span></a>
      <a href="/settings"${active === "settings" ? ' class="on" aria-current="page"' : ""}>${ICON_BELL}<span>Alert settings</span></a>
    </nav>
    <div class="navlabel">At a glance</div>
    <div class="stats" id="stats" aria-label="Shipment counts"></div>
    <div class="foot">Prototype</div>
  </aside>`;
}

// Shared script: fills in who is signed in, and the counts in the sidebar.
export const WHO_JS = `
  var STAT_ROWS = [
    { key: "customs",   label: "Customs hold",     states: ["customs"],          dot: "red" },
    { key: "problem",   label: "Problem",          states: ["problem"],          dot: "red" },
    { key: "stalled",   label: "Stalled",          states: ["stalled"],          dot: "amber" },
    { key: "notfound",  label: "Not found",        states: ["notfound"],         dot: "amber", hideIfZero: true },
    { key: "transit",   label: "In transit",       states: ["transit"],          dot: "teal" },
    { key: "out",       label: "Out for delivery", states: ["out"],              dot: "teal" },
    { key: "waiting",   label: "Not yet moving",   states: ["label", "looking"], dot: "" },
    { key: "delivered", label: "Delivered",        states: ["delivered"],        dot: "green", note: "last 14 days" }
  ];
  function showStats(shipments) {
    var box = document.getElementById("stats");
    if (!box) return;
    var counts = {};
    shipments.forEach(function (s) { counts[s.state] = (counts[s.state] || 0) + 1; });
    box.textContent = "";
    function row(label, n, dot, to, note, extra) {
      var a = document.createElement("a");
      a.href = "/#" + to;
      if (typeof statFilter !== "undefined" && statFilter && to === "show-" + statFilter.key) a.style.background = "var(--teal-wash)";
      a.className = (n ? "" : "zero") + (extra ? " " + extra : "");
      var d = document.createElement("span");
      d.className = "sd" + (dot ? " " + dot : "");
      if (extra) d.style.visibility = "hidden";
      var l = document.createElement("span");
      l.textContent = label;
      if (note) l.title = note;
      var c = document.createElement("span");
      c.className = "num";
      c.textContent = String(n);
      a.setAttribute("aria-label", label + ": " + n + (note ? ", " + note : ""));
      a.appendChild(d); a.appendChild(l); a.appendChild(c);
      box.appendChild(a);
    }
    var open = 0;
    STAT_ROWS.forEach(function (r) {
      var n = r.states.reduce(function (t, st) { return t + (counts[st] || 0); }, 0);
      if (r.key !== "delivered") open += n;
      if (r.hideIfZero && !n) return;
      row(r.label, n, r.dot, r.key === "delivered" ? "sec-done" : "show-" + r.key, r.note);
    });
    var judged = shipments.filter(function (s) { return s.timing && (s.timing.status === "ontime" || s.timing.status === "late"); });
    if (judged.length) {
      var ok = judged.filter(function (s) { return s.timing.status === "ontime"; }).length;
      row("On time", ok + " of " + judged.length, "", "sec-done", "delivered by the carrier's first estimate, where one was captured");
      box.lastChild.style.paddingLeft = "59px";
      box.lastChild.firstChild.style.display = "none";
      box.lastChild.style.gridTemplateColumns = "1fr auto";
    }
    row("Open shipments", open, "", "sec-open", "everything not yet delivered", "total");
  }

  function showUser(email) {
    var local = String(email || "").split("@")[0];
    var parts = local.split(/[._-]+/).filter(Boolean);
    var name = parts.map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join(" ") || "Signed in";
    var initials = parts.slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join("") || "?";
    var a = document.getElementById("avatar"), n = document.getElementById("userName");
    if (a) a.textContent = initials;
    if (n) { n.textContent = name; n.title = email || ""; }
  }
`;
