/* ============================================================
   NEXUS//OS — store + event bus + operations engine
   Browser stand-in for: Express orchestrator + Socket.io + PostgreSQL
   ============================================================ */
import type { BusEvent, EventKind, Notice, NoticeKind, Order, Scope, Settings, State } from "./types";
import { buildSeed, CUSTOMER_POOL } from "./data";

const LS_KEY = "nexus-os-v1";
const DAY = 86400000;

type Listener = (e: BusEvent) => void;

function uid(p: string): string {
  return p + "-" + Math.random().toString(36).slice(2, 8);
}

class Store {
  state: State;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = this.load();
  }

  private load(): State {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed.v === 1 && Array.isArray(parsed.orders)) return parsed;
      }
    } catch {
      /* corrupted storage → reseed */
    }
    return buildSeed();
  }

  private saveTimer: number | null = null;
  save() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.state));
      } catch {
        /* storage full — non-fatal */
      }
    }, 250);
  }

  /* ---------------- event bus (Socket.io stand-in) ---------------- */
  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(kind: EventKind, msg?: string) {
    const e: BusEvent = { kind, msg };
    this.listeners.forEach((fn) => {
      try {
        fn(e);
      } catch (err) {
        console.error("listener error (isolated):", err);
      }
    });
  }

  /* ---------------- audit + notices ---------------- */
  addAudit(actor: "AI" | "YOU" | "SYSTEM", module: string, action: string, scope: Scope, outcome: string) {
    this.state.audit.unshift({ id: uid("a"), at: Date.now(), actor, module, action, scope, outcome });
    if (this.state.audit.length > 300) this.state.audit.length = 300;
    this.save();
  }

  pushNotice(kind: NoticeKind, text: string): Notice {
    const n: Notice = { id: uid("n"), at: Date.now(), kind, text, read: false };
    this.state.notices.unshift(n);
    if (this.state.notices.length > 80) this.state.notices.length = 80;
    this.save();
    return n;
  }

  markAllRead() {
    this.state.notices.forEach((n) => (n.read = true));
    this.save();
    this.emit("system");
  }

  /* ---------------- commerce mutations ---------------- */
  recordOrder(opts?: { productId?: string; source?: Order["source"]; customer?: string }): Order | null {
    const s = this.state;
    const candidates = s.products.filter((p) => p.stock > 0);
    if (!candidates.length) return null;
    const p = opts?.productId
      ? s.products.find((x) => x.id === opts.productId) || candidates[0]
      : candidates[Math.floor(Math.random() * candidates.length)];
    if (p.stock <= 0) return null;
    const customer = opts?.customer || CUSTOMER_POOL[Math.floor(Math.random() * CUSTOMER_POOL.length)];
    const o: Order = {
      id: "ORD-" + (1041 + s.orders.length),
      at: Date.now(),
      customer,
      productId: p.id,
      qty: 1,
      revenue: p.price,
      profit: p.price - p.cost,
      status: "paid",
      source: opts?.source || (["WooCommerce", "Instagram", "WhatsApp", "TikTok"] as const)[Math.floor(Math.random() * 4)],
    };
    s.orders.unshift(o);
    p.stock -= 1;
    p.views += 40 + Math.floor(Math.random() * 60);
    const c = s.customers.find((x) => x.name === customer);
    if (c) {
      c.spent += o.revenue;
      c.orders += 1;
      c.last = o.at;
    }
    this.addAudit("AI", "E-commerce", `Webhook ${o.source.toLowerCase()} → recorded ${o.id} (${p.name})`, "WRITE", "EXECUTED");
    this.pushNotice("sale", `New order received — KSh ${o.revenue.toLocaleString()} (${p.name}) via ${o.source}`);
    this.save();
    this.emit("order", o.id);

    if (p.stock <= 2) {
      this.addAudit("AI", "Automation", `Low-Stock Sentinel: ${p.name} → ${p.stock} left (velocity ${p.velocity}/wk)`, "READ", "LOGGED");
      this.pushNotice("alert", `${p.name} low stock — ${p.stock} left, selling ${p.velocity}/week. Reorder suggested.`);
      this.emit("alert", p.name);
    }
    return o;
  }

  restock(productId: string, qty: number) {
    const p = this.state.products.find((x) => x.id === productId);
    if (!p) return;
    p.stock += qty;
    this.addAudit("YOU", "E-commerce", `Approved reorder: ${p.name} ×${qty} (est. cost KSh ${(p.cost * qty).toLocaleString()})`, "FINANCIAL", "APPROVED");
    this.pushNotice("system", `Reorder placed — ${p.name} ×${qty}. Supplier ETA 3 days.`);
    this.save();
    this.emit("system");
  }

  toggleCampaign(id: string) {
    const c = this.state.campaigns.find((x) => x.id === id);
    if (!c) return;
    c.active = !c.active;
    this.addAudit("YOU", "Marketing", `${c.active ? "Resumed" : "Paused"} campaign: ${c.name}`, "WRITE", "EXECUTED");
    this.save();
    this.emit("system");
  }

  /* ---------------- automation ---------------- */
  toggleWorkflow(id: string) {
    const w = this.state.workflows.find((x) => x.id === id);
    if (!w) return;
    w.enabled = !w.enabled;
    this.addAudit("YOU", "Automation", `${w.enabled ? "Enabled" : "Disabled"} workflow: ${w.name}`, "WRITE", "EXECUTED");
    this.save();
    this.emit("system");
  }

  runWorkflow(id: string) {
    const w = this.state.workflows.find((x) => x.id === id);
    if (!w) return;
    w.runs += 1;
    w.lastRun = Date.now();
    this.addAudit("SYSTEM", "Automation", `Test run: ${w.name} (${w.steps.length} steps OK)`, "WRITE", "EXECUTED");
    this.save();
    this.emit("system", w.name);
  }

  /* ---------------- integrations ---------------- */
  setIntegration(id: string, status: "connected" | "disconnected" | "error") {
    const i = this.state.integrations.find((x) => x.id === id);
    if (!i) return;
    i.status = status;
    if (status === "connected") i.syncMin = 0;
    this.save();
    this.emit("system");
  }

  connectIntegration(id: string) {
    const i = this.state.integrations.find((x) => x.id === id);
    if (!i) return;
    i.status = "connected";
    i.syncMin = 0;
    this.addAudit("YOU", "Integrations", `OAuth handshake complete — ${i.name} connected [${i.scopes.join(", ")}]`, i.scopes.includes("FINANCIAL") ? "FINANCIAL" : "ADMIN", "EXECUTED");
    this.pushNotice("system", `${i.name} connected. Scopes: ${i.scopes.join(", ")}.`);
    this.save();
    this.emit("system");
  }

  /* ---------------- settings / memory / learning ---------------- */
  setSettings(patch: Partial<Settings>) {
    Object.assign(this.state.settings, patch);
    this.save();
    this.emit("settings");
  }

  setMemory(patch: Partial<State["memory"]>) {
    Object.assign(this.state.memory, patch);
    this.addAudit("YOU", "Memory", `Privacy updated — customers:${patch.customers ?? this.state.memory.customers}, finances:${patch.finances ?? this.state.memory.finances}`, "ADMIN", "EXECUTED");
    this.save();
    this.emit("settings");
  }

  lessonDone(id: string) {
    if (!this.state.lessonsDone.includes(id)) this.state.lessonsDone.push(id);
    this.addAudit("YOU", "AI Tutor", `Completed lesson ${id}`, "READ", "LOGGED");
    this.save();
    this.emit("system");
  }

  moveLead(id: string, stage: State["leads"][number]["stage"]) {
    const l = this.state.leads.find((x) => x.id === id);
    if (!l) return;
    l.stage = stage;
    if (stage === "won") this.pushNotice("freelance", `Deal won — ${l.name} (${l.service}) KSh ${l.value.toLocaleString()}.`);
    this.addAudit("YOU", "Freelance", `Moved ${l.name} → ${stage}`, "WRITE", "EXECUTED");
    this.save();
    this.emit("freelance");
  }

  reset() {
    localStorage.removeItem(LS_KEY);
    this.state = buildSeed();
    this.addAudit("SYSTEM", "Memory", "Database reset to seed snapshot", "ADMIN", "EXECUTED");
    this.emit("system");
  }
}

