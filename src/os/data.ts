import type { State, Order, Product } from "./types";

/* Deterministic PRNG so the seeded "history" is stable */
function rng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86400000;
const HOUR = 3600000;

export const PRODUCTS: Product[] = [
  { id: "p1", name: "HP EliteBook 840 G5", spec: "i5-8350U · 8GB · 256SSD", cost: 32000, price: 42500, stock: 7, views: 4820, conv: 2.6, velocity: 5 },
  { id: "p2", name: "Dell Latitude 7490", spec: "i5-8350U · 8GB · 256SSD", cost: 29500, price: 38900, stock: 5, views: 3610, conv: 2.1, velocity: 4 },
  { id: "p3", name: "Lenovo ThinkPad T480", spec: "i5-8250U · 16GB · 512SSD", cost: 30000, price: 39500, stock: 2, views: 5240, conv: 3.1, velocity: 6 },
  { id: "p4", name: 'MacBook Air 13" 2017', spec: "i5 · 8GB · 128SSD", cost: 48000, price: 62000, stock: 3, views: 6130, conv: 1.7, velocity: 2 },
  { id: "p5", name: "HP ProBook 450 G6", spec: "i5-8265U · 8GB · 1TB", cost: 27000, price: 35500, stock: 9, views: 2140, conv: 1.4, velocity: 3 },
  { id: "p6", name: "Dell XPS 13 9360", spec: "i7-7500U · 16GB · 512SSD", cost: 41000, price: 54500, stock: 1, views: 3890, conv: 2.9, velocity: 3 },
  { id: "p7", name: "ThinkPad X1 Carbon G6", spec: "i7-8650U · 16GB · 512SSD", cost: 45000, price: 58000, stock: 4, views: 2980, conv: 2.2, velocity: 2 },
  { id: "p8", name: "Toshiba Dynabook G83", spec: "i5-8250U · 8GB · 256SSD", cost: 21000, price: 28500, stock: 12, views: 1720, conv: 1.1, velocity: 4 },
];

const NAMES = [
  ["Brian Otieno", "brian.otieno@gmail.com"],
  ["Faith Wanjiru", "faith.wanjiku@yahoo.com"],
  ["Kevin Mwangi", "kevmwangi@gmail.com"],
  ["Aisha Hassan", "aisha.h@outlook.com"],
  ["Peter Kiprop", "pkiprop@gmail.com"],
  ["Grace Nyambura", "grace.nyam@gmail.com"],
  ["Samuel Mutua", "smutua@gmail.com"],
  ["Diana Cherono", "diana.cher@gmail.com"],
  ["Victor Omondi", "vomondi@gmail.com"],
  ["Mercy Achieng", "mercy.ach@gmail.com"],
  ["John Kamau", "jkamau@gmail.com"],
  ["Halima Yusuf", "halima.y@gmail.com"],
  ["Dennis Gitau", "dgitau@gmail.com"],
  ["Ruth Muthoni", "ruth.muth@gmail.com"],
] as const;

const SOURCES: Order["source"][] = ["WooCommerce", "WooCommerce", "WooCommerce", "Instagram", "Instagram", "WhatsApp", "TikTok", "Walk-in"];

