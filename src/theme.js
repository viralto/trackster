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
  .brand .name { color: var(--teal); font-size: 30px; font-weight: 300; letter-spacing: .04em; line-height: 1.1; text-transform: uppercase; }
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
    .nav a { flex: 1; justify-content: center; padding: 10px; border-right: 0; border-bottom: 4px solid transparent; font-size: 15px; }
    .nav a.on { border-bottom-color: var(--teal); }
    .main { padding: 14px 12px 60px; }
    .pagehead .tag { border-left: 0; padding: 0; }
  }
`;

const ICON_BOX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6"/></svg>';
const ICON_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0M12 3V2"/></svg>';

// The left-hand column. active is "board" or "settings".
export function sidebar(active) {
  return `<aside class="side">
    <div class="brand"><div class="name">Shipments</div><div class="sub">UPS and FedEx tracking</div></div>
    <div class="who"><div class="avatar" id="avatar"></div><div><div class="n" id="userName">&nbsp;</div><div class="o">Dot Origin</div></div></div>
    <div class="navlabel">Menu</div>
    <nav class="nav" aria-label="Main">
      <a href="/"${active === "board" ? ' class="on" aria-current="page"' : ""}>${ICON_BOX}<span>Shipments</span></a>
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