export const store = new Store();

/* ============================================================
   Selectors — the BI layer
   ============================================================ */
export function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const sel = {
  ordersToday(): Order[] {
    const t = todayStart();
    return store.state.orders.filter((o) => o.at >= t);
  },
  revenueToday(): number {
    return this.ordersToday().reduce((s, o) => s + o.revenue, 0);
  },
  profitToday(): number {
    return this.ordersToday().reduce((s, o) => s + o.profit, 0);
  },
  revenueOn(dayOffset: number): number {
    const start = todayStart() - dayOffset * DAY;
    return store.state.orders.filter((o) => o.at >= start && o.at < start + DAY).reduce((s, o) => s + o.revenue, 0);
  },
  revenueSeries(days = 14): number[] {
    return Array.from({ length: days }, (_, i) => this.revenueOn(days - 1 - i));
  },
  viewsSeries(days = 14): number[] {
    const r = store.state.social.instagram.reach;
    const t = store.state.social.tiktok.reach;
    return r.map((v, i) => v + (t[i] || 0));
  },
  profitByProduct(): { p: State["products"][number]; units: number; profit: number; revenue: number }[] {
    return store.state.products
      .map((p) => {
        const os = store.state.orders.filter((o) => o.productId === p.id);
        return {
          p,
          units: os.reduce((s, o) => s + o.qty, 0),
          profit: os.reduce((s, o) => s + o.profit, 0),
          revenue: os.reduce((s, o) => s + o.revenue, 0),
        };
      })
      .sort((a, b) => b.profit - a.profit);
  },
  lowStock(): State["products"][number][] {
    return store.state.products.filter((p) => p.stock <= 2);
  },
  inventoryValue(): number {
    return store.state.products.reduce((s, p) => s + p.cost * p.stock, 0);
  },
  avgMargin(): number {
    const ps = store.state.products;
    return ps.reduce((s, p) => s + (p.price - p.cost) / p.price, 0) / ps.length * 100;
  },
  avgOrderValue(): number {
    const os = store.state.orders;
    return os.length ? os.reduce((s, o) => s + o.revenue, 0) / os.length : 0;
  },
  weekOverWeek(): number {
    const last7 = Array.from({ length: 7 }, (_, i) => this.revenueOn(i)).reduce((a, b) => a + b, 0);
    const prev7 = Array.from({ length: 7 }, (_, i) => this.revenueOn(i + 7)).reduce((a, b) => a + b, 0);
    return prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;
  },
  topCustomers(n = 4): State["customers"][number][] {
    return [...store.state.customers].sort((a, b) => b.spent - a.spent).slice(0, n);
  },
  attention(): { sev: "danger" | "warn" | "info"; text: string; module: string }[] {
    const out: { sev: "danger" | "warn" | "info"; text: string; module: string }[] = [];
    this.lowStock().forEach((p) =>
      out.push({ sev: p.stock <= 1 ? "danger" : "warn", text: `${p.name}: ${p.stock} left (velocity ${p.velocity}/wk) — reorder ~×${Math.max(3, p.velocity)}`, module: "Inventory" })
    );
    store.state.leads
      .filter((l) => l.stage !== "won" && l.stage !== "lost" && l.deadline - Date.now() < 2 * DAY)
      .forEach((l) => out.push({ sev: l.deadline - Date.now() < DAY ? "danger" : "warn", text: `${l.name} — follow-up due ${l.deadline < Date.now() ? "now (overdue)" : "in " + Math.ceil((l.deadline - Date.now()) / DAY) + "d"} (KSh ${l.value.toLocaleString()})`, module: "Freelance" }));
    store.state.campaigns
      .filter((c) => c.active && c.conversions === 0 && c.spend > 2000)
      .forEach((c) => out.push({ sev: "warn", text: `${c.name}: KSh ${c.spend.toLocaleString()} spent, 0 conversions — pause or rework`, module: "Marketing" }));
    store.state.integrations
      .filter((i) => i.status === "error")
      .forEach((i) => out.push({ sev: "danger", text: `${i.name} connection failed — data may be stale`, module: "Integrations" }));
    return out.sort((a, b) => (a.sev === "danger" ? -1 : 1) - (b.sev === "danger" ? -1 : 1));
  },
  forecast7(): { low: number; high: number; trend: number } {
    const last7 = Array.from({ length: 7 }, (_, i) => this.revenueOn(i)).reduce((a, b) => a + b, 0) / 7;
    const prev7 = Array.from({ length: 7 }, (_, i) => this.revenueOn(i + 7)).reduce((a, b) => a + b, 0) / 7;
    const trend = prev7 > 0 ? (last7 - prev7) / prev7 : 0;
    const base = last7 * 7 * (1 + trend * 0.6);
    return { low: Math.round(base * 0.82), high: Math.round(base * 1.15), trend: trend * 100 };
  },
  totalViews(): number {
    return store.state.products.reduce((s, p) => s + p.views, 0);
  },
  unread(): number {
    return store.state.notices.filter((n) => !n.read).length;
  },
  productById(id: string): State["products"][number] | undefined {
    return store.state.products.find((p) => p.id === id);
  },
};