export function buildSeed(): State {
  const r = rng(20240817);
  const now = Date.now();
  const orders: Order[] = [];
  let oid = 1041;

  for (let d = 13; d >= 0; d--) {
    const base = now - d * DAY;
    const recency = 13 - d;
    const count = 1 + Math.floor(r() * 3) + (recency > 9 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const p = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const at = base - (8 + Math.floor(r() * 11)) * HOUR - Math.floor(r() * 50) * 60000;
      const c = NAMES[Math.floor(r() * NAMES.length)];
      const qty = r() > 0.92 ? 2 : 1;
      orders.push({
        id: "ORD-" + oid++,
        at,
        customer: c[0],
        productId: p.id,
        qty,
        revenue: p.price * qty,
        profit: (p.price - p.cost) * qty,
        status: d === 0 ? (r() > 0.5 ? "paid" : "processing") : d < 3 ? "shipped" : "delivered",
        source: SOURCES[Math.floor(r() * SOURCES.length)],
      });
    }
  }
  // guarantee a lively "today"
  for (let i = 0; i < 3; i++) {
    const p = PRODUCTS[[0, 2, 7][i]];
    const c = NAMES[i * 3];
    orders.push({
      id: "ORD-" + oid++,
      at: now - (i + 1) * 47 * 60000,
      customer: c[0],
      productId: p.id,
      qty: 1,
      revenue: p.price,
      profit: p.price - p.cost,
      status: i === 0 ? "processing" : "paid",
      source: (["WooCommerce", "Instagram", "WhatsApp"] as const)[i],
    });
  }
  orders.sort((a, b) => b.at - a.at);

  const customers = NAMES.map((n, i) => {
    const mine = orders.filter((o) => o.customer === n[0]);
    return {
      id: "c" + (i + 1),
      name: n[0],
      email: n[1],
      spent: mine.reduce((s, o) => s + o.revenue, 0),
      orders: mine.length,
      last: mine.length ? mine[0].at : now - (20 + i) * DAY,
    };
  }).sort((a, b) => b.spent - a.spent);

  const reach = (baseN: number) => Array.from({ length: 14 }, (_, i) => Math.round(baseN * (0.7 + 0.05 * i + r() * 0.5)));

  return {
    v: 1,
    products: PRODUCTS.map((p) => ({ ...p })),
    orders,
    customers,
    expenses: [
      { id: "e1", at: now - 12 * DAY, label: "Shop rent — Moi Avenue", category: "Rent", amount: 15000, recurring: true },
      { id: "e2", at: now - 9 * DAY, label: "Meta ads top-up", category: "Marketing", amount: 5200, recurring: false },
      { id: "e3", at: now - 8 * DAY, label: "Fibre internet", category: "Utilities", amount: 3500, recurring: true },
      { id: "e4", at: now - 6 * DAY, label: "Hosting + domain (shop.ke)", category: "Software", amount: 1800, recurring: true },
      { id: "e5", at: now - 4 * DAY, label: "Rider deliveries ×6", category: "Logistics", amount: 2400, recurring: false },
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
    skills: [
      { id: "s1", name: "HTML / CSS", level: 82, demand: 55 },
      { id: "s2", name: "JavaScript (ES6+)", level: 74, demand: 80 },
      { id: "s3", name: "Node.js / Express", level: 66, demand: 78 },
      { id: "s4", name: "WordPress / Elementor", level: 70, demand: 72 },
      { id: "s5", name: "WooCommerce", level: 61, demand: 68 },
      { id: "s6", name: "SEO / Rank Math", level: 45, demand: 64 },
      { id: "s7", name: "Meta & TikTok Ads", level: 40, demand: 70 },
      { id: "s8", name: "AI Automation (n8n / Zapier)", level: 38, demand: 92 },
    ],
    audit: [
      { id: "a1", at: now - 26 * HOUR, actor: "SYSTEM", module: "Integrations", action: "WooCommerce webhook order.created verified (HMAC OK)", scope: "READ", outcome: "LOGGED" },
      { id: "a2", at: now - 25 * HOUR, actor: "AI", module: "E-commerce", action: "Parsed ORD-1041 payload → wrote order + decremented stock", scope: "WRITE", outcome: "EXECUTED" },
      { id: "a3", at: now - 24 * HOUR, actor: "AI", module: "Notifications", action: "Telegram alert: new order KSh 42,500", scope: "WRITE", outcome: "EXECUTED" },
      { id: "a4", at: now - 20 * HOUR, actor: "AI", module: "BI", action: "Flagged IG Story boost ROAS 0.0 — recommended pause", scope: "READ", outcome: "LOGGED" },
      { id: "a5", at: now - 8 * HOUR, actor: "AI", module: "E-commerce", action: "Requested reorder ThinkPad T480 ×5 — awaiting approval", scope: "FINANCIAL", outcome: "PENDING" },
      { id: "a6", at: now - 7 * HOUR, actor: "YOU", module: "Freelance", action: "Approved proposal send — Garage 254 (KSh 60,000)", scope: "FINANCIAL", outcome: "APPROVED" },
      { id: "a7", at: now - 3 * HOUR, actor: "AI", module: "Analytics", action: "Daily traffic pull from GA4 Data API", scope: "READ", outcome: "EXECUTED" },
      { id: "a8", at: now - 1 * HOUR, actor: "AI", module: "Memory", action: "Stored insight: T480 converts best from TikTok traffic", scope: "ADMIN", outcome: "LOGGED" },
    ],
    notices: [
      { id: "n1", at: now - 47 * 60000, kind: "sale", text: "New order received — KSh 42,500 (HP EliteBook 840 G5) via WooCommerce", read: false },
      { id: "n2", at: now - 3 * HOUR, kind: "alert", text: "ThinkPad T480 low stock — 2 left, selling 6/week. Reorder suggested.", read: false },
      { id: "n3", at: now - 6 * HOUR, kind: "ai", text: "Insight: TikTok drives 2.9× better conversion than Meta for T480.", read: false },
      { id: "n4", at: now - 11 * HOUR, kind: "freelance", text: "NiaFit Studio replied to your IG ad — hot lead, respond fast.", read: true },
    ],
    workflows: [
      { id: "w1", name: "New Order Pipeline", trigger: "WooCommerce · order.created", steps: ["AI parses webhook", "DB updated", "Telegram notify", "Analytics +1"], enabled: true, runs: 132, lastRun: now - 47 * 60000 },
      { id: "w2", name: "Low-Stock Sentinel", trigger: "stock.level ≤ 2", steps: ["Compute velocity", "Supplier price check", "Notify phone", "Draft reorder"], enabled: true, runs: 18, lastRun: now - 3 * HOUR },
      { id: "w3", name: "Daily Report 19:00", trigger: "cron · daily 19:00 EAT", steps: ["Aggregate sales", "Pull GA4 + Meta", "AI summary", "Send Telegram"], enabled: true, runs: 41, lastRun: now - 19 * HOUR },
      { id: "w4", name: "Lead → CRM Capture", trigger: "Fluent Forms · submit", steps: ["Parse form", "Create lead", "Draft reply", "Notify"], enabled: true, runs: 27, lastRun: now - 11 * HOUR },
      { id: "w5", name: "Social Pulse", trigger: "cron · hourly", steps: ["Meta Graph pull", "TikTok pull", "Anomaly scan"], enabled: false, runs: 96, lastRun: now - 2 * DAY },
    ],
    integrations: [
      { id: "woo", name: "WooCommerce", desc: "Orders, products, stock via REST + webhooks", status: "connected", scopes: ["READ", "WRITE"], syncMin: 1, free: true },
      { id: "wp", name: "WordPress (shop.ke)", desc: "REST API · pages, forms (Fluent Forms), Rank Math", status: "connected", scopes: ["READ"], syncMin: 14, free: true },
      { id: "ga4", name: "Google Analytics 4", desc: "Traffic, funnels, behaviour via Data API", status: "connected", scopes: ["READ"], syncMin: 22, free: true },
      { id: "meta", name: "Meta Graph (IG + FB)", desc: "Followers, reach, engagement, ad metrics", status: "connected", scopes: ["READ"], syncMin: 36, free: true },
      { id: "tiktok", name: "TikTok Business", desc: "Video stats, Spark Ads performance", status: "disconnected", scopes: ["READ"], syncMin: 0, free: true },
      { id: "zapier", name: "Zapier / n8n", desc: "Automation webhooks, 3-party workflows", status: "connected", scopes: ["WRITE"], syncMin: 8, free: true },
      { id: "telegram", name: "Telegram Bot", desc: "Phone notifications & approval buttons", status: "connected", scopes: ["WRITE"], syncMin: 1, free: true },
      { id: "openai", name: "OpenAI (gpt-4o-mini)", desc: "AI Brain — function / tool calling", status: "connected", scopes: ["ADMIN"], syncMin: 2, free: false },
    ],
    social: {
      instagram: { followers: 4218, growth7d: 141, engRate: 4.6, reach: reach(520) },
      tiktok: { followers: 9842, growth7d: 402, engRate: 7.9, reach: reach(1450) },
    },
    lessonsDone: ["l-woo"],
    settings: { sound: true, volume: 0.7, telegram: true, email: false, push: true, sim: true },
    memory: { customers: true, finances: true, commands: true },
  };
}

export const CUSTOMER_POOL = NAMES.map((n) => n[0]);
