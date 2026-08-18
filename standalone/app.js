/* ============================================================
   NEXUS//OS — standalone demo (vanilla JS, ZERO dependencies)
   Run: `node server.js` in this folder, or just open index.html.
   Demo mode: fictional data, localStorage persistence, no payments.
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- helpers ---------------- */
  const $ = (s, el) => (el || document).querySelector(s);
  const DAY = 86400000;
  const HOUR = 3600000;
  const MIN = 60000;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ksh = (n) => "KSh " + Math.round(n).toLocaleString("en-KE");
  const num = (n) => Math.round(n).toLocaleString("en-KE");
  const timeAgo = (ts) => {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + "s ago";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  };
  const hhmm = (ts) => new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
  function rng(seed) {
    let s = seed;
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ICONS = {
    pulse: "M2 12h4l3-8 4 16 3-8h6",
    box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5L12 12l8.7-4.5M12 22V12",
    cart: "M9 20a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2zM2 3h3l2.6 12.4A2 2 0 009.6 17H19a2 2 0 002-1.6L22.6 8H6",
    coins: "M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3.5 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5",
    brief: "M3 7h18v13H3zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18",
    zap: "M13 2L3 14h8l-1 8 10-12h-8l1-8z",
    bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
    sndOn: "M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13",
    sndOff: "M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6m0-6l6 6",
    x: "M18 6L6 18M6 6l12 12",
    check: "M20 6L9 17l-5-5",
    warn: "M10.3 3.8L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0zM12 9v4m0 4h.01",
    cpu: "M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3M19 9h3m-3 6h3M5 5h14v14H5zM9 9h6v6H9z",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
    radio: "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M16.2 7.8a6 6 0 010 8.4m-8.4 0a6 6 0 010-8.4M19 5a10 10 0 010 14M5 19A10 10 0 015 5",
    refresh: "M21 12a9 9 0 11-2.6-6.3M21 3v6h-6",
    menu: "M3 6h18M3 12h18M3 18h18",
    hex: "M12 2l8 4.6v9.2L12 22l-8-4.6V7.4L12 2zm0 6.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
    cap: "M22 9L12 4 2 9l10 5 10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5",
    chart: "M3 3v18h18M8 17V9m5 8V5m5 12v-6",
  };
  const icon = (name, size) =>
    '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (ICONS[name] || ICONS.box).split("M").filter(Boolean).map((p) => '<path d="M' + p + '"/>').join("") +
    "</svg>";

  /* ---------------- sound engine (Web Audio, no files) ---------------- */
  const Sound = {
    ctx: null, master: null, muted: false,
    ac() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
      }
      return this.ctx;
    },
    unlock() { const c = this.ac(); if (c && c.state === "suspended") c.resume(); },
    tone(f, d, type, g, when, slide) {
      const c = this.ac(); if (!c || !this.master || this.muted) return;
      const t0 = c.currentTime + (when || 0);
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
      gn.gain.setValueAtTime(0, t0);
      gn.gain.linearRampToValueAtTime(g, t0 + 0.008);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(gn); gn.connect(this.master);
      o.start(t0); o.stop(t0 + d + 0.05);
    },
    noise(d, g, when, hp) {
      const c = this.ac(); if (!c || !this.master || this.muted) return;
      const t0 = c.currentTime + (when || 0);
      const len = Math.floor(c.sampleRate * d);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp || 2000;
      const gn = c.createGain();
      gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      src.connect(f); f.connect(gn); gn.connect(this.master); src.start(t0);
    },
    cash() { this.tone(1318.5, 0.5, "triangle", 0.22); this.tone(1975.5, 0.42, "triangle", 0.16, 0.06); this.tone(2637, 0.3, "sine", 0.1, 0.06); this.noise(0.14, 0.12, 0, 5200); this.tone(160, 0.12, "square", 0.12, 0.14); this.tone(95, 0.16, "sine", 0.16, 0.16); },
    ding() { this.tone(880, 0.28, "sine", 0.16); this.tone(1318.5, 0.34, "sine", 0.1, 0.07); },
    whoosh() { this.noise(0.3, 0.05, 0, 900); this.tone(420, 0.22, "sine", 0.07, 0, 780); },
    err() { this.tone(220, 0.2, "sawtooth", 0.08); this.tone(165, 0.26, "sawtooth", 0.08, 0.09); },
    approve() { this.tone(660, 0.12, "sine", 0.12); this.tone(990, 0.2, "sine", 0.12, 0.1); },
  };

  /* ---------------- demo seed data (ALL FICTIONAL) ---------------- */
  const PRODUCTS = [
    { id: "p1", name: "HP EliteBook 840 G5", spec: "i5-8350U · 8GB · 256SSD", cost: 32000, price: 42500, stock: 7, views: 4820, conv: 2.6, velocity: 5 },
    { id: "p2", name: "Dell Latitude 7490", spec: "i5-8350U · 8GB · 256SSD", cost: 29500, price: 38900, stock: 5, views: 3610, conv: 2.1, velocity: 4 },
    { id: "p3", name: "Lenovo ThinkPad T480", spec: "i5-8250U · 16GB · 512SSD", cost: 30000, price: 39500, stock: 2, views: 5240, conv: 3.1, velocity: 6 },
    { id: "p4", name: 'MacBook Air 13" 2017', spec: "i5 · 8GB · 128SSD", cost: 48000, price: 62000, stock: 3, views: 6130, conv: 1.7, velocity: 2 },
    { id: "p5", name: "HP ProBook 450 G6", spec: "i5-8265U · 8GB · 1TB", cost: 27000, price: 35500, stock: 9, views: 2140, conv: 1.4, velocity: 3 },
    { id: "p6", name: "Dell XPS 13 9360", spec: "i7-7500U · 16GB · 512SSD", cost: 41000, price: 54500, stock: 1, views: 3890, conv: 2.9, velocity: 3 },
    { id: "p7", name: "ThinkPad X1 Carbon G6", spec: "i7-8650U · 16GB · 512SSD", cost: 45000, price: 58000, stock: 4, views: 2980, conv: 2.2, velocity: 2 },
    { id: "p8", name: "Toshiba Dynabook G83", spec: "i5-8250U · 8GB · 256SSD", cost: 21000, price: 28500, stock: 12, views: 1720, conv: 1.1, velocity: 4 },
  ];
  const NAMES = ["Brian Otieno", "Faith Wanjiru", "Kevin Mwangi", "Aisha Hassan", "Peter Kiprop", "Grace Nyambura", "Samuel Mutua", "Diana Cherono", "Victor Omondi", "Mercy Achieng", "John Kamau", "Halima Yusuf"];
  const SOURCES = ["WooCommerce", "WooCommerce", "WooCommerce", "Instagram", "Instagram", "WhatsApp", "TikTok", "Walk-in"];
  const STORAGE_KEY = "nexusos_demo_v1";

  function seedState() {
    const r = rng(20240817);
    const now = Date.now();
    const orders = [];
    let oid = 1041;
    for (let d = 13; d >= 0; d--) {
      const base = now - d * DAY;
      const recency = 13 - d;
      const count = 1 + Math.floor(r() * 3) + (recency > 9 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const p = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
        const at = base - (8 + Math.floor(r() * 11)) * HOUR - Math.floor(r() * 50) * MIN;
        const c = NAMES[Math.floor(r() * NAMES.length)];
        orders.push({
          id: "ORD-" + oid++, at: at, customer: c, productId: p.id, qty: 1,
          revenue: p.price, profit: p.price - p.cost,
          status: d === 0 ? (r() > 0.5 ? "paid" : "processing") : d < 3 ? "shipped" : "delivered",
          source: SOURCES[Math.floor(r() * SOURCES.length)],
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = PRODUCTS[[0, 2, 7][i]];
      orders.push({
        id: "ORD-" + oid++, at: now - (i + 1) * 47 * MIN, customer: NAMES[i * 3], productId: p.id, qty: 1,
        revenue: p.price, profit: p.price - p.cost, status: i === 0 ? "processing" : "paid",
        source: ["WooCommerce", "Instagram", "WhatsApp"][i],
      });
    }
    orders.sort((a, b) => b.at - a.at);
    return {
      v: 1,
      products: JSON.parse(JSON.stringify(PRODUCTS)),
      orders: orders,
      expenses: [
        { id: "e1", at: now - 12 * DAY, label: "Shop rent (demo)", category: "Rent", amount: 15000, recurring: true },
        { id: "e2", at: now - 9 * DAY, label: "Meta ads top-up", category: "Marketing", amount: 5200, recurring: false },
        { id: "e3", at: now - 8 * DAY, label: "Fibre internet", category: "Utilities", amount: 3500, recurring: true },
        { id: "e4", at: now - 6 * DAY, label: "Hosting + domain", category: "Software", amount: 1800, recurring: true },
        { id: "e5", at: now - 4 * DAY, label: "Rider deliveries x6", category: "Logistics", amount: 2400, recurring: false },
        { id: "e6", at: now - 2 * DAY, label: "TikTok Spark Ads", category: "Marketing", amount: 3000, recurring: false },
        { id: "e7", at: now - 1 * DAY, label: "Packaging & receipts", category: "Supplies", amount: 900, recurring: false },
      ],
      campaigns: [
        { id: "m1", name: "EliteBook promo — Meta feed", platform: "Meta", spend: 5200, conversions: 3, revenue: 127500, active: true },
        { id: "m2", name: "Spark Ads — T480 review video", platform: "TikTok", spend: 3000, conversions: 2, revenue: 79000, active: true },
        { id: "m3", name: "IG Story boost — XPS 13", platform: "Meta", spend: 2800, conversions: 0, revenue: 0, active: true },
      ],
      leads: [
        { id: "l1", name: "Karen S. — Smile Clinic", service: "WordPress booking site + SEO", value: 45000, stage: "proposal", deadline: now + 3 * DAY, note: "Loved the portfolio. Wants WhatsApp booking." },
        { id: "l2", name: "BlueSky Tours", service: "Safari booking platform", value: 85000, stage: "negotiation", deadline: now + 6 * DAY, note: "Comparing with one other dev. Price-sensitive." },
        { id: "l3", name: "David M. — Law firm", service: "Monthly SEO retainer", value: 20000, stage: "contacted", deadline: now + 9 * DAY, note: "Follow up Friday with audit sample." },
        { id: "l4", name: "NiaFit Studio", service: "Landing page + Meta pixel", value: 15000, stage: "lead", deadline: now + 1 * DAY, note: "Replied to IG ad. Respond within 1h!" },
        { id: "l5", name: "Garage 254", service: "POS + inventory setup", value: 60000, stage: "won", deadline: now - 2 * DAY, note: "Kickoff Monday. 50% deposit received." },
      ],
      audit: [
        { id: "a1", at: now - 26 * HOUR, actor: "SYSTEM", module: "Integrations", action: "WooCommerce webhook order.created verified (HMAC OK)", scope: "READ", outcome: "LOGGED" },
        { id: "a2", at: now - 25 * HOUR, actor: "AI", module: "E-commerce", action: "Parsed ORD-1041 payload → wrote order + decremented stock", scope: "WRITE", outcome: "EXECUTED" },
        { id: "a3", at: now - 20 * HOUR, actor: "AI", module: "BI", action: "Flagged IG Story boost ROAS 0.0 — recommended pause", scope: "READ", outcome: "LOGGED" },
        { id: "a4", at: now - 8 * HOUR, actor: "AI", module: "E-commerce", action: "Requested reorder ThinkPad T480 ×5 — awaiting approval", scope: "FINANCIAL", outcome: "PENDING" },
        { id: "a5", at: now - 3 * HOUR, actor: "AI", module: "Analytics", action: "Daily traffic pull from GA4 Data API", scope: "READ", outcome: "EXECUTED" },
      ],
      notices: [
        { id: "n1", at: now - 47 * MIN, kind: "sale", text: "New order received — " + ksh(42500) + " (HP EliteBook 840 G5) via WooCommerce", read: false },
        { id: "n2", at: now - 3 * HOUR, kind: "alert", text: "ThinkPad T480 low stock — 2 left, selling 6/week. Reorder suggested.", read: false },
        { id: "n3", at: now - 6 * HOUR, kind: "ai", text: "Insight: TikTok drives 2.9× better conversion than Meta for T480.", read: false },
      ],
      workflows: [
        { id: "w1", name: "New Order Pipeline", trigger: "WooCommerce · order.created", steps: ["AI parses webhook", "DB updated", "Telegram notify", "Analytics +1"], enabled: true, runs: 132 },
        { id: "w2", name: "Low-Stock Sentinel", trigger: "stock.level ≤ 2", steps: ["Compute velocity", "Supplier price check", "Notify phone", "Draft reorder"], enabled: true, runs: 18 },
        { id: "w3", name: "Daily Report 19:00", trigger: "cron · daily 19:00 EAT", steps: ["Aggregate sales", "Pull GA4 + Meta", "AI summary", "Send Telegram"], enabled: true, runs: 41 },
        { id: "w4", name: "Social Pulse", trigger: "cron · hourly", steps: ["Meta Graph pull", "TikTok pull", "Anomaly scan"], enabled: false, runs: 96 },
      ],
      integrations: [
        { id: "woo", name: "WooCommerce", status: "connected" },
        { id: "wp", name: "WordPress", status: "connected" },
        { id: "ga4", name: "Google Analytics 4", status: "connected" },
        { id: "meta", name: "Meta Graph (IG)", status: "connected" },
        { id: "tiktok", name: "TikTok Business", status: "disconnected" },
        { id: "telegram", name: "Telegram Bot", status: "connected" },
        { id: "openai", name: "OpenAI (gpt-4o-mini)", status: "connected" },
      ],
      social: {
        instagram: { followers: 4218, growth7d: 141, engRate: 4.6, reach: genReach(520, r) },
        tiktok: { followers: 9842, growth7d: 402, engRate: 7.9, reach: genReach(1450, r) },
      },
      settings: { sound: true, sim: true },
      feed: [],
      oid: oid,
    };
  }
  function genReach(base, r) {
    const out = [];
    for (let i = 0; i < 14; i++) out.push(Math.round(base * (0.7 + 0.05 * i + r() * 0.5)));
    return out;
  }

  /* ---------------- store + persistence ---------------- */
  let S;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    S = raw ? JSON.parse(raw) : seedState();
    if (!S || !S.v) S = seedState();
  } catch (e) { S = seedState(); }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch (e) { /* storage full/blocked — demo continues in memory */ } }
  const listeners = new Set();
  function emit(kind) { listeners.forEach((f) => { try { f(kind); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }

  /* ---------------- selectors ---------------- */
  const startOfDay = (ts) => { const d = new Date(ts || Date.now()); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const sel = {
    productById: (id) => S.products.find((p) => p.id === id),
    ordersOn: (dayStart) => S.orders.filter((o) => o.at >= dayStart && o.at < dayStart + DAY),
    todayOrders() { return this.ordersOn(startOfDay()); },
    todayRevenue() { return this.todayOrders().reduce((a, o) => a + o.revenue, 0); },
    todayProfit() { return this.todayOrders().reduce((a, o) => a + o.profit, 0); },
    monthRevenue() { const t = startOfDay() - 29 * DAY; return S.orders.filter((o) => o.at >= t).reduce((a, o) => a + o.revenue, 0); },
    monthProfit() { const t = startOfDay() - 29 * DAY; return S.orders.filter((o) => o.at >= t).reduce((a, o) => a + o.profit, 0); },
    monthExpenses() { const t = startOfDay() - 29 * DAY; return S.expenses.filter((e) => e.at >= t).reduce((a, e) => a + e.amount, 0); },
    revSeries() {
      const out = [];
      for (let i = 13; i >= 0; i--) out.push(this.ordersOn(startOfDay() - i * DAY).reduce((a, o) => a + o.revenue, 0));
      return out;
    },
    topProducts() {
      const t = startOfDay() - 29 * DAY;
      return S.products.map((p) => {
        const os = S.orders.filter((o) => o.productId === p.id && o.at >= t);
        return { p: p, units: os.reduce((a, o) => a + o.qty, 0), profit: os.reduce((a, o) => a + o.profit, 0) };
      }).sort((a, b) => b.profit - a.profit);
    },
    lowStock() { return S.products.filter((p) => p.stock <= 2).sort((a, b) => a.stock - b.stock); },
    unread() { return S.notices.filter((n) => !n.read).length; },
  };

  /* ---------------- actions ---------------- */
  function addAudit(actor, module, action, scope, outcome) {
    S.audit.unshift({ id: "a" + Date.now() + Math.floor(Math.random() * 999), at: Date.now(), actor: actor, module: module, action: action, scope: scope, outcome: outcome });
    S.audit = S.audit.slice(0, 120);
  }
  function addNotice(kind, text) {
    S.notices.unshift({ id: "n" + Date.now(), at: Date.now(), kind: kind, text: text, read: false });
    S.notices = S.notices.slice(0, 60);
    updateBell();
  }
  function pushFeed(iconName, color, text) {
    S.feed.unshift({ at: Date.now(), icon: iconName, color: color, text: text });
    S.feed = S.feed.slice(0, 12);
  }
  function recordOrder(forcedProduct) {
    const pool = S.products.filter((p) => p.stock > 0);
    if (!pool.length) { toast("All demo stock sold out — reset demo data in Automations.", "danger"); Sound.err(); return null; }
    const p = forcedProduct || pool[Math.floor(Math.random() * pool.length)];
    const order = {
      id: "ORD-" + S.oid++, at: Date.now(),
      customer: NAMES[Math.floor(Math.random() * NAMES.length)],
      productId: p.id, qty: 1, revenue: p.price, profit: p.price - p.cost,
      status: "paid", source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
    };
    S.orders.unshift(order);
    p.stock = Math.max(0, p.stock - 1);
    p.views += 40 + Math.floor(Math.random() * 90);
    addAudit("AI", "E-commerce", "Parsed " + order.id + " webhook → wrote order, decremented stock", "WRITE", "EXECUTED");
    addNotice("sale", "🔔 New order received — " + ksh(order.revenue) + " (" + p.name + ") via " + order.source);
    pushFeed("cart", "var(--acc)", order.id + " · " + ksh(order.revenue) + " · " + p.name + " · " + order.source);
    const wf = S.workflows.find((w) => w.id === "w1");
    if (wf && wf.enabled) { wf.runs++; addAudit("SYSTEM", "Automation", "Workflow 'New Order Pipeline' ran (Telegram alert dispatched)", "WRITE", "EXECUTED"); }
    if (p.stock === 1) {
      addNotice("alert", "⚠️ " + p.name + " low stock — 1 left, velocity " + p.velocity + "/week.");
      addAudit("AI", "E-commerce", "Low-stock sentinel flagged " + p.name + " (1 left)", "READ", "LOGGED");
    }
    save();
    emit("order");
    return order;
  }

  /* ---------------- UI primitives ---------------- */
  function toast(text, kind) {
    let root = document.getElementById("toasts");
    if (!root) { root = document.createElement("div"); root.id = "toasts"; document.body.appendChild(root); }
    const icons = { ok: "check", warn: "warn", danger: "warn", info: "bell" };
    const colors = { ok: "var(--acc)", warn: "var(--warn)", danger: "var(--danger)", info: "var(--info)" };
    const t = document.createElement("div");
    t.className = "toast " + (kind || "ok");
    t.innerHTML = '<span class="ic" style="color:' + colors[kind || "ok"] + '">' + icon(icons[kind || "ok"], 17) + "</span><div>" + text + "</div>";
    root.appendChild(t);
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { t.remove(); }, 260); }, 4200);
  }
  function flash(label) {
    let f = document.getElementById("saleFlash");
    if (!f) { f = document.createElement("div"); f.id = "saleFlash"; document.body.appendChild(f); }
    f.innerHTML = '<div class="tag">' + esc(label) + "</div>";
    f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
    setTimeout(function () { f.classList.remove("on"); }, 750);
  }
  function modal(opts, cb) {
    const root = document.createElement("div");
    root.className = "modal-root";
    root.innerHTML =
      '<div class="modal-back"></div><div class="modal">' +
      '<div class="panel-h"><span class="t" style="color:var(--txt)">' + opts.title + '</span><button class="btn btn-sm" data-close style="margin-left:auto">' + icon("x", 13) + "</button></div>" +
      '<div class="panel-b">' + opts.bodyHtml + "</div>" +
      '<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 16px 16px">' +
      '<button class="btn" data-no>' + (opts.cancelLabel || "Cancel") + "</button>" +
      '<button class="btn ' + (opts.tone === "danger" ? "btn-danger" : "btn-acc") + '" data-yes>' + (opts.confirmLabel || "Confirm") + "</button></div></div>";
    const done = (v) => { root.remove(); if (cb) cb(v); };
    root.querySelector("[data-close]").addEventListener("click", () => done(false));
    root.querySelector("[data-no]").addEventListener("click", () => done(false));
    root.querySelector("[data-yes]").addEventListener("click", () => done(true));
    root.querySelector(".modal-back").addEventListener("click", () => done(false));
    document.body.appendChild(root);
  }
  function countUp(el, to, fmt) {
    const f = fmt || ((n) => String(Math.round(n)));
    const from = el._v || 0; el._v = to;
    const t0 = performance.now(), dur = 650;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function areaChart(cv, data, color) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300, h = cv.clientHeight || 90;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const pad = 6, max = Math.max.apply(null, data.concat([1]));
    const X = (i) => pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const Y = (v) => h - pad - (v / max) * (h - pad * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let i = 1; i <= 3; i++) { const y = (h / 4) * i; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }
    ctx.beginPath();
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v))));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    ctx.lineTo(X(data.length - 1), h - pad); ctx.lineTo(X(0), h - pad); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(0,255,136,0.22)"); g.addColorStop(1, "rgba(0,255,136,0)");
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(X(data.length - 1), Y(data[data.length - 1]), 3.2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  /* ---------------- AI intents (demo brain) ---------------- */
  const L = (t) => '<div class="cl">' + t + "</div>";
  const B = (t) => '<div class="cl b">· ' + t + "</div>";
  const N = (t, c) => '<span class="cnum' + (c ? " " + c : "") + '">' + t + "</span>";
  const S_ = (t) => '<div class="cs">' + t + "</div>";
  const D = (rows) => '<div class="decision">' + rows.map((r) => '<div class="row"><span class="k">' + r[0] + '</span><span>' + r[1] + "</span></div>").join("") + "</div>";

  function answer(q) {
    const t = sel.todayOrders(), rev = sel.todayRevenue(), prof = sel.todayProfit();
    const yesterday = sel.ordersOn(startOfDay() - DAY).reduce((a, o) => a + o.revenue, 0);
    const delta = yesterday > 0 ? ((rev - yesterday) / yesterday) * 100 : 0;

    if (/\b(reset|wipe|clear)\b.*\b(demo|data)\b|\breset\b/.test(q)) {
      return { act: "reset" };
    }
    if (/(restock|reorder|buy more)/.test(q)) {
      const target = sel.lowStock()[0] || sel.topProducts()[0].p;
      return { act: "restock", product: target };
    }
    if (/(mute|sound off|sound on)/.test(q)) {
      return { act: "mute" };
    }
    if (/(how much|revenue|sell|sold|sales).*(today|day)|\btoday\b.*(sell|sales|revenue)/.test(q) || (/(how much|revenue|sell|sold)/.test(q) && !/profit/.test(q))) {
      return {
        sound: "ding",
        html: S_("<i>▍</i>Sales — today") +
          L("You sold " + N(t.length + " laptop" + (t.length === 1 ? "" : "s")) + " today for " + N(ksh(rev)) + " revenue.") +
          L("Gross profit so far: " + N(ksh(prof)) + " · avg ticket " + N(ksh(t.length ? rev / t.length : 0)) + ".") +
          B("vs yesterday: " + N((delta >= 0 ? "+" : "") + delta.toFixed(0) + "%", delta >= 0 ? "" : "w") + " (" + ksh(yesterday) + " at this time).") +
          (t.length ? S_("<i>▍</i>Orders") + t.slice(0, 4).map((o) => B(o.id + " · " + esc(o.customer) + " · " + ksh(o.revenue) + " · " + o.source)).join("") : "") +
          D([["Observation", t.length ? "WooCommerce is your top source today." : "No orders yet today — traffic is live though."],
             ["Recommendation", t.length ? "Post a sold-out-style Story on the best seller to trigger urgency." : "Send a WhatsApp status + IG Story with today's best-priced unit."],
             ["Expected impact", t.length ? "+1–2 impulse sales (≈ " + ksh(35000) + ")" : "Historically wakes 1–2 sales by evening"],
             ["Confidence", "78%"]]),
      };
    }
    if (/profit|margin|earn/.test(q)) {
      const net = sel.monthProfit() - sel.monthExpenses();
      const margin = sel.monthRevenue() ? (sel.monthProfit() / sel.monthRevenue()) * 100 : 0;
      return {
        sound: "ding",
        html: S_("<i>▍</i>Profit — last 30 days") +
          L("Revenue " + N(ksh(sel.monthRevenue())) + " → gross profit " + N(ksh(sel.monthProfit())) + " (" + margin.toFixed(1) + "% margin).") +
          L("Expenses " + N(ksh(sel.monthExpenses()), "w") + " → net profit " + N(ksh(net), net >= 0 ? "" : "d") + ".") +
          L("Today alone: " + N(ksh(prof)) + " from " + t.length + " sale" + (t.length === 1 ? "" : "s") + ".") +
          D([["Observation", "Marketing is 38% of expenses but drives ~60% of attributed sales."],
             ["Recommendation", "Realloc 30% of Meta budget to TikTok Spark Ads (2.4× better ROAS in your data)."],
             ["Expected impact", "+" + ksh(sel.monthProfit() * 0.08) + "/month at same spend"],
             ["Confidence", "82%"]]),
      };
    }
    if (/(best|top|most).*(laptop|product|profit)|which.*(made|makes).*(profit|money)/.test(q)) {
      const top = sel.topProducts()[0], second = sel.topProducts()[1];
      const margin = top.p.price ? ((top.p.price - top.p.cost) / top.p.price) * 100 : 0;
      return {
        sound: "ding",
        html: S_("<i>▍</i>Top performer — 30 days") +
          L(N(esc(top.p.name)) + " is your #1 earner: " + top.units + " units → " + N(ksh(top.profit)) + " profit (" + margin.toFixed(0) + "% margin).") +
          L("Runner-up: " + esc(second.p.name) + " at " + ksh(second.profit) + ".") +
          D([["Observation", esc(top.p.name) + " converts at " + top.p.conv + "% — above store average."],
             ["Recommendation", "Shift 30% of Meta budget toward it and feature it in your next TikTok video."],
             ["Expected impact", "+" + ksh(top.profit * 2) + "–" + ksh(top.profit * 3) + " per month at current traffic"],
             ["Confidence", "87%"]]),
      };
    }
    if (/(new order|do i have.*order|\borders\b)/.test(q)) {
      return {
        sound: "ding",
        html: S_("<i>▍</i>Orders") +
          L(N(t.length) + " new order" + (t.length === 1 ? "" : "s") + " today · " + N(ksh(rev)) + " · " + N(ksh(prof)) + " profit.") +
          (t.length ? t.slice(0, 5).map((o) => B(o.id + " · " + esc(o.customer) + " · " + ksh(o.revenue) + " · <b>" + o.status + "</b> · " + o.source)).join("") : B("Nothing yet — the live simulator drops one every ~18s, or use the Webhook Simulator.")) +
          D([["Recommendation", "Confirm M-Pesa receipts within 15 min — same-day confirmation lifts repeat rate ~2×."], ["Confidence", "90%"]]),
      };
    }
    if (/attention|priorit|focus|need.*today/.test(q)) {
      const low = sel.lowStock();
      const hot = S.leads.find((l) => l.stage === "lead" || l.stage === "proposal");
      const dead = S.campaigns.find((c) => c.conversions === 0 && c.active);
      return {
        sound: "ding",
        html: S_("<i>▍</i>Needs your attention") +
          (low.length ? L("1. " + N("Restock", "w") + " " + low.map((p) => esc(p.name) + " (" + p.stock + " left)").join(", ") + ' — say "restock".') : "") +
          (dead ? L((low.length ? 2 : 1) + ". " + N("Pause", "w") + ' "' + esc(dead.name) + '" — ' + ksh(dead.spend) + " spent, 0 conversions.") : "") +
          (hot ? L((low.length ? 3 : dead ? 3 : 1) + ". " + N("Reply", "w") + " to " + esc(hot.name) + " (" + ksh(hot.value) + ", " + hot.stage + ").") : "") +
          L((low.length ? 4 : 2) + ". " + N("Post", "") + " one TikTok of today's best seller — your fastest-converting channel.") +
          D([["Why this order", "Sorted by money-at-risk × time-sensitivity."], ["Confidence", "85%"]]),
      };
    }
    if (/instagram|insta|\btiktok\b|social/.test(q)) {
      const ig = S.social.instagram, tk = S.social.tiktok;
      return {
        sound: "ding",
        html: S_("<i>▍</i>Social analysis") +
          L("Instagram: " + N(num(ig.followers)) + " followers (" + N("+" + ig.growth7d) + " this week) · engagement " + ig.engRate + "%.") +
          L("TikTok: " + N(num(tk.followers)) + " followers (" + N("+" + tk.growth7d) + ") · engagement " + tk.engRate + "% — " + N("2.9× better") + " conversion than Meta.") +
          D([["Observation", "Your T480 review video outperforms every Meta creative on cost-per-lead."],
             ["Recommendation", "Double TikTok posting to 3×/week; recycle IG content as carousels only."],
             ["Expected impact", "+" + num(Math.round(tk.growth7d * 1.6)) + " followers/week, ~" + ksh(18000) + " attributed revenue"],
             ["Confidence", "80%"]]),
      };
    }
    if (/traffic|website|analytics|ga4|funnel|conversion rate/.test(q)) {
      const views = S.products.reduce((a, p) => a + p.views, 0);
      const carts = Math.round(views * 0.061);
      return {
        sound: "ding",
        html: S_("<i>▍</i>Website analytics (GA4 demo)") +
          L("Product views (30d): " + N(num(views)) + " · cart adds " + num(carts) + " (6.1%) → checkouts " + num(Math.round(carts * 0.42)) + " → purchases " + S.orders.length + ".") +
          D([["Anomaly", "Checkout → purchase is your leakiest step (58% drop)."],
             ["Recommendation", "Add M-Pesa STK push at checkout + a 48h cart-recovery WhatsApp message."],
             ["Expected impact", "+8–12% completed purchases without extra ad spend"],
             ["Confidence", "84%"]]),
      };
    }
    if (/opportunit|find.*money|grow|scale/.test(q)) {
      const low = sel.lowStock(), top = sel.topProducts()[0];
      const dead = S.campaigns.find((c) => c.conversions === 0 && c.active);
      const hot = S.leads.find((l) => l.stage !== "won" && l.stage !== "lost");
      return {
        sound: "ding",
        html: S_("<i>▍</i>Opportunity scan — OBSERVE → RECOMMEND") +
          (low.length ? L('1. ' + N("Reorder") + " " + low.map((p) => esc(p.name)).join(", ") + " — stockout risk ≈ " + N(ksh(low.reduce((a, p) => a + (p.price - p.cost) * p.velocity, 0)), "w") + '/week. Say "restock".') : "") +
          L((low.length ? 2 : 1) + ". " + N("Scale") + " " + esc(top.p.name) + ": best margin × best conversion. Move " + N(ksh(2000)) + " of budget → est. " + N("+" + ksh(top.profit * 2)) + "/mo.") +
          (dead ? L((low.length ? 3 : 2) + ". " + N("Kill or rework") + ' "' + esc(dead.name) + '" — ' + ksh(dead.spend) + " spent, zero conversions.") : "") +
          (hot ? L((low.length ? 4 : 3) + ". " + N("Close") + " " + esc(hot.name) + " (" + ksh(hot.value) + ") — same-day follow-up lifts win rate ~2×.") : "") +
          D([["How I ranked these", "Expected value × confidence ÷ effort. Reorder wins: guaranteed margin, zero new traffic needed."], ["Confidence", "88% across 4 signals (stock, ads, CRM, GA4)"]]),
      };
    }
    if (/teach|learn|lesson|how.*(connect|use).*(wordpress|woo|zapier|n8n)/.test(q)) {
      return {
        sound: "ding",
        html: S_("<i>▍</i>AI Tutor — connecting WordPress to NEXUS//OS") +
          L('Here is the exact path (all free). In production the AI walks you through it step-by-step; this demo shows the full checklist:') +
          B("1. In WordPress: Users → Add application password (this is your API key).") +
          B("2. WooCommerce → Settings → Advanced → REST API → Add key (Read/Write).") +
          B("3. Copy the Consumer Key + Secret into <b>.env</b> as WOOCOMMERCE_KEY / WOOCOMMERCE_SECRET.") +
          B("4. WooCommerce → Settings → Advanced → Webhooks → add <b>order.created</b> pointing to your server: <span class='mono'>https://yourdomain/api/webhooks/woo</span>.") +
          B("5. On your Express server, verify the HMAC signature, then let the Orchestrator route it: DB → notify → analytics.") +
          B("6. Free tunnel while developing: <span class='mono'>ngrok http 3000</span> gives you a public URL instantly.") +
          D([["Money angle", "This exact setup is a KSh 15–40k freelance gig: 'WooCommerce → WhatsApp/Telegram order alerts'."],
             ["Next skill", "n8n self-hosted (free) → sell automation retainers at KSh 10–25k/month per client."],
             ["Confidence", "This is the production plan in the Blueprint tab of the full build."]]),
      };
    }
    if (/report|summary|daily/.test(q)) {
      const net = sel.todayProfit();
      return {
        sound: "ding",
        html: S_("<i>▍</i>Daily report — " + new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })) +
          L("Sales: " + N(t.length) + " orders · " + N(ksh(rev)) + " · profit " + N(ksh(net)) + ".") +
          L("Pipeline: " + N(ksh(S.leads.filter((l) => l.stage !== "won" && l.stage !== "lost").reduce((a, l) => a + l.value, 0))) + " open across " + S.leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length + " leads.") +
          L("Alerts: " + sel.lowStock().length + " low-stock item" + (sel.lowStock().length === 1 ? "" : "s") + " · " + sel.unread() + " unread notifications.") +
          D([["AI recommendation", 'Run "find opportunities" for the ranked action list.'], ["Confidence", "—"]]),
      };
    }
    if (/forecast|predict|next week|next 7/.test(q)) {
      const series = sel.revSeries();
      const avg = series.reduce((a, b) => a + b, 0) / series.length;
      return {
        sound: "ding",
        html: S_("<i>▍</i>7-day forecast") +
          L("Projected revenue: " + N(ksh(avg * 7 * 0.92)) + " – " + N(ksh(avg * 7 * 1.18)) + " (trend-based, demo model).") +
          D([["Method", "14-day moving average ± volatility band. Production uses per-SKU velocity."],
             ["Recommendation", "Secure " + (sel.lowStock()[0] ? esc(sel.lowStock()[0].name) + " stock first" : "stock") + " — it is your velocity leader."],
             ["Confidence", "74%"]]),
      };
    }
    if (/help|what can|commands|\bhi\b|hello/.test(q)) {
      return {
        sound: "ding",
        html: S_("<i>▍</i>Command console — what I understand") +
          L('Business: <span class="mono">"how much did I sell today"</span> · <span class="mono">"which laptop made the most profit"</span> · <span class="mono">"do I have new orders"</span>') +
          L('Strategy: <span class="mono">"find opportunities"</span> · <span class="mono">"show me what needs my attention today"</span> · <span class="mono">"forecast next 7 days"</span>') +
          L('Channels: <span class="mono">"analyze my Instagram"</span> · <span class="mono">"website analytics"</span> · <span class="mono">"daily report"</span>') +
          L('Actions (need your approval): <span class="mono">"restock ThinkPad T480"</span> · <span class="mono">"reset demo data"</span> · <span class="mono">"mute"</span>') +
          L('Learning: <span class="mono">"teach me how to connect WordPress"</span>') +
          D([["Guardrails", "Financial/destructive actions always open an approval modal first — I never act alone."]]),
      };
    }
    return {
      sound: "ding",
      html: S_("<i>▍</i>Not sure I caught that") +
        L('Try: <span class="mono">"how much did I sell today"</span>, <span class="mono">"find opportunities"</span>, <span class="mono">"analyze my instagram"</span> or <span class="mono">"help"</span>.') +
        D([["Note", "In production this routes to OpenAI function-calling over your live data. This demo uses a built-in intent engine so it runs offline."]]),
    };
  }

  /* ---------------- approval flow (RBAC: FINANCIAL) ---------------- */
  function restockFlow(product) {
    const qty = Math.max(5, product.velocity);
    const cost = qty * product.cost;
    addAudit("AI", "E-commerce", "Requested reorder " + product.name + " ×" + qty + " — awaiting approval", "FINANCIAL", "PENDING");
    modal({
      title: "Approval required — FINANCIAL action",
      confirmLabel: "Approve reorder",
      bodyHtml:
        '<div style="margin-bottom:10px"><span class="badge vio">SCOPE: FINANCIAL</span> <span class="badge warn">REQUIRES YOUR SIGN-OFF</span></div>' +
        '<div class="decision" style="margin-top:0">' +
        '<div class="row"><span class="k">Observation</span><span>' + esc(product.name) + " has " + product.stock + " left, selling " + product.velocity + "/week.</span></div>" +
        '<div class="row"><span class="k">Action</span><span>Reorder <b>' + qty + " units</b> at " + ksh(product.cost) + "/unit = <b>" + ksh(cost) + "</b> (demo — no real money moves).</span></div>" +
        '<div class="row"><span class="k">Expected</span><span>+' + ksh((product.price - product.cost) * qty) + " gross once sold (~" + Math.ceil(qty / product.velocity) + " weeks of cover).</span></div>" +
        "</div>" +
        '<p style="font-size:12.5px;color:var(--txt-2);margin:10px 0 0">The AI will only mark this order as placed after you approve. Every decision is written to the audit log.</p>',
    }, function (ok) {
      if (ok) {
        product.stock += qty;
        addAudit("YOU", "E-commerce", "Approved reorder " + product.name + " ×" + qty + " (" + ksh(cost) + ")", "FINANCIAL", "APPROVED");
        addAudit("AI", "E-commerce", "Purchase order drafted to supplier (demo)", "WRITE", "EXECUTED");
        addNotice("system", "✅ Reorder approved — " + product.name + " ×" + qty + ". Supplier PO drafted (demo).");
        toast("Reorder approved — " + esc(product.name) + " ×" + qty + " · " + ksh(cost) + " (demo, no real payment).", "ok");
        Sound.approve();
      } else {
        addAudit("YOU", "E-commerce", "Denied reorder " + product.name + " ×" + qty, "FINANCIAL", "DENIED");
        toast("Action denied — logged to audit trail.", "info");
      }
      save(); emit("settings");
    });
  }

  /* ---------------- shell + views ---------------- */
  let route = "command";
  const mainRef = { el: null };
  const NAV = [
    { sec: "Operate" },
    { id: "command", label: "Command Center", icon: "pulse" },
    { id: "inventory", label: "Inventory", icon: "box" },
    { id: "orders", label: "Orders", icon: "cart" },
    { id: "finance", label: "Finance", icon: "coins" },
    { id: "freelance", label: "Freelance CRM", icon: "brief" },
    { sec: "System" },
    { id: "automations", label: "Automations", icon: "zap" },
  ];

  function buildShell() {
    const root = document.getElementById("root");
    root.innerHTML =
      '<div class="os-root" style="display:flex">' +
      '<aside id="sidebar" style="width:236px;flex:none;border-right:1px solid var(--line);min-height:100vh;background:rgba(18,18,18,0.9)">' +
      '<div style="padding:20px 16px 12px;display:flex;align-items:center;gap:10px">' +
      '<span style="color:var(--acc);display:grid;place-items:center">' + icon("hex", 26) + "</span>" +
      '<div><div class="font-display" style="font-weight:700;font-size:16px;letter-spacing:0.06em">NEXUS<span style="color:var(--acc)">//</span>OS</div>' +
      '<div class="mono" style="font-size:9px;letter-spacing:0.18em;color:var(--txt-3)">PERSONAL BUSINESS AI</div></div></div>' +
      '<nav id="nav"></nav>' +
      '<div style="padding:14px;border-top:1px solid var(--line);margin-top:12px">' +
      '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--txt-2)"><span class="live-dot" id="simDot"></span><span id="simLabel">LIVE SIMULATOR ON</span></div>' +
      '<div class="mono" style="font-size:9.5px;color:var(--txt-3);margin-top:6px;letter-spacing:0.1em">DEMO MODE · FICTIONAL DATA</div>' +
      "</div></aside>" +
      '<div style="flex:1;min-width:0">' +
      '<header id="topbar" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(18,18,18,0.88);backdrop-filter:blur(8px);z-index:40">' +
      '<button class="btn btn-sm hamb" id="menuBtn">' + icon("menu", 15) + "</button>" +
      '<div style="display:flex;align-items:center;gap:8px"><span class="live-dot" id="wsDot"></span><span class="mono" id="wsLabel" style="font-size:10.5px;letter-spacing:0.14em;color:var(--txt-2)">SOCKET · CONNECTED</span></div>' +
      '<div class="font-display" id="crumb" style="font-weight:600;font-size:14px;letter-spacing:0.05em"></div>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:9px">' +
      '<span class="mono" id="clock" style="font-size:12px;color:var(--txt-2)"></span>' +
      '<button class="btn btn-sm" id="muteBtn" title="Toggle sound (M)"></button>' +
      '<button class="btn btn-sm bell-btn" id="bellBtn" title="Notifications">' + icon("bell", 15) + '<span class="bell-count" id="bellCount" style="display:none">0</span></button>' +
      "</div></header>" +
      '<main id="main" style="padding:20px;max-width:1240px;margin:0 auto;width:100%"></main>' +
      "</div></div>";
    mainRef.el = document.getElementById("main");

    const nav = document.getElementById("nav");
    NAV.forEach((n) => {
      if (n.sec) { const d = document.createElement("div"); d.className = "nav-sec"; d.textContent = n.sec; nav.appendChild(d); return; }
      const b = document.createElement("button");
      b.className = "nav-item" + (n.id === route ? " active" : "");
      b.dataset.route = n.id;
      b.innerHTML = icon(n.icon, 16) + "<span>" + n.label + "</span>";
      b.addEventListener("click", () => setRoute(n.id));
      nav.appendChild(b);
    });

    document.getElementById("menuBtn").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
    document.getElementById("muteBtn").addEventListener("click", toggleMute);
    document.getElementById("bellBtn").addEventListener("click", openBell);
    paintMute();
    updateBell();

    const tick = () => {
      const d = new Date();
      document.getElementById("clock").textContent =
        d.toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) + " · " +
        d.toLocaleTimeString("en-KE", { hour12: false });
    };
    tick(); setInterval(tick, 1000);
    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") { const tag = (e.target.tagName || "").toLowerCase(); if (tag !== "input" && tag !== "textarea") toggleMute(); }
      if (e.key === "/") { const tag = (e.target.tagName || "").toLowerCase(); if (tag !== "input" && tag !== "textarea") { e.preventDefault(); const inp = document.getElementById("cmdInput"); if (inp) inp.focus(); } }
    });
    window.addEventListener("pointerdown", () => Sound.unlock(), { once: true });
  }

  function setRoute(id) {
    route = id;
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.route === id));
    document.getElementById("sidebar").classList.remove("open");
    const item = NAV.find((n) => n.id === id);
    document.getElementById("crumb").textContent = item ? item.label.toUpperCase() : "";
    render();
  }

  function toggleMute() {
    S.settings.sound = !S.settings.sound;
    Sound.muted = !S.settings.sound;
    save(); paintMute();
    toast(S.settings.sound ? "Sound on" : "Muted", "info");
    if (S.settings.sound) Sound.ding();
  }
  function paintMute() {
    const b = document.getElementById("muteBtn");
    b.innerHTML = icon(S.settings.sound ? "sndOn" : "sndOff", 15);
  }
  function updateBell() {
    const el = document.getElementById("bellCount");
    if (!el) return;
    const u = sel.unread();
    el.style.display = u ? "grid" : "none";
    el.textContent = u > 9 ? "9+" : u;
  }
  function openBell() {
    const rows = S.notices.slice(0, 14).map((n) =>
      '<div class="feed-row"><span style="color:var(--txt-3)" class="mono">' + hhmm(n.at) + '</span><span style="flex:1">' + esc(n.text) + "</span>" +
      (n.read ? "" : '<span class="badge ok" style="align-self:center">NEW</span>') + "</div>"
    ).join("") || '<p style="color:var(--txt-3)">No notifications yet.</p>';
    modal({
      title: "Notifications (Telegram / push preview)",
      confirmLabel: "Mark all read",
      cancelLabel: "Close",
      bodyHtml: '<div style="max-height:50vh;overflow:auto">' + rows + "</div>",
    }, function (ok) {
      if (ok) { S.notices.forEach((n) => (n.read = true)); save(); updateBell(); Sound.ding(); }
    });
  }

  /* ---- view: command center ---- */
  function viewCommand() {
    const wrap = document.createElement("div");
    wrap.innerHTML =
      '<div class="chip-row reveal" style="margin-bottom:14px">' +
      '<span class="badge ok">AI BRAIN · ONLINE</span><span class="badge info">DEMO INTENT ENGINE</span><span class="badge mut">RBAC: READ·WRITE·FINANCIAL·ADMIN</span>' +
      '<span class="badge mut" style="margin-left:auto">OBSERVE → ANALYZE → RECOMMEND → ASK → EXECUTE → RECORD</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" class="reveal d1" id="kpiRow">' +
      kpiHtml("Today revenue", "kRev") + kpiHtml("Today profit", "kProf") + kpiHtml("Orders today", "kOrd") + kpiHtml("Net · 30 days", "kNet") +
      "</div>" +
      '<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-top:12px" class="reveal d2">' +
      '<div class="panel"><div class="panel-h"><span class="t">Revenue · last 14 days</span><span class="badge mut" style="margin-left:auto">GA4 + WOO</span></div>' +
      '<div class="panel-b"><canvas id="revChart" style="width:100%;height:150px;display:block"></canvas></div></div>' +
      '<div class="panel"><div class="panel-h"><span class="t">Live feed</span><span class="live-dot" style="margin-left:auto"></span></div>' +
      '<div class="panel-b" id="liveFeed" style="max-height:182px;overflow:auto"></div></div>' +
      "</div>" +
      '<div class="panel reveal d3" style="margin-top:12px"><div class="panel-h"><span class="t">Command console</span>' +
      '<span class="mono" style="margin-left:auto;font-size:10px;color:var(--txt-3)">PRESS / TO FOCUS</span></div>' +
      '<div class="panel-b"><div id="chatLog" style="max-height:380px;overflow:auto;margin-bottom:12px"></div>' +
      '<div class="chip-row" id="chips" style="margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:10px"><input id="cmdInput" placeholder="Ask: how much did I sell today?" style="flex:1" autocomplete="off" />' +
      '<button class="btn btn-acc" id="cmdSend">' + icon("send", 14) + " SEND</button></div></div></div>";

    const CHIPS = ["How much did I sell today?", "Which laptop made the most profit?", "Find opportunities", "Analyze my Instagram", "What needs my attention?", "Teach me how to connect WordPress", "Restock ThinkPad T480", "Daily report"];
    const chips = wrap.querySelector("#chips");
    CHIPS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = c;
      b.addEventListener("click", () => { wrap.querySelector("#cmdInput").value = c; send(c); });
      chips.appendChild(b);
    });

    const log = wrap.querySelector("#chatLog");
    function bubble(role, html) {
      const m = document.createElement("div");
      m.className = "msg " + role;
      m.innerHTML = '<div class="ava">' + icon(role === "user" ? "cpu" : "hex", 15) + '</div><div class="bubble">' + html + "</div>";
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
      return m;
    }
    bubble("ai", S_("<i>▍</i>NEXUS//OS online") +
      L("I am watching your store, inventory, ads and leads. " + sel.todayOrders().length + " order" + (sel.todayOrders().length === 1 ? "" : "s") + " today · " + ksh(sel.todayRevenue()) + " revenue.") +
      L('Ask me anything below — or tap a quick command. Financial actions always need your approval first.'));

    function send(raw) {
      const q = raw.trim();
      if (!q) return;
      wrap.querySelector("#cmdInput").value = "";
      bubble("user", esc(q));
      addAudit("YOU", "AI Brain", 'Command: "' + q.slice(0, 80) + '"', "READ", "LOGGED");
      const typing = bubble("ai", '<span class="typing"><span></span><span></span><span></span></span>');
      setTimeout(function () {
        const res = answer(q);
        if (res.act === "reset") {
          typing.querySelector(".bubble").innerHTML = S_("<i>▍</i>Reset demo data?") + L("This wipes local demo changes and reseeds the fictional dataset.");
          modal({ title: "Reset demo data?", confirmLabel: "Reset", tone: "danger", bodyHtml: "<p>All demo changes in this browser will be wiped and reseeded. No real data is affected (there is none).</p>" }, function (ok) {
            if (ok) { localStorage.removeItem(STORAGE_KEY); location.reload(); }
          });
          return;
        }
        if (res.act === "mute") { toggleMute(); typing.querySelector(".bubble").innerHTML = S_("<i>▍</i>Sound") + L(S.settings.sound ? "Sound is now ON." : "Muted. Press M or the speaker icon to unmute."); return; }
        if (res.act === "restock") {
          typing.querySelector(".bubble").innerHTML = S_("<i>▍</i>Financial action detected") + L('This costs money, so it needs your sign-off. Opening approval modal for <b>' + esc(res.product.name) + "</b>…");
          restockFlow(res.product);
          return;
        }
        typing.querySelector(".bubble").innerHTML = res.html;
        log.scrollTop = log.scrollHeight;
        if (res.sound === "ding") Sound.ding();
      }, 480 + Math.random() * 320);
    }
    wrap.querySelector("#cmdSend").addEventListener("click", () => send(wrap.querySelector("#cmdInput").value));
    wrap.querySelector("#cmdInput").addEventListener("keydown", (e) => { if (e.key === "Enter") send(wrap.querySelector("#cmdInput").value); });

    const paint = () => {
      countUp(wrap.querySelector("#kRev"), sel.todayRevenue(), ksh);
      countUp(wrap.querySelector("#kProf"), sel.todayProfit(), ksh);
      countUp(wrap.querySelector("#kOrd"), sel.todayOrders().length, (n) => String(Math.round(n)));
      countUp(wrap.querySelector("#kNet"), sel.monthProfit() - sel.monthExpenses(), ksh);
      const cv = wrap.querySelector("#revChart");
      if (cv && cv.clientWidth) areaChart(cv, sel.revSeries(), "#00ff88");
      const feed = wrap.querySelector("#liveFeed");
      const items = S.feed.length ? S.feed : S.orders.slice(0, 5).map((o) => ({ at: o.at, icon: "cart", color: "var(--acc)", text: o.id + " · " + ksh(o.revenue) + " · " + (sel.productById(o.productId) || {}).name + " · " + o.source }));
      feed.innerHTML = items.map((f) => '<div class="feed-row"><span style="color:' + f.color + '">' + icon(f.icon, 14) + '</span><span style="flex:1">' + esc(f.text) + '</span><span class="mono" style="color:var(--txt-3)">' + timeAgo(f.at) + "</span></div>").join("");
      wrap.querySelectorAll(".kpi").forEach((k) => { k.classList.remove("bump"); void k.offsetWidth; k.classList.add("bump"); });
    };
    paint();
    const off = on((kind) => { if (kind === "order" || kind === "tick" || kind === "settings") requestAnimationFrame(paint); });
    return { el: wrap, destroy: off };
  }
  function kpiHtml(label, id) {
    return '<div class="panel kpi"><div class="kpi-label">' + label + '</div><div class="kpi-val" id="' + id + '">0</div></div>';
  }

  /* ---- view: inventory ---- */
  function viewInventory() {
    const wrap = document.createElement("div");
    const paint = () => {
      const units = S.products.reduce((a, p) => a + p.stock, 0);
      const value = S.products.reduce((a, p) => a + p.stock * p.cost, 0);
      wrap.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px" class="reveal">' +
        kpiPanel("Units in stock", num(units)) + kpiPanel("Stock value (cost)", ksh(value)) + kpiPanel("Low-stock alerts", String(sel.lowStock().length), sel.lowStock().length ? "warn" : "ok") +
        "</div>" +
        '<div class="panel reveal d1"><div class="panel-h"><span class="t">Products · WooCommerce sync</span><span class="badge ok" style="margin-left:auto">SYNCED 1m AGO</span></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Cost</th><th>Price</th><th>Margin</th><th>Stock</th><th>Velocity</th><th>Conv.</th><th></th></tr></thead><tbody>' +
        S.products.map((p) => {
          const margin = ((p.price - p.cost) / p.price) * 100;
          const low = p.stock <= 2;
          return "<tr><td><div style='font-weight:600'>" + esc(p.name) + "</div><div class='mono' style='font-size:10.5px;color:var(--txt-3)'>" + esc(p.spec) + "</div></td>" +
            "<td class='num'>" + ksh(p.cost) + "</td><td class='num' style='color:var(--acc)'>" + ksh(p.price) + "</td>" +
            "<td class='num'>" + margin.toFixed(1) + "%</td>" +
            "<td>" + (low ? "<span class='badge danger'>" + p.stock + " LEFT</span>" : "<span class='badge ok'>" + p.stock + "</span>") + "</td>" +
            "<td class='num'>" + p.velocity + "/wk</td><td class='num'>" + p.conv + "%</td>" +
            "<td><button class='btn btn-sm' data-restock='" + p.id + "'>" + icon("refresh", 12) + " RESTOCK</button></td></tr>";
        }).join("") +
        "</tbody></table></div></div>";
      wrap.querySelectorAll("[data-restock]").forEach((b) =>
        b.addEventListener("click", () => restockFlow(sel.productById(b.dataset.restock)))
      );
    };
    paint();
    const off = on((k) => { if (k === "order" || k === "settings") paint(); });
    return { el: wrap, destroy: off };
  }
  function kpiPanel(label, val, tone) {
    return '<div class="panel kpi"><div class="kpi-label">' + label + '</div><div class="kpi-val" style="' + (tone === "warn" ? "color:var(--warn)" : "") + '">' + val + "</div></div>";
  }

  /* ---- view: orders ---- */
  function viewOrders() {
    const wrap = document.createElement("div");
    const statusBadge = (st) => ({ paid: "ok", processing: "info", shipped: "vio", delivered: "mut" })[st] || "mut";
    const paint = () => {
      wrap.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px" class="reveal">' +
        kpiPanel("Orders today", String(sel.todayOrders().length)) + kpiPanel("Revenue today", ksh(sel.todayRevenue())) + kpiPanel("Profit today", ksh(sel.todayProfit())) +
        "</div>" +
        '<div class="panel reveal d1"><div class="panel-h"><span class="t">Orders · live webhook stream</span><span class="badge ok" style="margin-left:auto">WOOCOMMERCE · order.created</span></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Time</th><th>Customer</th><th>Product</th><th>Revenue</th><th>Profit</th><th>Status</th><th>Source</th></tr></thead><tbody>' +
        S.orders.slice(0, 18).map((o) => {
          const p = sel.productById(o.productId) || { name: "—" };
          return "<tr><td class='num' style='color:var(--acc)'>" + o.id + "</td><td class='mono' style='font-size:11px;color:var(--txt-2)'>" + timeAgo(o.at) + "</td>" +
            "<td>" + esc(o.customer) + "</td><td>" + esc(p.name) + "</td>" +
            "<td class='num'>" + ksh(o.revenue) + "</td><td class='num' style='color:var(--acc)'>+" + ksh(o.profit) + "</td>" +
            "<td><span class='badge " + statusBadge(o.status) + "'>" + o.status + "</span></td><td style='color:var(--txt-2)'>" + o.source + "</td></tr>";
        }).join("") +
        "</tbody></table></div></div>" +
        '<p class="mono" style="font-size:10.5px;color:var(--txt-3);margin-top:10px">DEMO: orders are simulated locally. In production these stream from WooCommerce webhooks over Socket.io — zero polling.</p>';
    };
    paint();
    const off = on((k) => { if (k === "order") paint(); });
    return { el: wrap, destroy: off };
  }

  /* ---- view: finance ---- */
  function viewFinance() {
    const wrap = document.createElement("div");
    const net = sel.monthProfit() - sel.monthExpenses();
    const margin = sel.monthRevenue() ? (sel.monthProfit() / sel.monthRevenue()) * 100 : 0;
    wrap.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px" class="reveal">' +
      kpiPanel("Revenue · 30d", ksh(sel.monthRevenue())) + kpiPanel("Gross profit", ksh(sel.monthProfit()) + " · " + margin.toFixed(0) + "%") +
      kpiPanel("Expenses · 30d", ksh(sel.monthExpenses())) +
      '<div class="panel kpi"><div class="kpi-label">Net profit · 30d</div><div class="kpi-val" style="color:' + (net >= 0 ? "var(--acc)" : "var(--danger)") + '">' + ksh(net) + "</div></div>" +
      "</div>" +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="reveal d1">' +
      '<div class="panel"><div class="panel-h"><span class="t">Expenses</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Item</th><th>Category</th><th>Amount</th></tr></thead><tbody>' +
      S.expenses.map((e) => "<tr><td>" + esc(e.label) + (e.recurring ? ' <span class="badge mut" style="margin-left:6px">MONTHLY</span>' : "") + "</td><td style='color:var(--txt-2)'>" + e.category + "</td><td class='num' style='color:var(--warn)'>" + ksh(e.amount) + "</td></tr>").join("") +
      "</tbody></table></div></div>" +
      '<div class="panel"><div class="panel-h"><span class="t">Marketing performance</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campaign</th><th>Spend</th><th>ROAS</th></tr></thead><tbody>' +
      S.campaigns.map((c) => {
        const roas = c.spend ? c.revenue / c.spend : 0;
        const tone = roas >= 2 ? "ok" : roas > 0 ? "warn" : "danger";
        return "<tr><td>" + esc(c.name) + "<div class='mono' style='font-size:10px;color:var(--txt-3)'>" + c.platform + " · " + c.conversions + " conversions</div></td>" +
          "<td class='num'>" + ksh(c.spend) + "</td><td><span class='badge " + tone + "'>" + roas.toFixed(1) + "×</span></td></tr>";
      }).join("") +
      "</tbody></table></div>" +
      '<div class="panel-b" style="border-top:1px solid var(--line)"><div class="decision" style="margin:0"><div class="row"><span class="k">AI verdict</span><span>"IG Story boost — XPS 13" has ROAS 0.0. Pause it, move budget to TikTok Spark Ads (26× ROAS in your data).</span></div></div></div></div>' +
      "</div>";
    return { el: wrap, destroy: function () {} };
  }

  /* ---- view: freelance ---- */
  function viewFreelance() {
    const wrap = document.createElement("div");
    const open = S.leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const won = S.leads.filter((l) => l.stage === "won");
    const stageBadge = (st) => ({ lead: "info", contacted: "mut", proposal: "warn", negotiation: "vio", won: "ok", lost: "danger" })[st] || "mut";
    wrap.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px" class="reveal">' +
      kpiPanel("Open pipeline", ksh(open.reduce((a, l) => a + l.value, 0))) + kpiPanel("Active leads", String(open.length)) + kpiPanel("Won (demo)", ksh(won.reduce((a, l) => a + l.value, 0))) +
      "</div>" +
      '<div class="panel reveal d1"><div class="panel-h"><span class="t">Leads · Fluent Forms + IG DMs captured</span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Lead</th><th>Service</th><th>Value</th><th>Stage</th><th>Deadline</th><th></th></tr></thead><tbody>' +
      S.leads.map((l) => "<tr><td><div style='font-weight:600'>" + esc(l.name) + "</div><div style='font-size:11.5px;color:var(--txt-3)'>" + esc(l.note) + "</div></td>" +
        "<td style='color:var(--txt-2)'>" + esc(l.service) + "</td><td class='num' style='color:var(--acc)'>" + ksh(l.value) + "</td>" +
        "<td><span class='badge " + stageBadge(l.stage) + "'>" + l.stage + "</span></td>" +
        "<td class='mono' style='font-size:11px;color:" + (l.deadline < Date.now() && l.stage !== "won" ? "var(--danger)" : "var(--txt-2)") + "'>" + (l.deadline < Date.now() ? "passed" : "in " + Math.ceil((l.deadline - Date.now()) / DAY) + "d") + "</td>" +
        "<td><button class='btn btn-sm' data-proposal='" + l.id + "'>" + icon("send", 12) + " DRAFT PROPOSAL</button></td></tr>").join("") +
      "</tbody></table></div></div>";
    wrap.querySelectorAll("[data-proposal]").forEach((b) =>
      b.addEventListener("click", () => {
        const l = S.leads.find((x) => x.id === b.dataset.proposal);
        addAudit("AI", "Freelance", "Drafted proposal for " + l.name, "WRITE", "EXECUTED");
        Sound.ding();
        modal({
          title: "AI-drafted proposal — " + esc(l.name),
          confirmLabel: "Looks good",
          cancelLabel: "Close",
          bodyHtml:
            '<div style="border:1px solid var(--line-2);border-radius:8px;padding:14px;font-size:13px;line-height:1.7;background:#141416">' +
            "<b>Hi " + esc(l.name.split("—")[0].trim()) + ",</b><br><br>" +
            "Thanks for reaching out about <b>" + esc(l.service) + "</b>. Based on what you described, here is what I propose:<br><br>" +
            "· <b>Scope:</b> " + esc(l.service) + ", mobile-first, launched in 10–14 days.<br>" +
            "· <b>Investment:</b> " + ksh(l.value) + " (50% upfront, 50% at launch).<br>" +
            "· <b>Includes:</b> WhatsApp order alerts, basic SEO, and 2 weeks of free fixes.<br>" +
            "· <b>Bonus:</b> I will set up a simple analytics dashboard so you can see exactly what the site earns you.<br><br>" +
            "I can start this week. Does " + new Date(Date.now() + 2 * DAY).toLocaleDateString("en-KE", { weekday: "long" }) + " work for a 15-minute call?<br><br>" +
            "— Your name</div>" +
            '<p class="mono" style="font-size:10.5px;color:var(--txt-3);margin:10px 0 0">DEMO draft · production version uses OpenAI + your past winning proposals as context.</p>',
        }, function (ok) { if (ok) toast("Proposal saved to drafts (demo).", "ok"); });
      })
    );
    return { el: wrap, destroy: function () {} };
  }

  /* ---- view: automations ---- */
  function viewAutomations() {
    const wrap = document.createElement("div");
    const paint = () => {
      wrap.innerHTML =
        '<div class="panel reveal" style="margin-bottom:12px"><div class="panel-h"><span class="t">Webhook simulator — test the whole loop</span>' +
        '<span class="badge vio" style="margin-left:auto">ZAPIER / N8N PREVIEW</span></div>' +
        '<div class="panel-b"><div class="chip-row">' +
        '<button class="btn btn-acc btn-sm" id="simOrder">' + icon("cart", 13) + " SIMULATE NEW ORDER</button>" +
        '<button class="btn btn-sm" id="simLow">' + icon("warn", 13) + " LOW-STOCK ALERT</button>" +
        '<button class="btn btn-sm" id="simSpike">' + icon("chart", 13) + " IG FOLLOWER SPIKE</button>" +
        '<button class="btn btn-sm" id="simFail">' + icon("x", 13) + " META API FAILURE</button>" +
        '<button class="btn btn-sm" id="simReport">' + icon("radio", 13) + " RUN DAILY REPORT</button>" +
        '<button class="btn btn-sm btn-danger" id="simReset">' + icon("refresh", 13) + " RESET DEMO DATA</button>" +
        "</div>" +
        '<p class="mono" style="font-size:10.5px;color:var(--txt-3);margin:12px 0 0">Each button fires the exact production path: webhook → AI parse → DB write → notify → audit. Sound on: you will hear every event.</p>' +
        "</div></div>" +
        '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px" class="reveal d1">' +
        '<div class="panel"><div class="panel-h"><span class="t">Workflows</span><span class="badge ok" style="margin-left:auto">' + S.workflows.filter((w) => w.enabled).length + " ACTIVE</span></div>" +
        '<div class="panel-b" style="padding:8px 16px">' +
        S.workflows.map((w) =>
          '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,0.06)">' +
          '<div class="toggle' + (w.enabled ? " on" : "") + '" data-wf="' + w.id + '"></div>' +
          '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13.5px">' + esc(w.name) + '</div><div class="mono" style="font-size:10px;color:var(--txt-3)">' + esc(w.trigger) + " · " + w.runs + ' runs</div>' +
          '<div style="font-size:11px;color:var(--txt-2);margin-top:2px">' + w.steps.map(esc).join(" → ") + "</div></div></div>"
        ).join("") +
        "</div></div>" +
        '<div style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="panel"><div class="panel-h"><span class="t">Integrations</span></div><div class="panel-b" style="padding:10px 16px">' +
        S.integrations.map((i) =>
          '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed rgba(255,255,255,0.06)">' +
          '<span class="live-dot' + (i.status === "connected" ? "" : i.status === "error" ? " err" : " paused") + '"></span>' +
          '<span style="flex:1;font-size:13px">' + esc(i.name) + "</span>" +
          '<span class="badge ' + (i.status === "connected" ? "ok" : i.status === "error" ? "danger" : "mut") + '">' + i.status + "</span></div>"
        ).join("") +
        "</div></div>" +
        '<div class="panel" style="flex:1"><div class="panel-h"><span class="t">Audit trail</span><span class="badge mut" style="margin-left:auto">EVERY AI DECISION</span></div>' +
        '<div class="panel-b" style="padding:6px 16px;max-height:230px;overflow:auto">' +
        S.audit.slice(0, 10).map((a) =>
          '<div style="padding:7px 0;border-bottom:1px dashed rgba(255,255,255,0.06);font-size:12px">' +
          '<div style="display:flex;gap:8px;align-items:center"><span class="badge ' + (a.scope === "FINANCIAL" ? "warn" : a.scope === "ADMIN" ? "vio" : a.outcome === "DENIED" ? "danger" : "mut") + '">' + a.scope + "</span>" +
          '<span class="mono" style="font-size:9.5px;color:var(--txt-3)">' + a.actor + " · " + timeAgo(a.at) + "</span></div>" +
          '<div style="color:var(--txt-2);margin-top:3px">' + esc(a.action) + ' <span class="mono" style="font-size:9.5px;color:' + (a.outcome === "DENIED" ? "var(--danger)" : "var(--acc)") + '">[' + a.outcome + "]</span></div></div>"
        ).join("") +
        "</div></div></div></div>";

      wrap.querySelector("#simOrder").addEventListener("click", () => recordOrder());
      wrap.querySelector("#simLow").addEventListener("click", () => {
        const p = sel.lowStock()[0] || S.products[2];
        addNotice("alert", "⚠️ " + p.name + " low stock — " + p.stock + " left, velocity " + p.velocity + "/week. Reorder recommended.");
        addAudit("AI", "E-commerce", "Low-stock sentinel: " + p.name + " (" + p.stock + " left)", "READ", "LOGGED");
        pushFeed("warn", "var(--warn)", "Low stock · " + p.name + " · " + p.stock + " left");
        Sound.whoosh(); toast("⚠️ " + esc(p.name) + " low stock — reorder recommended.", "warn");
        save(); emit("settings");
      });
      wrap.querySelector("#simSpike").addEventListener("click", () => {
        const g = 80 + Math.floor(Math.random() * 220);
        S.social.instagram.followers += g; S.social.instagram.growth7d += g;
        S.social.instagram.reach.push(Math.round(S.social.instagram.reach[S.social.instagram.reach.length - 1] * 1.4));
        S.social.instagram.reach.shift();
        addNotice("social", "📈 Instagram spike: +" + g + " followers in the last hour (viral reel).");
        addAudit("AI", "Social", "Detected follower anomaly +" + g + "/h — pinned cause to reel posted 2h ago", "READ", "LOGGED");
        pushFeed("chart", "var(--info)", "Instagram +" + g + " followers (spike)");
        Sound.ding(); toast("📈 Instagram spike: +" + g + " followers — reply to new DMs fast!", "info");
        save(); emit("social");
      });
      wrap.querySelector("#simFail").addEventListener("click", () => {
        const ig = S.integrations.find((i) => i.id === "meta");
        ig.status = "error";
        addAudit("SYSTEM", "Integrations", "Meta Graph API 503 — circuit breaker OPEN, falling back to cache", "READ", "DEGRADED");
        pushFeed("warn", "var(--danger)", "Meta Graph API down · serving cached data");
        Sound.err(); toast("Meta Graph API failed — system degraded to cached data (no crash). Retry from this panel.", "danger");
        save(); paint();
        setTimeout(() => {
          ig.status = "connected";
          addAudit("SYSTEM", "Integrations", "Meta Graph API recovered — circuit breaker CLOSED", "READ", "EXECUTED");
          toast("Meta Graph API recovered — live data resumed.", "ok");
          Sound.ding(); save(); paint();
        }, 6000);
      });
      wrap.querySelector("#simReport").addEventListener("click", () => {
        addNotice("ai", "💰 Daily report: " + sel.todayOrders().length + " sales · " + ksh(sel.todayRevenue()) + " revenue · " + ksh(sel.todayProfit()) + " profit.");
        addAudit("AI", "BI", "Daily report generated + sent to Telegram (demo)", "WRITE", "EXECUTED");
        const wf = S.workflows.find((w) => w.id === "w3"); if (wf) wf.runs++;
        Sound.ding(); toast("💰 Daily report sent to Telegram (demo preview).", "ok");
        save(); emit("settings");
      });
      wrap.querySelector("#simReset").addEventListener("click", () => {
        modal({ title: "Reset demo data?", confirmLabel: "Reset", tone: "danger", bodyHtml: "<p>Wipes all demo changes in this browser and reseeds the fictional dataset.</p>" }, (ok) => {
          if (ok) { localStorage.removeItem(STORAGE_KEY); location.reload(); }
        });
      });
      wrap.querySelectorAll("[data-wf]").forEach((t) =>
        t.addEventListener("click", () => {
          const w = S.workflows.find((x) => x.id === t.dataset.wf);
          w.enabled = !w.enabled;
          addAudit("YOU", "Automation", (w.enabled ? "Enabled" : "Disabled") + " workflow: " + w.name, "WRITE", "EXECUTED");
          Sound.ding(); toast('Workflow "' + esc(w.name) + '" ' + (w.enabled ? "enabled" : "disabled") + ".", "info");
          save(); paint();
        })
      );
    };
    paint();
    return { el: wrap, destroy: function () {} };
  }

  /* ---------------- router + live simulator ---------------- */
  let currentView = null;
  function render() {
    if (currentView && currentView.destroy) currentView.destroy();
    const views = { command: viewCommand, inventory: viewInventory, orders: viewOrders, finance: viewFinance, freelance: viewFreelance, automations: viewAutomations };
    currentView = views[route]();
    mainRef.el.innerHTML = "";
    mainRef.el.appendChild(currentView.el);
  }

  function updateSimChrome() {
    const dot = document.getElementById("simDot");
    const label = document.getElementById("simLabel");
    if (dot) dot.className = "live-dot" + (S.settings.sim ? "" : " paused");
    if (label) label.textContent = S.settings.sim ? "LIVE SIMULATOR ON" : "LIVE SIMULATOR OFF";
    label.style.cursor = "pointer";
  }

  function boot() {
    buildShell();
    setRoute("command");
    updateSimChrome();
    document.getElementById("simLabel").addEventListener("click", () => {
      S.settings.sim = !S.settings.sim; save(); updateSimChrome();
      toast(S.settings.sim ? "Live simulator resumed — demo sales will stream in." : "Live simulator paused.", "info");
    });
    /* live operations simulator: demo sales every ~18s */
    setInterval(() => {
      if (!S.settings.sim) return;
      if (Math.random() < 0.72) recordOrder();
    }, 18000);
    /* gentle clock-driven refresh for "time ago" labels */
    setInterval(() => emit("tick"), 30000);
    /* global order effects: cash register + screen flash + toast */
    on((kind) => {
      if (kind === "order") {
        Sound.cash();
        flash("SALE CONFIRMED");
        const n = S.notices[0];
        if (n && n.kind === "sale") toast(esc(n.text), "ok");
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
