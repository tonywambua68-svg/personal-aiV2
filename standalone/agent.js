/* ============================================================
   NEXUS//OS — AGENT LAYER v1.0  (standalone demo)
   Personal operating assistant bolted ON TOP of the existing AI.
   Same engine, memory rules, RBAC gates and audit trail.

   Modules in this file:
     1. Persistence            (nexus.agent.v1 — separate from business data)
     2. Tool registry          (permissions + honest connection status)
     3. Bridge client          (real computer control via bridge.js)
     4. Tasks / Projects / Goals / Progress
     5. Layered memory         (remember / forget / recall)
     6. Knowledge base         (notes + text files, local search)
     7. Web search & research  (real: Wikipedia API + opens real sources)
     8. Daily briefing + proactive engine
     9. Natural-language intents (delegated from app.js answer())
    10. Views: Dashboard · Tasks & Goals · Knowledge & Memory

   Honesty rule (§49): every tool reports CONNECTED / NOT CONNECTED /
   REQUIRES BRIDGE / DEMO. Nothing is faked.
   ============================================================ */
(function () {
  "use strict";
  var X = null; // __NEXUS bridge (set after app.js boots)
  var esc, ksh, num, icon, toast, modal, timeAgo, hhmm;

  /* ---------------- 1. persistence ---------------- */
  var KEY = "nexus.agent.v1";
  var A = load();

  function defaults() {
    var d0 = Date.now();
    return {
      v: 1,
      tasks: [
        { id: "t1", title: "Review & send NiaFit Studio proposal", proj: "freelance", pri: "hi", status: "todo", due: d0, created: d0 - 86400000 },
        { id: "t2", title: "Learn REST APIs — verbs, status codes, auth", proj: "learning", pri: "med", status: "todo", due: d0, created: d0 - 86400000 },
        { id: "t3", title: "Wire WooCommerce webhook into Personal AI", proj: "ai", pri: "hi", status: "doing", due: d0 + 3 * 86400000, created: d0 - 2 * 86400000 },
        { id: "t4", title: "Restock ThinkPad T480 ×5 (supplier quote)", proj: "business", pri: "med", status: "todo", due: d0 + 86400000, created: d0 - 86400000 },
        { id: "t5", title: "Post TikTok laptop review #3", proj: "business", pri: "lo", status: "todo", due: d0 + 2 * 86400000, created: d0 - 86400000 },
        { id: "t6", title: "Install & test NEXUS voice layer", proj: "ai", pri: "hi", status: "done", due: d0 - 86400000, created: d0 - 2 * 86400000, doneAt: d0 - 86400000 },
      ],
      projects: [
        { id: "p-shop", name: "Electronics Website", path: "C:\\Users\\You\\electronics-site", status: "active", next: "Fix checkout conversion leak (step 3 of funnel)", updated: d0 - 86400000 },
        { id: "p-ai", name: "Personal AI", path: "C:\\Users\\You\\personal-ai", status: "active", next: "Phase 2: Express server + real WooCommerce webhook", updated: d0 },
        { id: "p-free", name: "Freelancing", path: "", status: "active", next: "Send NiaFit proposal today (hot lead)", updated: d0 },
        { id: "p-learn", name: "Learning AI Integration", path: "", status: "active", next: "Milestone 1: APIs — finish REST basics", updated: d0 - 2 * 86400000 },
      ],
      goals: [
        {
          id: "g1", title: "Become an AI Integration Developer", why: "Highest-demand skill in my pipeline (92/100)",
          deadline: d0 + 120 * 86400000, created: d0 - 86400000,
          milestones: [
            { t: "APIs (REST, webhooks, auth)", done: true },
            { t: "Authentication (OAuth, keys, .env)", done: false },
            { t: "LLM APIs (OpenAI, function calling)", done: false },
            { t: "Tool calling & agents", done: false },
            { t: "RAG & knowledge bases", done: false },
            { t: "Automation (n8n / Zapier)", done: false },
            { t: "AI agents in production", done: false },
            { t: "Deployment (VPS, monitoring)", done: false },
            { t: "First paid client project", done: false },
          ],
        },
      ],
      memory: [
        { id: "m1", kind: "business", text: "Store focus: business laptops KSh 28k–62k. TikTok converts 2.9× better than Meta for the T480.", at: d0 - 3 * 86400000 },
        { id: "m2", kind: "project", text: "Personal AI lives in C:\\Users\\You\\personal-ai. Voice layer shipped v0.9; bridge.js adds computer control.", at: d0 - 86400000 },
        { id: "m3", kind: "learning", text: "I learn best by building: concept → example → exercise → project → test.", at: d0 - 5 * 86400000 },
      ],
      kb: [
        { id: "k1", title: "WooCommerce webhook notes", type: "note", at: d0 - 2 * 86400000, text: "Topic: Order created. URL: https://<ngrok>/api/webhooks/woocommerce. Secret must match .env WEBHOOK_SECRET. Verify HMAC sha256 before trusting payload." },
      ],
      cfg: { screen: false, autoBrief: true, wakeConfirmed: true },
      briefDates: {},   // dayKey -> true (morning briefing delivered)
      proactiveSeen: {}, // dayKey -> [ids]
      briefHistory: [],
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = defaults(), p = JSON.parse(raw);
        ["tasks", "projects", "goals", "memory", "kb", "cfg", "briefDates", "proactiveSeen", "briefHistory"].forEach(function (k) { if (p[k] !== undefined) d[k] = p[k]; });
        return d;
      }
    } catch (e) {}
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(A)); } catch (e) {} }
  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function dayKey(ts) { var d = new Date(ts || Date.now()); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function startOfDay(ts) { var d = new Date(ts || Date.now()); d.setHours(0, 0, 0, 0); return d.getTime(); }

  /* ---------------- 2. tool registry ---------------- */
  var bridge = { online: false, info: null };

  var TOOLS = [
    { id: "tasks", name: "Task Manager", perms: ["READ", "WRITE"], how: function () { return "connected"; } },
    { id: "projects", name: "Project Manager", perms: ["READ", "WRITE"], how: function () { return "connected"; } },
    { id: "goals", name: "Goals & Progress", perms: ["READ", "WRITE"], how: function () { return "connected"; } },
    { id: "memory", name: "Layered Memory", perms: ["READ", "WRITE"], how: function () { return "connected"; } },
    { id: "knowledge", name: "Knowledge Base", perms: ["READ", "WRITE"], how: function () { return "connected"; } },
    { id: "briefing", name: "Briefing Engine", perms: ["READ"], how: function () { return "connected"; } },
    { id: "proactive", name: "Proactive Monitor", perms: ["READ"], how: function () { return "connected"; } },
    { id: "business", name: "Business Intelligence", perms: ["READ"], how: function () { return X.S.integrations[0].status === "connected" ? "connected" : "not connected"; } },
    { id: "wordpress", name: "WordPress", perms: ["READ"], how: function () { return integ("wp"); } },
    { id: "woocommerce", name: "WooCommerce", perms: ["READ", "WRITE"], how: function () { return integ("woo"); } },
    { id: "social", name: "Social (Meta/TikTok)", perms: ["READ"], how: function () { return integ("meta") === "connected" && integ("tiktok") === "connected" ? "connected" : "partial"; } },
    { id: "notifications", name: "Phone Notifications", perms: ["SEND·confirm"], how: function () { return integ("telegram"); } },
    { id: "web_search", name: "Web Search", perms: ["READ"], how: function () { return "connected"; }, note: "Wikipedia API inline + opens real search engines. Deep ranked search needs SEARCH_API_KEY (Phase 2)." },
    { id: "youtube", name: "YouTube", perms: ["READ"], how: function () { return "connected"; }, note: "Opens real searches. Watching/understanding videos requires transcript access — never claimed." },
    { id: "browser", name: "Browser Agent", perms: ["READ", "EXECUTE"], how: function () { return "connected"; }, note: "Opens URLs & searches for real. Click/scroll/form-fill needs the Playwright service (Phase 2)." },
    { id: "computer", name: "Computer Control", perms: ["EXECUTE·confirm"], how: function () { return bridge.online ? "connected" : "requires bridge"; }, note: "Runs through bridge.js on your PC — real app launching, files, safe commands." },
    { id: "filesystem", name: "Filesystem", perms: ["READ", "WRITE", "DELETE·confirm"], how: function () { return bridge.online ? (bridgeHasPaths() ? "connected" : "no paths allowed") : "requires bridge"; }, note: "Only folders you list in bridge.config.json." },
    { id: "terminal", name: "Terminal", perms: ["EXECUTE·confirm"], how: function () { return bridge.online ? "connected" : "requires bridge"; }, note: "Allowlisted commands only (node/npm/git). Dangerous commands are always refused." },
    { id: "ai_models", name: "Multi-Model Router", perms: ["ADMIN"], how: function () { return "demo engine"; }, note: "Local intent engine now; VOICE_API_KEY / OPENAI_API_KEY swap in cloud models without UI changes." },
  ];
  function integ(id) { var i = null; for (var k = 0; k < X.S.integrations.length; k++) if (X.S.integrations[k].id === id) i = X.S.integrations[k]; return i ? i.status : "not connected"; }
  function bridgeHasPaths() { return bridge.info && bridge.info.allowedPaths && bridge.info.allowedPaths.length > 0; }

  /* ---------------- 3. bridge client (real computer control) ---------------- */
  var BRIDGE_URL = "http://localhost:8787";
  function pingBridge(cb) {
    fetch(BRIDGE_URL + "/api/bridge/ping", { signal: AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { bridge.online = !!(j && j.ok); bridge.info = j; if (cb) cb(); })
      .catch(function () { bridge.online = false; bridge.info = null; if (cb) cb(); });
  }
  function bridgeExec(action, args, cb) {
    fetch(BRIDGE_URL + "/api/bridge/exec", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action, args: args || {} }),
    })
      .then(function (r) { return r.json().then(function (j) { cb(null, j, r.status); }); })
      .catch(function (e) { cb(e || new Error("bridge unreachable")); });
  }
  function audit(actor, mod, action, scope, outcome) { if (X.addAudit) X.addAudit(actor, mod, action, scope, outcome); }
  function notice(kind, text) { if (X.addNotice) X.addNotice(kind, text); }

  /* ---------------- 4. tasks / projects / goals ---------------- */
  function fuzzyTask(q) {
    q = q.toLowerCase();
    var best = null, score = 0;
    A.tasks.forEach(function (t) {
      var title = t.title.toLowerCase();
      if (title === q) { if (score < 100) { best = t; score = 100; } return; }
      var words = q.split(/\s+/).filter(function (w) { return w.length > 2; });
      var hits = 0;
      words.forEach(function (w) { if (title.indexOf(w) !== -1) hits++; });
      var s = words.length ? (hits / words.length) * 90 : 0;
      if (title.indexOf(q) !== -1) s = 95;
      if (s > score) { score = s; best = t; }
    });
    return score >= 50 ? best : null;
  }
  function parseDue(text) {
    var d = new Date(); d.setHours(17, 0, 0, 0);
    if (/\btoday\b/.test(text)) return d.getTime();
    if (/\btomorrow\b/.test(text)) return d.getTime() + 86400000;
    var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (var i = 0; i < 7; i++) if (new RegExp("\\b" + days[i] + "\\b").test(text)) {
      var diff = (i - d.getDay() + 7) % 7 || 7;
      return d.getTime() + diff * 86400000;
    }
    if (/\bnext week\b/.test(text)) return d.getTime() + 7 * 86400000;
    return null;
  }
  function tasksDueToday() {
    var s = startOfDay();
    return A.tasks.filter(function (t) { return t.status !== "done" && t.due && t.due >= s && t.due < s + 86400000; });
  }
  function tasksOverdue() {
    var s = startOfDay();
    return A.tasks.filter(function (t) { return t.status !== "done" && t.due && t.due < s; });
  }
  function progressToday() {
    var s = startOfDay();
    var done = A.tasks.filter(function (t) { return t.status === "done" && t.doneAt >= s; }).length;
    var planned = tasksDueToday().length + done;
    return planned === 0 ? 0 : Math.round((done / planned) * 100);
  }
  function projectProgress(pid) {
    var ts = A.tasks.filter(function (t) { return t.proj === pid || (A.projects.find(function (p) { return p.id === pid; }) || {}).name.toLowerCase().indexOf((t.proj || "").toLowerCase()) === 0; });
    if (!ts.length) return null;
    return Math.round((ts.filter(function (t) { return t.status === "done"; }).length / ts.length) * 100);
  }
  function nextTask() {
    var pool = A.tasks.filter(function (t) { return t.status !== "done"; });
    if (!pool.length) return null;
    var w = { hi: 3, med: 2, lo: 1 };
    pool.sort(function (a, b) {
      var oa = (a.due || 9e15), ob = (b.due || 9e15);
      return (oa - (w[a.pri] || 1) * 36e5) - (ob - (w[b.pri] || 1) * 36e5);
    });
    return pool[0];
  }
  var GOAL_TEMPLATES = {
    ai: ["APIs (REST, webhooks, auth)", "Authentication (OAuth, keys, .env)", "LLM APIs (OpenAI, function calling)", "Tool calling & agents", "RAG & knowledge bases", "Automation (n8n / Zapier)", "AI agents in production", "Deployment (VPS, monitoring)", "First paid client project"],
    wordpress: ["Local WP setup (Local by Flywheel)", "Theme structure & hooks", "Elementor pro workflows", "WooCommerce configuration", "SEO with Rank Math", "Speed & caching", "Security hardening", "Client site launch", "Maintenance retainers"],
    freelance: ["Pick niche & offer", "Portfolio: 3 proof projects", "Upwork/Fiverr profiles", "Proposal system & templates", "First 3 clients", "Raise rates 2×", "Retainer contracts", "Referral pipeline"],
  };
  function goalTemplate(title) {
    var t = title.toLowerCase();
    if (/ai|integrat|automat|llm|agent/.test(t)) return GOAL_TEMPLATES.ai;
    if (/wordpress|woo|ecommerce|e-commerce/.test(t)) return GOAL_TEMPLATES.wordpress;
    if (/freelanc|client|income/.test(t)) return GOAL_TEMPLATES.freelance;
    return ["Define the outcome", "Learn the fundamentals", "Build a small project", "Build a real project", "Publish / show it", "Get feedback & iterate", "Teach it / use it for income"];
  }

  /* ---------------- 5. memory ---------------- */
  function remember(kind, text) {
    A.memory.unshift({ id: uid("m"), kind: kind, text: text, at: Date.now() });
    if (A.memory.length > 200) A.memory.length = 200;
    save();
    audit("AI", "Memory", 'Stored ' + kind + ' memory: "' + text.slice(0, 60) + '"', "WRITE", "EXECUTED");
  }
  function forget(match) {
    var q = (match || "").toLowerCase().trim();
    var before = A.memory.length;
    A.memory = A.memory.filter(function (m) { return q && m.text.toLowerCase().indexOf(q) === -1 && m.kind !== q; });
    var removed = before - A.memory.length;
    save();
    if (removed) audit("AI", "Memory", "Forgot " + removed + " memor" + (removed === 1 ? "y" : "ies") + ' matching "' + q + '"', "DELETE", "EXECUTED");
    return removed;
  }
  function classifyMemory(text) {
    var t = text.toLowerCase();
    if (/client|lead|proposal|freelanc|invoice/.test(t)) return "freelance";
    if (/shop|store|order|stock|laptop|price|profit|revenue/.test(t)) return "business";
    if (/project|personal ai|nexus|code|repo|folder/.test(t)) return "project";
    if (/learn|skill|study|course|api|node|react/.test(t)) return "learning";
    return "note";
  }

  /* ---------------- 6. knowledge base ---------------- */
  function kbAdd(title, text, type) {
    A.kb.unshift({ id: uid("k"), title: title, type: type || "note", text: text, at: Date.now() });
    save();
    audit("AI", "Knowledge", "Indexed document: " + title, "WRITE", "EXECUTED");
  }
  function kbSearch(q) {
    var words = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; });
    return A.kb
      .map(function (k) {
        var hay = (k.title + " " + k.text).toLowerCase();
        var hits = 0; words.forEach(function (w) { if (hay.indexOf(w) !== -1) hits++; });
        return { k: k, score: words.length ? hits / words.length : 0 };
      })
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (r) { return r.k; });
  }

  /* ---------------- 7. web search & research ---------------- */
  function openTab(url) {
    var w = window.open(url, "_blank", "noopener");
    if (!w) toast("Popup blocked — allow popups to let me open pages for you.", "warn");
    return !!w;
  }
  function webSearch(q, open) {
    var enc = encodeURIComponent(q);
    audit("AI", "Web Search", 'Searched: "' + q + '"', "READ", "EXECUTED");
    if (open !== false) openTab("https://duckduckgo.com/?q=" + enc);
    wikiSummary(q);
    return (
      H("Searching the web", "web") +
      P('Opened <b>DuckDuckGo</b> results for "' + esc(q) + '" in a new tab, and I\'m checking Wikipedia for a verified summary…') +
      P('<span class="mono" style="font-size:10.5px;color:var(--txt-3)">SOURCES SHOWN WHEN FOUND · deep ranked search needs SEARCH_API_KEY (Phase 2)</span>')
    );
  }
  function wikiSummary(topic) {
    fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(topic.replace(/\s+/g, "_")))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || j.type === "disambiguation" || !j.extract) {
          appendAI(P("No verified Wikipedia summary for that — the opened search tabs are your best source. Want me to save anything you find to the Knowledge Base? Just say <b>remember that …</b>"));
          return;
        }
        appendAI(
          H(j.title, "research") +
          P(esc(j.extract.length > 420 ? j.extract.slice(0, 420).replace(/\s+\S*$/, "") + "…" : j.extract)) +
          P('<a href="' + esc(j.content_urls && j.content_urls.desktop ? j.content_urls.desktop.page : "#") + '" target="_blank" rel="noopener" style="color:var(--acc)">Source: Wikipedia ↗</a> · <span style="color:var(--txt-3)">Say "save this to my knowledge base" to keep it.</span>')
        );
        A._lastWiki = { title: j.title, text: j.extract, url: j.content_urls && j.content_urls.desktop ? j.content_urls.desktop.page : "" };
      })
      .catch(function () {
        appendAI(P("Wikipedia is unreachable right now (offline?). The search tabs still work — <b>I never pretend to know current facts without checking.</b>"));
      });
  }
  function researchPlan(topic) {
    var enc = encodeURIComponent(topic);
    var links = [
      ["DuckDuckGo — broad search", "https://duckduckgo.com/?q=" + enc],
      ["Google Scholar — research papers", "https://scholar.google.com/scholar?q=" + enc],
      ["YouTube — tutorials", "https://www.youtube.com/results?search_query=" + enc + " tutorial"],
      ["GitHub — real implementations", "https://github.com/search?q=" + enc + "&type=repositories"],
      ["Reddit — practitioner talk", "https://www.reddit.com/search/?q=" + enc],
    ];
    audit("AI", "Research", 'Research plan opened for "' + topic + '" (5 source groups)', "READ", "EXECUTED");
    links.forEach(function (l) { openTab(l[1]); });
    wikiSummary(topic);
    return (
      H("Research mode — " + topic, "research") +
      P("I opened <b>5 source groups</b> in new tabs and I'm pulling the Wikipedia summary. Skim them, then tell me what stands out and I'll structure it.") +
      links.map(function (l, i) { return P((i + 1) + ". " + l[0]); }).join("") +
      D([["Method", "Collect → compare → analyze → recommend. Say <b>save this research</b> and I'll index your notes into the Knowledge Base."],
         ["Honesty", "I can't read paywalled or login-only pages — I'll tell you when a source needs you."]])
    );
  }
  function youtube(q) {
    openTab("https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " tutorial"));
    audit("AI", "YouTube", 'Opened YouTube search: "' + q + '"', "READ", "EXECUTED");
    return H("YouTube search opened", "youtube") + P('Searching YouTube for <b>"' + esc(q) + ' tutorial"</b>. Pick one with high views + recent date; if it has a transcript, paste it to me and I\'ll summarize and quiz you on it.');
  }

  /* ---------------- 8. briefing + proactive ---------------- */
  function briefingHtml() {
    var s = X.sel;
    var today = s.todayOrders(), rev = s.todayRevenue(), prof = s.todayProfit();
    var low = s.lowStock();
    var hot = X.S.leads.filter(function (l) { return l.stage !== "won" && l.stage !== "lost" && l.deadline - Date.now() < 3 * 86400000; })
      .sort(function (a, b) { return a.deadline - b.deadline; });
    var due = tasksDueToday(), over = tasksOverdue();
    var goal = A.goals[0];
    var gp = goal ? Math.round((goal.milestones.filter(function (m) { return m.done; }).length / goal.milestones.length) * 100) : 0;
    var top = over[0] || due.sort(function (a, b) { return (b.pri === "hi") - (a.pri === "hi"); })[0] || null;
    var secs = [
      ["Business", "acc", [
        today.length + " order" + (today.length === 1 ? "" : "s") + " today — " + ksh(rev) + " revenue, " + ksh(prof) + " profit.",
        low.length ? "⚠ " + low.length + " product" + (low.length === 1 ? "" : "s") + " low on stock: " + low.slice(0, 2).map(function (p) { return p.name + " (" + p.stock + " left)"; }).join(", ") + "." : "Stock levels healthy.",
      ]],
      ["Website", "info", [
        "WordPress: " + integ("wp").toUpperCase() + " · WooCommerce: " + integ("woo").toUpperCase() + " · GA4: " + integ("ga4").toUpperCase() + ".",
        "Checkout conversion is your biggest leak (step 3 of the funnel) — see Analytics.",
      ]],
      ["Freelancing", "info", hot.length
        ? hot.map(function (l) { return l.name + " — " + ksh(l.value) + " (" + l.stage + "), due " + timeAgo(l.deadline).replace("ago", "").trim() + " from now."; })
        : ["No urgent lead deadlines in the next 72h."]],
      ["Learning", "vio", goal ? ["Goal: " + goal.title + " — " + gp + "% complete. Next milestone: " + (goal.milestones.find(function (m) { return !m.done; }) || {}).t + "."] : ["No active goal — say "my goal is …" to create one."]],
      ["Projects", "info", A.projects.filter(function (p) { return p.status === "active"; }).map(function (p) { return p.name + ": next → " + p.next; })],
      ["Tasks", "warn", [
        over.length ? over.length + " overdue task" + (over.length === 1 ? "" : "s") + ": " + over.slice(0, 2).map(function (t) { return '"' + t.title + '"'; }).join(", ") + "." : "Nothing overdue.",
        due.length ? due.length + " due today." : "No tasks due today.",
      ]],
      ["Security", "info", (function () {
        var f = securityScan();
        var warns = f.filter(function (x) { return x.sev === "warn"; });
        return warns.length
          ? warns.slice(0, 2).map(function (x) { return "▲ " + x.what + " — " + x.act; })
          : ["No anomalies detected — approval gates and audit trail nominal."];
      })()],
      ["Website", "info", [A.cfg.siteUrl
        ? "Monitoring " + A.cfg.siteUrl + " — say “check my website” for a live probe."
        : "Not configured — say “my website is https://…” to start uptime checks."]],
      ["Tech intelligence", "vio", ["Say “tech news” — live scan of Hacker News filtered to your focus (AI, automation, e-commerce, security)."]],
    ];
    var html = H("Daily briefing — " + new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }), "brief");
    secs.forEach(function (sec) {
      html += '<div class="cs" style="margin-top:12px"><i>▍</i>' + sec[0] + "</div>";
      sec[2].forEach(function (line) { html += P(line); });
    });
    var topOpp = (function () {
      var lo = X.sel.lowStock();
      if (lo.length) return "Reorder " + lo[0].name + " — stockout risk ≈ KSh " + Math.round((lo[0].price - lo[0].cost) * lo[0].velocity).toLocaleString() + "/week. Say “restock”.";
      var deadCamp = null;
      X.S.campaigns.forEach(function (c) { if (c.active && c.conversions === 0 && c.spend > 2000) deadCamp = c; });
      if (deadCamp) return "Pause “" + deadCamp.name + "” (KSh " + deadCamp.spend.toLocaleString() + " spent, 0 sales) and move budget to TikTok.";
      var hotL = null;
      X.S.leads.forEach(function (l) { if (l.stage === "lead" || l.stage === "proposal") hotL = hotL || l; });
      if (hotL) return "Send the " + hotL.name + " proposal today — same-day follow-ups win ~2× more.";
      return "Run “tech news” and turn one signal into a service offer this week.";
    })();
    html += D([["Most important today", top ? '"' + top.title + '"' + (top.proj ? " (" + top.proj + ")" : "") : "Clear day — consider deep work on " + (goal ? goal.title : "your top goal") + "."],
               ["Top opportunity", topOpp]]);
    return html;
  }
  function proactiveCheck(silent) {
    var seen = A.proactiveSeen[dayKey()] = A.proactiveSeen[dayKey()] || [];
    var fire = function (id, kind, text) {
      if (seen.indexOf(id) !== -1) return;
      seen.push(id); save();
      notice(kind, text);
      if (!silent) toast(text, kind === "alert" ? "warn" : "info");
    };
    var due = tasksDueToday(), over = tasksOverdue();
    if (over.length) fire("overdue" + over.length, "alert", "⏰ " + over.length + " task" + (over.length === 1 ? "" : "s") + " overdue — say \"what should I do next?\"");
    if (due.length) fire("due" + due.length, "system", "📋 " + due.length + " task" + (due.length === 1 ? "" : "s") + " due today.");
    var low = X.sel.lowStock();
    low.forEach(function (p) { fire("low" + p.id, "alert", "⚠ Low stock: " + p.name + " — " + p.stock + " left (sells " + p.velocity + "/week)."); });
    X.S.leads.forEach(function (l) {
      if (l.stage !== "won" && l.stage !== "lost" && l.deadline - Date.now() < 48 * 36e5 && l.deadline > Date.now())
        fire("lead" + l.id, "freelance", "💼 Lead deadline soon: " + l.name + " (" + ksh(l.value) + ").");
    });
    A.projects.forEach(function (p) {
      if (Date.now() - p.updated > 5 * 86400000) fire("stale" + p.id, "system", "🗂 Project \"" + p.name + "\" hasn't moved in 5+ days.");
    });
  }
  function morningGreeting() {
    if (!A.cfg.autoBrief) return;
    var h = new Date().getHours();
    if (h < 5 || h > 11 || A.briefDates[dayKey()]) return;
    A.briefDates[dayKey()] = true; save();
    var due = tasksDueToday().length, over = tasksOverdue().length;
    var msg = "Good morning. " + X.sel.todayOrders().length + " orders so far, " + due + " task" + (due === 1 ? "" : "s") + " due today" + (over ? ", " + over + " overdue" : "") + ". Say \"give me my update\" for the full briefing.";
    notice("system", "🌅 " + msg);
    toast("🌅 " + msg, "info");
    if (window.NexusVoice && window.NexusVoice.state && window.NexusVoice.state() === "ready") {
      // voice layer may speak it if a conversation starts; otherwise text toast is enough
    }
  }

  /* ---------------- 8b. Tech Intelligence (LIVE — Hacker News API, keyless, CORS-open) ----------------
     Pipeline the user asked for: NEWS → ANALYSIS → OPPORTUNITY → SKILL → PROJECT → MONEY.
     Honesty rule: never invent news. If the feed is unreachable, say so. */
  var TECH_KEYWORDS = ["ai", "llm", "gpt", "openai", "anthropic", "claude", "gemini", "copilot", "agent", "automation",
    "n8n", "zapier", "wordpress", "woocommerce", "shopify", "ecommerce", "e-commerce", "javascript", "node", "react",
    "next", "supabase", "postgres", "github", "aws", "azure", "cloud", "security", "breach", "vuln", "startup", "saas",
    "api", "python", "microsoft", "google", "apple", "nvidia", "robot", "freelanc", "dev tool", "linux"];

  function techRelevance(title) {
    var tl = (title || "").toLowerCase();
    var hits = 0;
    for (var i = 0; i < TECH_KEYWORDS.length; i++) if (tl.indexOf(TECH_KEYWORDS[i]) !== -1) hits++;
    return hits;
  }

  function fetchTechNews(cb) {
    fetch("https://hacker-news.firebaseio.com/v0/topstories.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (ids) {
        if (!ids || !ids.length) { cb(null, "Hacker News is unreachable right now (offline or blocked)."); return; }
        var picks = ids.slice(0, 30).map(function (id) {
          return fetch("https://hacker-news.firebaseio.com/v0/item/" + id + ".json").then(function (r) { return r.json(); });
        });
        Promise.all(picks)
          .then(function (items) {
            var relevant = items
              .filter(function (it) { return it && it.title; })
              .map(function (it) { return { title: it.title, url: it.url || ("https://news.ycombinator.com/item?id=" + it.id), score: it.score || 0, rel: techRelevance(it.title) }; })
              .filter(function (it) { return it.rel > 0; })
              .sort(function (a, b) { return (b.rel - a.rel) || (b.score - a.score); })
              .slice(0, 5);
            cb(relevant.length ? relevant : null, relevant.length ? null : "The live feed returned nothing matching your focus areas today. The pipeline works — the filter is strict by design (no noise).");
          })
          .catch(function () { cb(null, "Tech feed failed mid-stream. Retry in a minute."); });
      })
      .catch(function () { cb(null, "Tech feed unreachable — check your internet connection."); });
  }

  function opportunityLens(title) {
    var tl = (title || "").toLowerCase();
    var lens = [];
    if (/ai|llm|gpt|agent|claude|gemini|copilot/.test(tl)) {
      lens.push(["Service to sell", "AI integration / chatbot / workflow automation for local businesses — KSh 15–50k per setup."]);
      lens.push(["Skill to learn", "LLM APIs + tool calling (OpenAI gpt-4o-mini keeps costs near zero)."]);
    }
    if (/wordpress|woo|shopify|ecommerce|e-commerce|store|checkout/.test(tl)) {
      lens.push(["Use in your shop", "Test this against your laptop listings — first movers win the SEO."]);
      lens.push(["Service to sell", "WooCommerce setup + order-alert automations (your existing playbook)."]);
    }
    if (/security|breach|hack|vuln|malware|phish/.test(tl)) {
      lens.push(["Protect yourself", "Rotate any password connected to this service; enable 2FA."]);
      lens.push(["Service to sell", "Basic security-hardening audits for small business websites."]);
    }
    if (/saas|startup|funding|raise/.test(tl)) {
      lens.push(["Build idea", "Micro-SaaS around this gap — validate with 5 customer interviews before writing code."]);
    }
    if (/javascript|node|react|api|supabase|postgres|github/.test(tl) && !lens.length) {
      lens.push(["Skill to learn", "Directly strengthens your freelance stack — build one small thing with it this week."]);
    }
    if (!lens.length) lens.push(["Action", "Skim the source; file anything useful with “remember that …”."]);
    return lens;
  }

  function techScanIntent() {
    setTimeout(function () {
      fetchTechNews(function (items, err) {
        var out;
        if (err) {
          out = H("Tech intelligence — live feed unavailable") + P(esc(err)) +
            D([["Honesty", "I never invent news. Source: Hacker News top stories (free, no API key, filtered to your focus areas). Say “tech news” again when online."]]);
        } else {
          out = H("Tech intelligence — " + items.length + " relevant signal" + (items.length === 1 ? "" : "s")) +
            items.map(function (it, i) {
              return P("<b>" + (i + 1) + ". " + esc(it.title) + "</b> <a href='" + esc(it.url) + "' target='_blank' rel='noopener' style='color:var(--acc)'>source ↗</a>") +
                opportunityLens(it.title).map(function (l) { return B("<b>" + l[0] + ":</b> " + esc(l[1])); }).join("");
            }).join("") +
            D([["Pipeline", "NEWS → ANALYSIS → OPPORTUNITY → SKILL → PROJECT → MONEY"],
               ["Source", "Hacker News (live, free, no key). Phase 2 adds your chosen RSS/NewsAPI sources."]]);
        }
        audit("AI", "Tech Intel", items ? "Scanned HN top 30 → " + items.length + " relevant signals" : "Tech scan: no relevant signals / feed down", "READ", "EXECUTED");
        notice("system", "📡 Tech scan complete — " + (items ? items.length + " relevant signals in the console." : "no relevant signals today."));
        if (X.appendAI) X.appendAI(out);
      });
    }, 0);
    return ok("Tech scan started", P("Scanning live sources (Hacker News, filtered to your focus: AI, automation, e-commerce, web dev, security)… results drop here in a few seconds."));
  }

  /* ---------------- 8c. Security Monitoring (evidence-based, local scope) ----------------
     Rule: never claim "you are being hacked". Report WHAT / WHY SUSPICIOUS / EVIDENCE / WHAT TO DO. */
  function securityScan() {
    var f = [];
    var denied = 0, pendingFin = 0, errs = 0;
    X.S.audit.forEach(function (a) {
      if (a.outcome === "DENIED") denied++;
      if (a.scope === "FINANCIAL" && a.outcome === "PENDING") pendingFin++;
      if (/DEGRADED|FAILED|ERROR/i.test(a.outcome || "")) errs++;
    });
    var badInteg = X.S.integrations.filter(function (i) { return i.status === "error"; });
    var stale = X.S.integrations.filter(function (i) { return i.status === "connected" && (i.syncMin || 0) > 120; });
    var kbBytes = 0;
    try { kbBytes = (localStorage.getItem("nexus.agent.v1") || "").length + (localStorage.getItem("nexusos_demo_v1") || "").length; } catch (e) {}

    f.push(denied > 0
      ? { sev: denied > 3 ? "warn" : "info", what: denied + " denied action" + (denied === 1 ? "" : "s") + " in the audit log", why: "Denials prove the approval gate works. A sudden spike can mean mistaken commands — or something testing the gate.", act: denied > 3 ? "Review the denied entries (Audit tab) and confirm each was intentional." : "No action needed — this is the system protecting you." }
      : { sev: "ok", what: "No denied actions recorded", why: "Nothing has been blocked yet.", act: "None." });
    f.push(pendingFin > 0
      ? { sev: "info", what: pendingFin + " financial action" + (pendingFin === 1 ? "" : "s") + " awaiting your approval", why: "FINANCIAL scope never executes without you.", act: "Approve or deny them from the console." }
      : { sev: "ok", what: "No pending financial approvals", why: "All financial actions resolved.", act: "None." });
    f.push(badInteg.length
      ? { sev: "warn", what: badInteg.length + " integration in ERROR state (" + badInteg.map(function (i) { return i.name; }).join(", ") + ")", why: "Failed integrations can mask real events (orders, alerts).", act: "Say “retry meta” or reconnect from Integrations." }
      : { sev: "ok", what: "All integrations healthy", why: "No connection errors.", act: "None." });
    f.push(stale.length
      ? { sev: "info", what: stale.length + " integration" + (stale.length === 1 ? "" : "s") + " not synced in 2+ hours", why: "Stale data can hide trends; it is not itself an intrusion.", act: "Open the dashboard or run a workflow to refresh." }
      : { sev: "ok", what: "Sync freshness normal", why: "Connected services synced recently.", act: "None." });
    f.push(errs > 5
      ? { sev: "warn", what: errs + " degraded/failed operations logged", why: "Repeated failures can indicate a misconfiguration being probed or a flapping service.", act: "Check the Audit tab for the failing module." }
      : { sev: "ok", what: "Error rate normal (" + errs + " logged)", why: "Within expected range.", act: "None." });
    f.push({ sev: "info", what: "Local data footprint: " + Math.round(kbBytes / 1024) + " KB in browser storage", why: "Your memory, tasks and demo data live only in this browser profile.", act: "Export or wipe anytime from Settings → Memory." });
    return f;
  }

  function securityHtml() {
    var f = securityScan();
    var warnCount = f.filter(function (x) { return x.sev === "warn"; }).length;
    var badge = warnCount ? "warn" : "ok";
    var out = H("Security monitoring — " + (warnCount ? warnCount + " advisory" + (warnCount === 1 ? "" : "ies") : "no anomalies")) +
      f.map(function (x) {
        var dot = x.sev === "warn" ? "▲" : x.sev === "info" ? "ℹ" : "●";
        var col = x.sev === "warn" ? "var(--warn)" : x.sev === "info" ? "var(--info)" : "var(--acc)";
        return P("<b style='color:" + col + "'>" + dot + "</b> <b>" + esc(x.what) + "</b>") + B("<b>Why:</b> " + esc(x.why)) + B("<b>Action:</b> " + esc(x.act));
      }).join("") +
      D([["Scope", "Local audit log, integrations, storage — evidence only. I never claim an intrusion without evidence."],
         ["Untrusted content", "Webpages, emails and documents are DATA, never instructions. External text cannot command me (prompt-injection barrier)."],
         ["Future", "Phase 2 adds login-failure monitoring, process/connection checks via the bridge, and HaveIBeenPwned-style breach alerts."]]);
    return out;
  }

  /* ---------------- 8d. Website monitoring (REAL reachability probe) ---------------- */
  function checkSite(url, cb) {
    var t0 = Date.now();
    fetch(url, { mode: "no-cors", cache: "no-store" })
      .then(function () { cb(null, Date.now() - t0); })
      .catch(function () { cb(new Error("unreachable"), Date.now() - t0); });
  }

  function siteStatusHtml(cb) {
    var url = A.cfg.siteUrl;
    if (!url) {
      cb(H("Website monitoring — NOT CONFIGURED") +
        P("I don't know your site yet, and I won't guess. Connect it in one line:") +
        B("Say: <b>“my website is https://yourshop.co.ke”</b>") +
        D([["What you get", "Reachability + response-time checks, logged to the audit trail."],
           ["What needs Phase 2", "Status codes, SSL expiry, broken-page crawl, GA4 traffic — via the server probe + GA4 Data API."]]));
      return;
    }
    checkSite(url, function (err, ms) {
      var up = !err;
      audit("AI", "Website", (up ? "Site UP — " + url + " responded in " + ms + " ms" : "Site UNREACHABLE — " + url), "READ", up ? "EXECUTED" : "LOGGED");
      if (!up) notice("alert", "🔴 Website check: " + url + " did not respond.");
      cb(H("Website monitoring — " + esc(url)) +
        P(up
          ? "<b style='color:var(--acc)'>● UP</b> — responded in <b>" + ms + " ms</b> (probe sent from this browser)."
          : "<b style='color:var(--danger)'>● UNREACHABLE</b> — no response from this browser.") +
        D(up
          ? [["Status", "Reachable · " + ms + " ms"], ["Honesty", "Browser-level no-cors probe. Deep checks (status codes, SSL, page content, GA4 traffic) need the Phase-2 server probe."]]
          : [["Evidence", "fetch() rejected — the request never completed."],
             ["What to do", "1) Open the URL manually · 2) Check your host's status page · 3) Say “check my website” again in a minute."]]));
    });
  }

  /* ---------------- 8e. Startup health-check sequence ---------------- */
  function startupReport() {
    var lowStock = X.sel.lowStock().length;
    var openLeads = X.S.leads.filter(function (l) { return l.stage !== "won" && l.stage !== "lost"; }).length;
    var due = tasksDueToday().length, over = tasksOverdue().length;
    var lines = [
      ["AI core", "ONLINE", true],
      ["Voice", window.NexusVoice && window.NexusVoice.supported ? "ONLINE (male voice default)" : "UNAVAILABLE — use Chrome or Edge", !!(window.NexusVoice && window.NexusVoice.supported)],
      ["Database (browser)", X.S.orders.length + " orders · " + X.S.products.length + " products loaded", true],
      ["Internet", navigator.onLine ? "ONLINE" : "OFFLINE", navigator.onLine],
      ["Computer bridge", bridge.online ? "CONNECTED · localhost:8787" : "OFFLINE — run: node bridge.js (start-ai.bat does this)", bridge.online],
      ["Business monitoring", "ONLINE · " + lowStock + " low-stock alert" + (lowStock === 1 ? "" : "s"), true],
      ["Freelance tracking", "ONLINE · " + openLeads + " open lead" + (openLeads === 1 ? "" : "s"), true],
      ["Website monitoring", A.cfg.siteUrl ? "CONFIGURED · " + A.cfg.siteUrl : "NOT CONFIGURED — say “my website is https://…”", !!A.cfg.siteUrl],
      ["Security monitoring", "ONLINE · local audit scope", true],
      ["Tech intelligence", "ONLINE · HN feed (no key needed)", true],
      ["Memory", A.memory.length + " entries · privacy scopes respected", true],
      ["Today", due + " task" + (due === 1 ? "" : "s") + " due · " + over + " overdue", over === 0]
    ];
    var warns = lines.filter(function (l) { return !l[2]; });
    var html = H("JARVIS startup report") +
      lines.map(function (l) {
        return B("<b>" + esc(l[0]) + ":</b> " + (l[2] ? "<span style='color:var(--acc)'>" : "<span style='color:var(--warn)'>") + esc(l[1]) + "</span>");
      }).join("") +
      D([["Warnings", warns.length ? warns.map(function (w) { return esc(w[0]); }).join(" · ") : "None."],
         ["Required action", warns.length ? "See SYSTEM HEALTH → “Required to complete JARVIS”." : "All clear — say “give me my daily briefing”."]]);
    audit("SYSTEM", "Health", "Startup self-check: " + (lines.length - warns.length) + "/" + lines.length + " subsystems nominal", "READ", "EXECUTED");
    notice("system", "🟢 Startup complete — " + (lines.length - warns.length) + "/" + lines.length + " subsystems online" + (warns.length ? " · " + warns.length + " warning" + (warns.length === 1 ? "" : "s") : "") + ".");
    if (X.appendAI) X.appendAI(html);
    else if (X.toast) X.toast("🟢 Startup complete — " + (lines.length - warns.length) + "/" + lines.length + " subsystems online.", warns.length ? "info" : "ok");
  }

  /* ---------------- HTML helpers (scoped) ---------------- */
  function H(t, tag) { return '<div class="cs"><i>▍</i>' + esc(t) + "</div>"; }
  function P(t) { return '<div class="cl">' + t + "</div>"; }
  function B(t) { return '<div class="cl b">· ' + t + "</div>"; }
  function N(t) { return '<span class="cnum">' + t + "</span>"; }
  function D(rows) {
    return '<div class="decision">' + rows.map(function (r) { return '<div class="row"><span class="k">' + r[0] + "</span><span>" + r[1] + "</span></div>"; }).join("") + "</div>";
  }
  function appendAI(html) { if (X.appendAI) X.appendAI(html); }

  /* ---------------- 9. intents ---------------- */
  function handle(raw) {
    var q = raw.trim();
    var t = q.toLowerCase().replace(/[?.!]+$/, "");
    var m;

    /* --- tasks --- */
    if ((m = /^(?:add|create|new) (?:a )?task[:\s]+(.+)/.exec(t))) {
      var body = m[1], due = parseDue(body);
      var title = body.replace(/\b(by )?(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, "").replace(/\s+/g, " ").trim();
      var proj = "personal";
      ["learning", "business", "freelance", "ai", "project"].forEach(function (p) { if (title.indexOf(p) !== -1 || body.indexOf("for " + p) !== -1) proj = p; });
      A.tasks.unshift({ id: uid("t"), title: title.charAt(0).toUpperCase() + title.slice(1), proj: proj, pri: /\burgent|asap|important/.test(body) ? "hi" : "med", status: "todo", due: due, created: Date.now() });
      save(); audit("AI", "Tasks", 'Created task: "' + title + '"' + (due ? " (due " + new Date(due).toDateString() + ")" : ""), "WRITE", "EXECUTED");
      return ok("Task added", P('<b>' + esc(title) + "</b>" + (due ? " — due " + new Date(due).toLocaleDateString() : "") + " · project: " + proj + ".") + P('Say "what are my tasks today" or "mark ' + esc(title.split(" ").slice(0, 3).join(" ")) + ' done" later.'));
    }
    if ((m = /^mark (.+?) (?:as )?(?:done|complete|completed|finished)/.exec(t))) {
      var task = fuzzyTask(m[1]);
      if (!task) return ok("Couldn't find that task", P('No task matches "' + esc(m[1]) + '". Say "show my tasks" to see the list.'));
      task.status = "done"; task.doneAt = Date.now(); save();
      audit("AI", "Tasks", 'Completed: "' + task.title + '"', "WRITE", "EXECUTED");
      var nx = nextTask();
      return ok("Completed ✓", P('"' + esc(task.title) + '" marked done. Today\'s progress: ' + N(progressToday() + "%") + ".") + (nx ? P("Next up: <b>" + esc(nx.title) + "</b>.") : ""));
    }
    if ((m = /^move (.+?) to (today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(t))) {
      var tk = fuzzyTask(m[1]);
      if (!tk) return ok("Couldn't find that task", P("Tell me the task name more precisely — say \"show my tasks\"."));
      tk.due = parseDue(m[2]) || tk.due; save();
      return ok("Rescheduled", P('"' + esc(tk.title) + '" moved to ' + m[2] + "."));
    }
    if (/what (?:are|is)|show|list/.test(t) && /task|to-?do/.test(t)) {
      var over2 = tasksOverdue(), due2 = tasksDueToday();
      var rest = A.tasks.filter(function (x) { return x.status !== "done" && over2.indexOf(x) === -1 && due2.indexOf(x) === -1; });
      var doneW = A.tasks.filter(function (x) { return x.status === "done" && x.doneAt >= startOfDay() - 6 * 86400000; });
      if (!A.tasks.length) return ok("No tasks yet", P('Say "add task …" and I\'ll start tracking.'));
      var out = H("Your tasks", "tasks");
      if (over2.length) { out += P("<b style='color:var(--danger)'>Overdue</b>"); over2.forEach(function (x) { out += B(esc(x.title) + " <span class='mono' style='font-size:10px;color:var(--danger)'>(" + x.proj + ")</span>"); }); }
      if (due2.length) { out += P("<b style='color:var(--acc)'>Due today</b>"); due2.forEach(function (x) { out += B(esc(x.title) + " <span class='mono' style='font-size:10px;color:var(--txt-3)'>(" + x.proj + " · " + x.pri + ")</span>"); }); }
      if (rest.length) { out += P("<b>Upcoming</b>"); rest.slice(0, 5).forEach(function (x) { out += B(esc(x.title) + (x.due ? " <span class='mono' style='font-size:10px;color:var(--txt-3)'>(" + new Date(x.due).toLocaleDateString() + ")</span>" : "")); }); }
      out += D([["Progress today", N(progressToday() + "%") + " · " + doneW.length + " done this week"], ["Say", "\"mark <i>task words</i> done\" · \"what should I do next?\""]]);
      return ok("Tasks", out);
    }
    if (/what should i (?:do|work on) next|what'?s next|priorit/.test(t)) {
      var nx2 = nextTask();
      if (!nx2) return ok("All clear", P("No open tasks. Say \"add task …\" or work your top goal milestone."));
      var why = nx2.due && nx2.due < startOfDay() ? "it's overdue" : nx2.due && nx2.due < startOfDay() + 86400000 ? "it's due today" : "it's your highest-priority item";
      return ok("Your next move", H("Work on this now", "next") + P("<b>" + esc(nx2.title) + "</b> — because " + why + ".") + D([["Project", nx2.proj], ["Priority", nx2.pri.toUpperCase()], ["After this", (function () { var after = A.tasks.filter(function (x) { return x.status !== "done" && x !== nx2; })[0]; return after ? esc(after.title) : "take a breath — you've earned it."; })()]]));
    }

    /* --- goals --- */
    if ((m = /(?:my goal is (?:to )?|goal:?\s*)(.+)/.exec(t))) {
      var gt = m[1].trim(); gt = gt.charAt(0).toUpperCase() + gt.slice(1);
      var miles = goalTemplate(gt).map(function (x) { return { t: x, done: false }; });
      A.goals.unshift({ id: uid("g"), title: gt, why: "Created by voice/text command", deadline: Date.now() + 120 * 86400000, created: Date.now(), milestones: miles });
      save(); audit("AI", "Goals", 'Created goal: "' + gt + '" with ' + miles.length + " milestones", "WRITE", "EXECUTED");
      return ok("Goal created", H("Goal: " + gt, "goal") + miles.map(function (x, i) { return B((i + 1) + ". " + esc(x.t)); }).join("") + D([["Tracked", "Milestones tick automatically as you complete related tasks. Say \"show my goals\" anytime."]]));
    }
    if (/show|what|list/.test(t) && /goal/.test(t) && !/learning goal/.test(t)) {
      if (!A.goals.length) return ok("No goals yet", P('Say "my goal is to become …" and I\'ll build milestones for you.'));
      var gh = H("Your goals", "goals");
      A.goals.forEach(function (g) {
        var done = g.milestones.filter(function (x) { return x.done; }).length;
        var pct = Math.round((done / g.milestones.length) * 100);
        gh += P("<b>" + esc(g.title) + "</b> — " + N(pct + "%") + " (" + done + "/" + g.milestones.length + " milestones)");
        g.milestones.forEach(function (x) { gh += B((x.done ? "✅ " : "○ ") + esc(x.t)); });
      });
      return ok("Goals", gh);
    }

    /* --- progress --- */
    if (/show .*progress|my progress|how am i doing/.test(t)) {
      var week = A.tasks.filter(function (x) { return x.status === "done" && x.doneAt >= startOfDay() - 6 * 86400000; }).length;
      var ph = H("Your progress", "progress") +
        P("Today: " + N(progressToday() + "%") + " · This week: " + N(week + " tasks done") + " · Active projects: " + N(String(A.projects.filter(function (p) { return p.status === "active"; }).length)));
      A.goals.slice(0, 2).forEach(function (g) {
        var d = g.milestones.filter(function (x) { return x.done; }).length;
        ph += B(esc(g.title) + ": " + Math.round((d / g.milestones.length) * 100) + "%");
      });
      var skillTop = X.S.skills.slice().sort(function (a, b) { return b.demand - a.demand; })[0];
      ph += D([["Next to learn", skillTop ? esc(skillTop.name) + " (demand " + skillTop.demand + "/100, you're at " + skillTop.level + "%)" : "—"]]);
      return ok("Progress", ph);
    }
    if (/my projects|show .*projects|project status/.test(t)) {
      var pj = H("Your projects", "projects");
      A.projects.forEach(function (p) {
        pj += P("<b>" + esc(p.name) + "</b> <span class='mono' style='font-size:10px;color:var(--txt-3)'>updated " + timeAgo(p.updated) + "</span>") + B("Next: " + esc(p.next)) + (p.path ? B("Path: <span class='mono' style='font-size:11px'>" + esc(p.path) + "</span>") : "");
      });
      pj += P("Say \"open my personal ai project\" to jump to its folder (needs the bridge).");
      return ok("Projects", pj);
    }

    /* --- briefing --- */
    if (/(give me my |daily |morning )?(briefing|update)|what'?s happening|what'?s important today|what'?s going on|business update/.test(t) && t.length < 40) {
      audit("AI", "Briefing", "Generated daily briefing", "READ", "EXECUTED");
      A.briefHistory.unshift({ at: Date.now() }); A.briefHistory.length = Math.min(30, A.briefHistory.length); save();
      return ok("Briefing", briefingHtml());
    }

    /* --- memory --- */
    if ((m = /^remember (?:that |this:?\s*)?(.+)/.exec(t))) {
      if (X.memoryOn && X.memoryOn() === false) return ok("Memory is off", P("You've disabled command memory in Settings → Memory. Enable it and I'll store this."));
      var kind = classifyMemory(m[1]);
      remember(kind, m[1].charAt(0).toUpperCase() + m[1].slice(1));
      return ok("Saved to memory", P("I'll remember that (filed under <b>" + kind + "</b>). Say \"what do you remember\" or \"forget …\" anytime."));
    }
    if ((m = /^forget (?:that|about|everything about)? ?(.*)/.exec(t))) {
      var removed = forget(m[1] || "that");
      return removed ? ok("Forgotten", P("Removed " + removed + " item" + (removed === 1 ? "" : "s") + " from memory. Logged to the audit trail.")) : ok("Nothing matched", P("No memory entries match. Say \"what do you remember\" to browse."));
    }
    if (/what do you (remember|know) about|show .*memory|my memories/.test(t)) {
      if (!A.memory.length) return ok("Empty memory", P("Say \"remember that …\" to store things."));
      var mh = H("Long-term memory (" + A.memory.length + ")", "memory");
      A.memory.slice(0, 8).forEach(function (mm) { mh += B("<span class='badge mut' style='margin-right:6px'>" + mm.kind + "</span>" + esc(mm.text)); });
      mh += D([["Privacy", "Stored only in this browser. \"Forget <i>topic</i>\" deletes matching entries."]]);
      return ok("Memory", mh);
    }

    /* --- knowledge base --- */
    if (/save (?:this|it) to (?:my )?knowledge|add to (?:my )?knowledge|save this research/.test(t)) {
      var src = A._lastWiki;
      if (src) { kbAdd(src.title, src.text + "\n\nSource: " + src.url, "web"); return ok("Saved to Knowledge Base", P('"' + esc(src.title) + '" indexed. Search it anytime: "search my knowledge for …"')); }
      return ok("Nothing to save yet", P("Ask me to search or research something first — then I can index the result."));
    }
    if ((m = /search my knowledge (?:base )?(?:for|about)? ?(.+)/.exec(t))) {
      var res = kbSearch(m[1]);
      if (!res.length) return ok("No matches", P("Nothing in your Knowledge Base matches \"" + esc(m[1]) + '". Add notes from the Knowledge tab.'));
      var kh = H("Knowledge Base — " + res.length + " match" + (res.length === 1 ? "" : "es"), "kb");
      res.slice(0, 3).forEach(function (k) { kh += P("<b>" + esc(k.title) + "</b> <span class='mono' style='font-size:10px;color:var(--txt-3)'>(" + k.type + " · " + timeAgo(k.at) + ")</span>") + B(esc(k.text.length > 200 ? k.text.slice(0, 200) + "…" : k.text)); });
      return ok("Knowledge", kh);
    }
    if (/^(?:read|summarize) (?:my |this )?(?:readme|document|notes?|file)/.test(t)) {
      var recent = A.kb[0];
      if (!recent) return ok("Nothing to read yet", P("Add a document in the <b>Knowledge</b> tab (paste text or import a .txt/.md file), then ask me to read it."));
      var words = recent.text.split(/\s+/).length;
      return ok("Document summary", H(recent.title, "doc") + B(words + " words · " + recent.type + " · added " + timeAgo(recent.at)) + P(esc(recent.text.length > 350 ? recent.text.slice(0, 350).replace(/\s+\S*$/, "") + "…" : recent.text)) + D([["Honesty", "I read text/Markdown locally. PDFs & Office files need the Phase-2 parser — I won't pretend otherwise."]]));
    }

    /* --- search / research / youtube --- */
    if ((m = /^research (.+)/.exec(t))) return ok("Research", researchPlan(m[1]));
    if ((m = /^(?:search|google|look up)(?: for)? (.+)/.exec(t))) return ok("Search", webSearch(m[1]));
    if ((m = /(?:find|search)(?: me)? (?:the best )?(?:a )?(?:youtube )?(?:tutorial|video|course)(?: (?:for|on|about))? ?(.*)/.exec(t))) return ok("YouTube", youtube(m[1] || "that topic"));
    if ((m = /^youtube (.+)/.exec(t))) return ok("YouTube", youtube(m[1]));

    /* --- open web things (browser agent — real) --- */
    var SITES = {
      youtube: ["YouTube", "https://youtube.com"], google: ["Google", "https://google.com"], gmail: ["Gmail", "https://mail.google.com"],
      github: ["GitHub", "https://github.com"], wordpress: ["WordPress admin", "https://wordpress.com"], "chat gpt": ["ChatGPT", "https://chatgpt.com"],
      chatgpt: ["ChatGPT", "https://chatgpt.com"], analytics: ["Google Analytics", "https://analytics.google.com"],
      woocommerce: ["WooCommerce docs", "https://woocommerce.com/documentation/"], twitter: ["X", "https://x.com"], upwork: ["Upwork", "https://upwork.com"],
    };
    if ((m = /^open (.+)/.exec(t))) {
      var target = m[1].trim();
      var site = SITES[target];
      if (site) {
        openTab(site[1]); audit("AI", "Browser", "Opened " + site[0], "READ", "EXECUTED");
        return ok(site[0] + " opened", P(site[0] + " is open in a new tab. <span class='mono' style='font-size:10.5px;color:var(--txt-3)'>BROWSER AGENT · action logged</span>"));
      }
      if (/^https?:\/\//.test(target)) {
        openTab(target); audit("AI", "Browser", "Opened URL " + target.slice(0, 60), "READ", "EXECUTED");
        return ok("Page opened", P("Opened that URL in a new tab."));
      }
      /* computer-side targets → bridge */
      var APPS = { "vs code": "vscode", "vscode": "vscode", "code": "vscode", terminal: "terminal", "command prompt": "terminal", cmd: "terminal", powershell: "terminal", explorer: "explorer", "file explorer": "explorer", notepad: "notepad", chrome: "chrome", edge: "msedge", browser: "chrome" };
      var appKey = APPS[target.replace(/\s+my\s+.*/, "").replace(/\s+folder.*/, "")];
      var projMatch = /my (.+?) project|my (.+)$/.exec(target);
      if (appKey || projMatch) {
        return computerAction(appKey || "explorer", projMatch ? (projMatch[1] || projMatch[2]) : null);
      }
      webSearch(target);
      return ok("Opened a search instead", P("I don't have an app or site by that exact name, so I searched the web for <b>\"" + esc(target) + "\"</b> — check the new tab."));
    }

    /* --- computer / terminal help --- */
    if (/open (?:vs ?code|terminal|explorer|notepad|chrome|edge)|run (?:the )?(?:dev|development) server|npm run|check why npm|find the error|help me fix|my app (?:crashed|keeps crashing)|why did my (?:app|application) crash/.test(t)) {
      if (/run (?:the )?(?:dev|development) server|npm run dev/.test(t)) return computerAction("terminal", null, "npm run dev");
      if (/check why npm|npm (?:is )?failing|find the error|help me fix|crash/.test(t)) {
        return ok("Let's debug together", H("Error triage", "debug") + P("Paste the exact error text (first red line is usually the truth) and I'll explain it. Common culprits I can check right now:") + B("<b>'node' is not recognized</b> → Node.js not installed or terminal not restarted") + B("<b>EADDRINUSE</b> → old server still running — run stop-ai.bat") + B("<b>Missing script</b> → you're in the wrong folder — cd into standalone/ first") + D([["With bridge", "Start bridge.js and I can run safe commands (node -v, npm -v, git status) and read your logs directly."]]));
      }
      var app2 = /vs ?code/.test(t) ? "vscode" : /terminal/.test(t) ? "terminal" : /explorer/.test(t) ? "explorer" : /notepad/.test(t) ? "notepad" : /edge/.test(t) ? "msedge" : "chrome";
      return computerAction(app2, null);
    }

    /* --- tech intelligence (LIVE) --- */
    if (/tech (news|update|briefing|intel)|what'?s new in tech|technology (news|update|intelligence)|news about (ai|tech|openai|microsoft|google)/.test(t)) {
      return techScanIntent();
    }

    /* --- security monitoring --- */
    if (/security (check|status|scan|report)|am i (safe|secure)|anything suspicious|intrusion|anomaly check/.test(t)) {
      audit("AI", "Security", "Security scan requested", "READ", "EXECUTED");
      return ok("Security scan", securityHtml());
    }

    /* --- website monitoring --- */
    if ((m = /^(?:my website is|set my website to|monitor my website:?)\s+(https?:\/\/\S+)/.exec(t))) {
      A.cfg.siteUrl = m[1].replace(/[.!?]+$/, ""); save();
      audit("AI", "Website", "Monitoring configured: " + A.cfg.siteUrl, "WRITE", "EXECUTED");
      siteStatusHtml(function (html) { if (X.appendAI) X.appendAI(html); });
      return ok("Website connected", P("Monitoring <b>" + esc(A.cfg.siteUrl) + "</b>. First probe running now — results drop here in a second. Ask “check my website” anytime."));
    }
    if (/check my website|website (status|health)|is my (site|website) (up|down|ok|working)|uptime/.test(t)) {
      siteStatusHtml(function (html) { if (X.appendAI) X.appendAI(html); });
      return ok("Probing your site…", P("Sending a real reachability probe. One moment."));
    }

    /* --- computer: screenshot (honest capability boundary) --- */
    if (/take a screenshot|screenshot|capture (my )?screen/.test(t)) {
      return ok("Screenshot — ACTION REQUIRES EXTENSION", H("Screenshot") +
        P("The local bridge handles apps, files and safe commands — but screen capture needs the Phase-2 desktop capture service. I won't pretend I took one.") +
        D([["Now", "Windows: press <b>Win + Shift + S</b> (Snip & Sketch) — paste the result anywhere."],
           ["Phase 2", "The Express server + bridge gain a capture endpoint; then this command works end-to-end."],
           ["Status", "ACTION REQUIRES EXTENSION (nothing was faked)"]]));
    }

    /* --- computer: find my project (real: memory + bridge fs-list) --- */
    if ((m = /find my (.+?) project|where is my (.+?) (?:project|folder)|locate my (.+)/.exec(t))) {
      var name = (m[1] || m[2] || m[3] || "").trim().toLowerCase();
      var proj = null;
      A.projects.forEach(function (p) { if (p.name.toLowerCase().indexOf(name) !== -1 || name.indexOf(p.name.split(" ")[0].toLowerCase()) !== -1) proj = p; });
      if (!proj) return ok("No matching project", P("I track: " + A.projects.map(function (p) { return "<b>" + esc(p.name) + "</b>"; }).join(", ") + ". Add yours from the Tasks & Goals tab."));
      if (proj.path && bridge.online) {
        bridgeExec("fs-list", { path: proj.path }, function (err, j) {
          if (err || (j && j.error)) {
            if (X.appendAI) X.appendAI(P("ACTION FAILED — can't list <b>" + esc(proj.name) + "</b>: " + esc((j && j.error) || "bridge error") + ". Is <span class='mono'>" + esc(proj.path) + "</span> in bridge.config.json allowedPaths?"));
          } else {
            var files = (j.items || []).slice(0, 12).map(function (it) { return (it.dir ? "📁 " : "📄 ") + esc(it.name); }).join(" · ");
            if (X.appendAI) X.appendAI(P("ACTION COMPLETED — <b>" + esc(proj.name) + "</b> at <span class='mono'>" + esc(proj.path) + "</span>") + B(files || "(empty folder)"));
          }
        });
        return ok("Locating project…", P("ACTION STARTED — listing <b>" + esc(proj.name) + "</b> via the bridge…"));
      }
      return ok("Project found (bridge offline)", P("<b>" + esc(proj.name) + "</b> → <span class='mono'>" + esc(proj.path || "no path set") + "</span>") +
        D([["Next", "Run <b>node bridge.js</b> (or start-ai.bat) and ask again to browse its files for real."]]));
    }

    /* --- computer: read a file (real: bridge fs-read, allowlisted paths only) --- */
    if ((m = /^read (?:the |my )?(?:file )?(.+\.(?:js|ts|json|md|txt|html|css|py|bat)|readme\S*)$/i.exec(t))) {
      var fp = m[1].trim();
      if (!bridge.online) return ok("Read file — ACTION REQUIRES BRIDGE", P("File reading goes through the local bridge (only folders you allow in bridge.config.json). It isn't running.") + D([["Fix", "Run <b>node bridge.js</b> — start-ai.bat starts it automatically."], ["Status", "ACTION REQUIRES BRIDGE (nothing was faked)"]]));
      var basePath = fp;
      if (!/^[a-z]:\\/i.test(fp) && !fp.startsWith("/")) {
        var host = A.projects.filter(function (p) { return p.path; })[0];
        basePath = host ? host.path.replace(/[\\/]+$/, "") + "\\" + fp : fp;
      }
      bridgeExec("fs-read", { path: basePath }, function (err, j) {
        if (err || (j && j.error)) {
          if (X.appendAI) X.appendAI(P("ACTION FAILED — " + esc((j && j.error) || "bridge error")) + B("The path must be inside an <b>allowed folder</b> (bridge.config.json). Max 2 MB."));
        } else {
          var snippet = (j.content || "").slice(0, 900);
          if (X.appendAI) X.appendAI(P("ACTION COMPLETED — read <span class='mono'>" + esc(basePath) + "</span> (" + (j.content || "").length + " chars)") +
            '<div class="mono" style="font-size:11px;background:#141416;border:1px solid var(--line);border-radius:8px;padding:10px;margin-top:6px;white-space:pre-wrap">' + esc(snippet) + ((j.content || "").length > 900 ? "…" : "") + "</div>" +
            B("Say “explain this code” and paste a section if you want it broken down."));
        }
      });
      return ok("Reading file…", P("ACTION STARTED — <span class='mono'>" + esc(basePath) + "</span> via bridge…"));
    }

    /* --- computer: run my application (real: bridge exec-safe) --- */
    if (/run my (app|application|project)|start my (app|application)|launch my (app|application)/.test(t)) {
      return computerAction("terminal", null, "npm run dev");
    }

    /* --- screen --- */
    if (/turn (on|off) screen|screen access|screen capture/.test(t)) {
      A.cfg.screen = /(on|enable)/.test(t) ? true : !A.cfg.screen; save();
      return ok("Screen access " + (A.cfg.screen ? "ON" : "OFF"), P(A.cfg.screen ? "Screen access enabled. I will <b>always say</b> when I use screen information, and I never record continuously. Capture itself needs the Phase-2 desktop service — flagged honestly in the Dashboard." : "Screen access disabled. I cannot see anything on your screen."));
    }

    return null; // falls through to the existing AI engine
  }

  function computerAction(app, projectRef, runCmd) {
    var label = app.charAt(0).toUpperCase() + app.slice(1);
    if (!bridge.online) {
      return {
        sound: "ding",
        html: H(label + " — bridge not connected", "computer") +
          P("Computer control runs through the local bridge on your PC (real launching, real files, strict allowlists). It isn't running right now.") +
          D([["Fix", "In your project's <b>standalone</b> folder run <span class='mono'>node bridge.js</span> — or just use <b>start-ai.bat</b>, which starts it automatically."],
             ["Meanwhile", "You can " + (app === "vscode" ? "open VS Code manually: Start menu → type \"code\"" : "open it manually from the Start menu") + "."],
             ["Status", "<b style='color:var(--warn)'>ACTION REQUIRES BRIDGE</b> — nothing was faked."]]),
      };
    }
    if (projectRef) {
      var proj = null;
      A.projects.forEach(function (p) { if ((p.name.toLowerCase().indexOf(projectRef.toLowerCase()) !== -1) || (projectRef.toLowerCase().indexOf(p.name.split(" ")[0].toLowerCase()) !== -1)) proj = p; });
      if (proj && proj.path) {
        bridgeExec("open-path", { path: proj.path }, function (err, j) {
          if (err || (j && j.error)) appendAI(P("<b style='color:var(--danger)'>ACTION FAILED</b> — couldn't open \"" + esc(proj.name) + "\": " + esc((j && j.error) || "bridge error") + ". Is the path in bridge.config.json allowedPaths?"));
          else { appendAI(P("<b style='color:var(--acc)'>ACTION COMPLETED</b> — opened <b>" + esc(proj.name) + "</b> at <span class='mono' style='font-size:11px'>" + esc(proj.path) + "</span>.")); audit("AI", "Computer", "Opened project folder " + proj.path, "EXECUTE", "EXECUTED"); }
        });
        return ok("Opening project…", P("<b style='color:var(--info)'>ACTION STARTED</b> — asking the bridge to open <b>" + esc(proj.name) + "</b>…") + P('<span class="mono" style="font-size:10.5px;color:var(--txt-3)">💻 WORKING ON YOUR COMPUTER · authorized path only</span>'));
      }
      return ok("Which project?", P("I have: " + A.projects.map(function (p) { return "<b>" + esc(p.name) + "</b>"; }).join(", ") + ". Say the name more exactly, or add its folder in the Tasks & Goals tab."));
    }
    if (runCmd) {
      bridgeExec("exec-safe", { cmd: runCmd }, function (err, j) {
        if (err || (j && j.error)) appendAI(P("<b style='color:var(--danger)'>ACTION FAILED</b> — command refused: " + esc((j && j.error) || "bridge unreachable") + ". Safe allowlist only — dangerous commands are never run, and deletions always ask you first."));
        else appendAI(P("<b style='color:var(--acc)'>ACTION COMPLETED</b> — ran <span class='mono'>npm run dev</span> via the bridge. Output appears in the bridge's terminal window."));
      });
      audit("AI", "Terminal", "Executed allowlisted command: " + runCmd, "EXECUTE", "EXECUTED");
      return ok("Running…", P("<b style='color:var(--info)'>ACTION STARTED</b> — executing <span class='mono'>npm run dev</span> through the bridge."));
    }
    bridgeExec("open-app", { app: app }, function (err, j) {
      if (err || (j && j.error)) appendAI(P("<b style='color:var(--danger)'>ACTION FAILED</b> — " + label + " did not launch: " + esc((j && j.error) || "bridge error") + ". Open it manually from the Start menu."));
      else { appendAI(P("<b style='color:var(--acc)'>ACTION COMPLETED</b> — " + label + " launched on your computer.")); }
    });
    audit("AI", "Computer", "Launched app: " + label, "EXECUTE", "EXECUTED");
    return ok(label + " launching…", P("<b style='color:var(--info)'>ACTION STARTED</b> — asking the bridge to open <b>" + label + "</b>…") + P('<span class="mono" style="font-size:10.5px;color:var(--txt-3)">💻 WORKING ON YOUR COMPUTER · allowlisted action · logged</span>'));
  }

  function ok(title, html) { return { sound: "ding", html: html }; }

  /* ---------------- 10. views ---------------- */
  function badgeFor(status) {
    if (status === "connected") return '<span class="badge ok">CONNECTED</span>';
    if (status === "partial") return '<span class="badge info">PARTIAL</span>';
    if (status === "requires bridge") return '<span class="badge warn">REQUIRES BRIDGE</span>';
    if (status === "demo engine") return '<span class="badge vio">DEMO ENGINE</span>';
    if (status === "no paths allowed") return '<span class="badge warn">NO PATHS ALLOWED</span>';
    if (status === "disconnected" || status === "not connected") return '<span class="badge mut">NOT CONNECTED</span>';
    return '<span class="badge mut">' + esc(status.toUpperCase()) + "</span>";
  }

  function viewDashboard() {
    var root = document.createElement("div");
    function render() {
      var s = X.S, sel = X.sel;
      var tiles = [
        ["AI CORE", "ONLINE", "ok", "cpu"],
        ["VOICE", window.NexusVoice && window.NexusVoice.supported ? "READY" : "N/A", window.NexusVoice && window.NexusVoice.supported ? "ok" : "mut", "sndOn"],
        ["COMPUTER", bridge.online ? "CONNECTED" : "BRIDGE OFF", bridge.online ? "ok" : "warn", "plug"],
        ["INTERNET", navigator.onLine ? "CONNECTED" : "OFFLINE", navigator.onLine ? "ok" : "danger", "radio"],
        ["BUSINESS", integ("woo") === "connected" ? "CONNECTED" : "NOT CONNECTED", integ("woo") === "connected" ? "ok" : "mut", "cart"],
        ["WORDPRESS", integ("wp") === "connected" ? "CONNECTED" : "NOT CONNECTED", integ("wp") === "connected" ? "ok" : "mut", "book"],
        ["TASKS", A.tasks.filter(function (x) { return x.status !== "done"; }).length + " OPEN", "info", "check"],
        ["PROJECTS", String(A.projects.filter(function (x) { return x.status === "active"; }).length), "info", "box"],
        ["WEBSITE", A.cfg.siteUrl ? "MONITORED" : "NOT SET", A.cfg.siteUrl ? "ok" : "warn", "radio"],
        ["SECURITY", "ARMED", "ok", "shield"],
      ];
      var prog = progressToday();
      var html =
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px" class="reveal">' +
        tiles.map(function (tl) {
          return '<div class="panel" style="padding:13px 14px;display:flex;align-items:center;gap:11px">' +
            '<span style="color:var(--' + (tl[2] === "ok" ? "acc" : tl[2] === "warn" ? "warn" : tl[2] === "danger" ? "danger" : "info") + ')">' + icon(tl[3], 19) + "</span>" +
            '<div><div class="mono" style="font-size:9px;letter-spacing:0.16em;color:var(--txt-3)">' + tl[0] + '</div><div class="font-display" style="font-weight:700;font-size:14px">' + tl[1] + "</div></div></div>";
        }).join("") +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-top:12px">' +
        '<div class="panel reveal d1"><div class="panel-h"><span class="t">Daily briefing</span><span class="badge ok" style="margin-left:auto">REAL DATA</span></div><div class="panel-b"><div id="briefBody" style="font-size:13.5px;line-height:1.6"></div>' +
        '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-sm" id="briefSpeak">🔊 Speak it</button><button class="btn btn-sm" id="briefRefresh">' + icon("refresh", 12) + " Refresh</button></div></div></div>" +
        '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="panel reveal d2"><div class="panel-h"><span class="t">Today\'s progress</span></div><div class="panel-b">' +
        '<div style="display:flex;align-items:baseline;gap:10px"><span class="kpi-val" style="font-size:34px">' + prog + '%</span><span style="font-size:12px;color:var(--txt-2)">of today\'s tasks</span></div>' +
        '<div class="bar-track" style="margin-top:10px;height:8px"><div class="bar-fill" style="width:' + prog + '%"></div></div>' +
        '<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:8px">' + tasksDueToday().length + ' due · ' + tasksOverdue().length + ' overdue · ' + A.tasks.filter(function (x) { return x.status === "done" && x.doneAt >= startOfDay(); }).length + " done</div></div></div>" +
        '<div class="panel reveal d3"><div class="panel-h"><span class="t">Computer control</span>' + (bridge.online ? '<span class="badge ok" style="margin-left:auto">BRIDGE LIVE</span>' : '<span class="badge warn" style="margin-left:auto">BRIDGE OFF</span>') + '</div><div class="panel-b">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm appBtn" data-app="vscode">VS Code</button>' +
        '<button class="btn btn-sm appBtn" data-app="terminal">Terminal</button>' +
        '<button class="btn btn-sm appBtn" data-app="chrome">Chrome</button>' +
        '<button class="btn btn-sm appBtn" data-app="explorer">Explorer</button></div>' +
        '<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:10px;line-height:1.7">' + (bridge.online
          ? "Bridge live on :8787 · allowed paths: " + (bridgeHasPaths() ? bridge.info.allowedPaths.length : "0 — edit bridge.config.json")
          : "Run <b>node bridge.js</b> in standalone/ (start-ai.bat does this automatically). Until then these buttons report honestly instead of pretending.") + '</div></div></div>' +
        "</div></div>" +
        '<div class="panel reveal d4" style="margin-top:12px"><div class="panel-h"><span class="t">Tool registry · permissions & status</span><span class="badge mut" style="margin-left:auto">' + TOOLS.length + ' TOOLS</span></div>' +
        '<div class="panel-b" style="padding:6px 16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tool</th><th>Permissions</th><th>Status</th><th>Notes</th></tr></thead><tbody>' +
        TOOLS.map(function (tl) {
          return "<tr><td style='font-weight:600'>" + tl.name + "</td><td>" + tl.perms.map(function (p) { return '<span class="badge mut" style="margin-right:4px">' + p + "</span>"; }).join("") + "</td><td>" + badgeFor(tl.how()) + '</td><td style="font-size:12px;color:var(--txt-3);max-width:340px">' + (tl.note ? esc(tl.note) : "Fully operational in this demo.") + "</td></tr>";
        }).join("") +
        "</tbody></table></div></div></div>";
      root.innerHTML = html;
      var brief = root.querySelector("#briefBody");
      var bhtml = briefingHtml();
      brief.innerHTML = bhtml;
      root.querySelector("#briefRefresh").addEventListener("click", function () { brief.innerHTML = briefingHtml(); toast("Briefing refreshed from live data.", "info"); });
      root.querySelector("#briefSpeak").addEventListener("click", function () {
        var tmp = document.createElement("div"); tmp.innerHTML = bhtml;
        var text = (tmp.textContent || "").replace(/\s+/g, " ").slice(0, 600);
        if (window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.rate = 1; window.speechSynthesis.speak(u); }
        else toast("Speech synthesis unavailable in this browser.", "warn");
      });
      root.querySelectorAll(".appBtn").forEach(function (b) {
        b.addEventListener("click", function () {
          var res = computerAction(b.dataset.app, null);
          if (window.__NEXUS && window.__NEXUS.appendAI && !bridge.online) window.__NEXUS.appendAI(res.html);
          if (!bridge.online) toast("Computer bridge offline — see Command Center for the fix.", "warn");
          else toast(b.textContent + " launch requested via bridge.", "ok");
        });
      });
    }
    render();
    var iv = setInterval(function () { pingBridge(function () { if (document.body.contains(root)) render(); }); }, 15000);
    var off = X.on ? X.on(function (k) { if (k === "order" || k === "settings") render(); }) : function () {};
    return { el: root, destroy: function () { clearInterval(iv); off(); } };
  }

  function viewTasks() {
    var root = document.createElement("div");
    var filter = "open";
    function render() {
      var list = A.tasks.filter(function (x) {
        if (filter === "open") return x.status !== "done";
        if (filter === "today") return x.status !== "done" && x.due && x.due >= startOfDay() && x.due < startOfDay() + 86400000;
        if (filter === "done") return x.status === "done";
        return true;
      });
      var PRI = { hi: '<span class="badge danger">HI</span>', med: '<span class="badge warn">MED</span>', lo: '<span class="badge mut">LO</span>' };
      root.innerHTML =
        '<div class="panel reveal"><div class="panel-h"><span class="t">Tasks</span><div style="margin-left:auto;display:flex;gap:6px">' +
        ["open", "today", "done", "all"].map(function (f) { return '<button class="btn btn-sm flt' + (f === filter ? " btn-acc" : "") + '" data-f="' + f + '">' + f + "</button>"; }).join("") +
        "</div></div>" +
        '<div class="panel-b"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' +
        '<input id="ntTitle" placeholder="New task… e.g. Learn OAuth basics by friday" style="flex:1;min-width:220px" />' +
        '<select id="ntProj" style="width:130px">' + ["personal", "business", "learning", "freelance", "ai"].map(function (p) { return "<option>" + p + "</option>"; }).join("") + "</select>" +
        '<select id="ntPri" style="width:90px"><option>med</option><option>hi</option><option>lo</option></select>' +
        '<button class="btn btn-acc" id="ntAdd">' + icon("check", 13) + " Add</button></div>" +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Task</th><th>Project</th><th>Priority</th><th>Due</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (x) {
          var overdue = x.status !== "done" && x.due && x.due < startOfDay();
          return '<tr style="' + (x.status === "done" ? "opacity:0.45" : "") + '"><td><div style="display:flex;align-items:center;gap:10px"><button class="tgl btn-sm" data-id="' + x.id + '" title="toggle done" style="background:none;border:1px solid var(--line-2);border-radius:5px;color:' + (x.status === "done" ? "var(--acc)" : "var(--txt-3)") + ';cursor:pointer;padding:2px 5px">' + icon("check", 12) + '</button><span style="' + (x.status === "done" ? "text-decoration:line-through" : "") + '">' + esc(x.title) + "</span></div></td>" +
            '<td><span class="badge info">' + esc(x.proj) + "</span></td><td>" + PRI[x.pri] + "</td>" +
            '<td class="num" style="' + (overdue ? "color:var(--danger)" : "") + '">' + (x.due ? new Date(x.due).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "—") + (overdue ? " ⏰" : "") + "</td>" +
            '<td><button class="btn btn-sm btn-danger del" data-id="' + x.id + '">' + icon("x", 11) + "</button></td></tr>";
        }).join("") : '<tr><td colspan="5" style="color:var(--txt-3);text-align:center;padding:22px">No tasks here. Add one above — or just tell the AI "add task …"</td></tr>') +
        "</tbody></table></div></div></div>" +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">' +
        '<div class="panel reveal d1"><div class="panel-h"><span class="t">Projects</span></div><div class="panel-b">' +
        A.projects.map(function (p) {
          var pp = projectProgress(p.id);
          return '<div style="padding:10px 0;border-bottom:1px dashed rgba(255,255,255,0.07)"><div style="display:flex;justify-content:space-between;align-items:center"><b>' + esc(p.name) + '</b><span class="mono" style="font-size:10px;color:var(--txt-3)">' + timeAgo(p.updated) + "</span></div>" +
            '<div style="font-size:12px;color:var(--txt-2);margin:4px 0">Next: ' + esc(p.next) + "</div>" +
            (p.path ? '<div class="mono" style="font-size:10.5px;color:var(--txt-3)">' + esc(p.path) + "</div>" : "") +
            (pp !== null ? '<div class="bar-track" style="margin-top:7px"><div class="bar-fill i" style="width:' + pp + '%"></div></div>' : "") +
            "</div>";
        }).join("") + "</div></div>" +
        '<div class="panel reveal d2"><div class="panel-h"><span class="t">Goals</span><span class="badge vio" style="margin-left:auto">MILESTONE TRACKING</span></div><div class="panel-b">' +
        A.goals.map(function (g) {
          var done = g.milestones.filter(function (x) { return x.done; }).length;
          var pct = Math.round((done / g.milestones.length) * 100);
          return '<div style="padding:10px 0"><div style="display:flex;justify-content:space-between"><b>' + esc(g.title) + '</b><span class="mono" style="font-size:11px;color:var(--acc)">' + pct + "%</span></div>" +
            '<div class="bar-track" style="margin:8px 0"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
            g.milestones.map(function (mm, i) {
              return '<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:' + (mm.done ? "var(--txt-3)" : "var(--txt-2)") + ';padding:2.5px 0;cursor:pointer"><input type="checkbox" class="ms" data-g="' + g.id + '" data-i="' + i + '"' + (mm.done ? " checked" : "") + ' style="width:auto;accent-color:var(--acc)"> <span style="' + (mm.done ? "text-decoration:line-through" : "") + '">' + esc(mm.t) + "</span></label>";
            }).join("") + "</div>";
        }).join("") + "</div></div></div>";

      root.querySelectorAll(".flt").forEach(function (b) { b.addEventListener("click", function () { filter = b.dataset.f; render(); }); });
      var addBtn = root.querySelector("#ntAdd");
      function add() {
        var titleEl = root.querySelector("#ntTitle");
        var title = titleEl.value.trim();
        if (!title) return;
        var due = parseDue(title.toLowerCase());
        title = title.replace(/\b(by )?(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, "").replace(/\s+/g, " ").trim();
        A.tasks.unshift({ id: uid("t"), title: title, proj: root.querySelector("#ntProj").value, pri: root.querySelector("#ntPri").value, status: "todo", due: due, created: Date.now() });
        save(); audit("YOU", "Tasks", 'Created task: "' + title + '"', "WRITE", "EXECUTED");
        render();
      }
      addBtn.addEventListener("click", add);
      root.querySelector("#ntTitle").addEventListener("keydown", function (e) { if (e.key === "Enter") add(); });
      root.querySelectorAll(".tgl").forEach(function (b) {
        b.addEventListener("click", function () {
          var x = A.tasks.find(function (y) { return y.id === b.dataset.id; });
          if (!x) return;
          x.status = x.status === "done" ? "todo" : "done";
          x.doneAt = x.status === "done" ? Date.now() : null;
          save(); render();
        });
      });
      root.querySelectorAll(".del").forEach(function (b) {
        b.addEventListener("click", function () {
          A.tasks = A.tasks.filter(function (y) { return y.id !== b.dataset.id; });
          save(); audit("YOU", "Tasks", "Deleted a task", "DELETE", "EXECUTED");
          render();
        });
      });
      root.querySelectorAll(".ms").forEach(function (c) {
        c.addEventListener("change", function () {
          var g = A.goals.find(function (y) { return y.id === c.dataset.g; });
          if (!g) return;
          g.milestones[parseInt(c.dataset.i, 10)].done = c.checked;
          save();
          if (c.checked) { audit("YOU", "Goals", 'Milestone done: "' + g.milestones[parseInt(c.dataset.i, 10)].t + '"', "WRITE", "EXECUTED"); }
        });
      });
    }
    render();
    return { el: root };
  }

  function viewKnowledge() {
    var root = document.createElement("div");
    function render() {
      root.innerHTML =
        '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px">' +
        '<div class="panel reveal"><div class="panel-h"><span class="t">Knowledge base</span><span class="badge mut" style="margin-left:auto">LOCAL ONLY · ' + A.kb.length + " DOCS</span></div><div class="panel-b">' +
        '<div style="display:flex;gap:8px;margin-bottom:10px"><input id="kbSearch" placeholder="Search my knowledge… e.g. webhook secret" style="flex:1" /><button class="btn btn-sm" id="kbGo">Search</button></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input id="kbTitle" placeholder="Title" style="flex:1;min-width:140px" /><label class="btn btn-sm" style="cursor:pointer">Import .txt / .md<input type="file" id="kbFile" accept=".txt,.md,.json,.csv" style="display:none"></label></div>' +
        '<textarea id="kbText" rows="3" placeholder="Paste notes, code snippets, research…" style="width:100%;margin-bottom:10px"></textarea>' +
        '<button class="btn btn-acc btn-sm" id="kbAdd">' + icon("check", 12) + " Index note</button>" +
        '<div id="kbList" style="margin-top:14px"></div></div></div>' +
        '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="panel reveal d1"><div class="panel-h"><span class="t">Layered memory</span><span class="badge vio" style="margin-left:auto">' + A.memory.length + "</span></div><div class="panel-b" id="memList"></div></div>' +
        '<div class="panel reveal d2"><div class="panel-h"><span class="t">Privacy</span></div><div class="panel-b" style="font-size:12.5px;color:var(--txt-2);line-height:1.7">' +
        "Memory & knowledge stay in this browser (localStorage). Voice transcripts follow your memory settings. " +
        'Say <b>"forget …"</b> to delete entries, or clear everything below. Nothing is uploaded anywhere in the demo.</div>' +
        '<div class="panel-b" style="padding-top:0"><button class="btn btn-sm btn-danger" id="memClear">Clear all memory</button></div></div>' +
        "</div></div>";
      var listEl = root.querySelector("#kbList");
      function paintList(q) {
        var items = q ? kbSearch(q) : A.kb;
        listEl.innerHTML = items.length ? items.map(function (k) {
          return '<div style="padding:10px 0;border-bottom:1px dashed rgba(255,255,255,0.07)"><div style="display:flex;justify-content:space-between"><b style="font-size:13px">' + esc(k.title) + '</b><span class="mono" style="font-size:10px;color:var(--txt-3)">' + k.type + " · " + timeAgo(k.at) + '</span></div><div style="font-size:12px;color:var(--txt-2);margin-top:4px">' + esc(k.text.length > 220 ? k.text.slice(0, 220) + "…" : k.text) + '</div><button class="btn btn-sm btn-danger kbdel" data-id="' + k.id + '" style="margin-top:7px">' + icon("x", 11) + " Remove</button></div>";
        }).join("") : '<div style="color:var(--txt-3);text-align:center;padding:18px;font-size:13px">Nothing ' + (q ? 'matches "' + esc(q) + '"' : "indexed yet") + "</div>";
        listEl.querySelectorAll(".kbdel").forEach(function (b) {
          b.addEventListener("click", function () { A.kb = A.kb.filter(function (y) { return y.id !== b.dataset.id; }); save(); paintList(q); });
        });
      }
      paintList();
      root.querySelector("#kbGo").addEventListener("click", function () { paintList(root.querySelector("#kbSearch").value.trim()); });
      root.querySelector("#kbSearch").addEventListener("keydown", function (e) { if (e.key === "Enter") paintList(e.target.value.trim()); });
      root.querySelector("#kbAdd").addEventListener("click", function () {
        var title = root.querySelector("#kbTitle").value.trim() || "Untitled note";
        var text = root.querySelector("#kbText").value.trim();
        if (!text) { toast("Paste some content first.", "warn"); return; }
        kbAdd(title, text, "note");
        root.querySelector("#kbTitle").value = ""; root.querySelector("#kbText").value = "";
        paintList(); toast("Indexed to your knowledge base.", "ok");
      });
      root.querySelector("#kbFile").addEventListener("change", function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () { kbAdd(f.name, String(r.result).slice(0, 200000), "file"); paintList(); toast("Imported " + esc(f.name) + " (" + Math.round(f.size / 1024) + " KB).", "ok"); };
        r.readAsText(f);
      });
      var memEl = root.querySelector("#memList");
      function paintMem() {
        memEl.innerHTML = A.memory.map(function (mm) {
          return '<div style="padding:8px 0;border-bottom:1px dashed rgba(255,255,255,0.07);font-size:12.5px"><span class="badge mut" style="margin-right:7px">' + mm.kind + "</span>" + esc(mm.text) + '<button class="btn btn-sm memdel" data-id="' + mm.id + '" style="float:right;padding:2px 7px">' + icon("x", 10) + "</button></div>";
        }).join("") || '<div style="color:var(--txt-3);font-size:13px">No memories stored.</div>';
        memEl.querySelectorAll(".memdel").forEach(function (b) {
          b.addEventListener("click", function () { A.memory = A.memory.filter(function (y) { return y.id !== b.dataset.id; }); save(); paintMem(); });
        });
      }
      paintMem();
      root.querySelector("#memClear").addEventListener("click", function () {
        modal({ title: "Clear all memory?", confirmLabel: "Clear", tone: "danger", bodyHtml: "<p style='font-size:13px'>All " + A.memory.length + " memory entries will be deleted. Knowledge base documents are kept. Logged to the audit trail.</p>" }, function (yes) {
          if (!yes) return;
          A.memory = []; save(); audit("YOU", "Memory", "Cleared all memory entries", "DELETE", "EXECUTED"); paintMem(); toast("Memory cleared.", "info");
        });
      });
    }
    render();
    return { el: root };
  }

  /* ---------------- init ---------------- */
  function init() {
    X = window.__NEXUS;
    esc = X.helpers.esc; ksh = X.helpers.ksh; num = X.helpers.num; icon = X.helpers.icon;
    toast = X.helpers.toast; modal = X.helpers.modal; timeAgo = X.helpers.timeAgo; hhmm = X.helpers.hhmm;
    /* startup sequence: probe bridge FIRST, then produce the full startup report */
    pingBridge(function () {
      setTimeout(startupReport, 800);
      if (A.cfg.siteUrl && A.cfg.autoBrief) {
        checkSite(A.cfg.siteUrl, function (err, ms) {
          if (err) notice("alert", "🔴 Startup site check: " + A.cfg.siteUrl + " did not respond.");
          else audit("AI", "Website", "Startup site check: UP in " + ms + " ms", "READ", "EXECUTED");
        });
      }
    });
    setInterval(function () { pingBridge(); }, 20000);
    setInterval(function () { proactiveCheck(false); }, 5 * 60000);
    setTimeout(function () { proactiveCheck(true); }, 4000);
    morningGreeting();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 0); });
  else setTimeout(init, 0);

  window.NexusAgent = {
    init: init,
    handle: function (q) { return X ? handle(q) : null; },
    /* programmatic ask — runs an intent and streams the result to the console */
    run: function (q) {
      if (!X) return null;
      var res = handle(q);
      if (res && res.html && X.appendAI) X.appendAI(res.html);
      return res;
    },
    viewDashboard: viewDashboard,
    viewTasks: viewTasks,
    viewKnowledge: viewKnowledge,
    briefing: function () { return X ? briefingHtml() : ""; },
    securityReport: function () { return X ? securityHtml() : ""; },
    checkSiteNow: function (cb) { if (X) siteStatusHtml(cb); },
    siteUrl: function () { return A.cfg.siteUrl || ""; },
    startupReport: function () { if (X) startupReport(); },
    pingBridge: function (cb) { pingBridge(cb); },
    bridge: bridge,
  };
})();