/* ============================================================
   Operations engine — simulates live webhooks + cron jobs
   (in production: WooCommerce webhooks → Express → socket.io)
   ============================================================ */
let opsTimer: number | null = null;
let tickTimer: number | null = null;

export function startOps() {
  if (opsTimer || tickTimer) return;
  tickTimer = window.setInterval(() => {
    if (!store.state.settings.sim) return;
    store.state.products.forEach((p) => (p.views += Math.floor(Math.random() * 3)));
    store.state.integrations.forEach((i) => {
      if (i.status === "connected") i.syncMin += 1;
    });
    store.emit("tick");
  }, 5000);

  opsTimer = window.setInterval(() => {
    if (!store.state.settings.sim) return;
    const r = Math.random();
    if (r < 0.42) {
      store.recordOrder();
    } else if (r < 0.56) {
      const ig = store.state.social.instagram;
      const spike = 40 + Math.floor(Math.random() * 120);
      ig.reach[ig.reach.length - 1] += spike;
      store.pushNotice("social", `Instagram reach spike +${spike} in the last hour — a reel is circulating.`);
      store.addAudit("AI", "Social", `Reach anomaly +${spike} detected on Instagram`, "READ", "LOGGED");
      store.emit("social");
    } else if (r < 0.68) {
      const open = store.state.leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
      if (open.length) {
        const l = open[Math.floor(Math.random() * open.length)];
        store.pushNotice("freelance", `${l.name} opened your proposal — good time to follow up.`);
        store.emit("freelance");
      }
    } else if (r < 0.8) {
      const meta = store.state.integrations.find((i) => i.id === "meta");
      if (meta && meta.status === "connected") {
        meta.status = "error";
        store.pushNotice("alert", "Meta Graph API rate-limited (error 17) — social module running on cached data.");
        store.addAudit("SYSTEM", "Integrations", "Meta Graph API error 17 — isolated, cache fallback engaged", "READ", "LOGGED");
        store.emit("alert");
      } else if (meta && meta.status === "error") {
        meta.status = "connected";
        meta.syncMin = 0;
        store.pushNotice("system", "Meta Graph API recovered — live sync resumed.");
        store.emit("system");
      }
    } else {
      const tk = store.state.social.tiktok;
      tk.followers += 5 + Math.floor(Math.random() * 25);
      store.emit("social");
    }
  }, 17000);
}

export function stopOps() {
  if (opsTimer) window.clearInterval(opsTimer);
  if (tickTimer) window.clearInterval(tickTimer);
  opsTimer = null;
  tickTimer = null;
}
