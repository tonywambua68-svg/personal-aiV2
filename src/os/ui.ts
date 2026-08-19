/* ============================================================
   NEXUS//OS — vanilla DOM utilities, icons, charts, toasts
   ============================================================ */
import { voice } from "./voice";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function ksh(n: number): string {
  return "KSh " + Math.round(n).toLocaleString("en-KE");
}

export function num(n: number): string {
  return n.toLocaleString("en-KE");
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

export function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
}

type Child = string | Node | null | false | undefined | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  const add = (c: Child) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  };
  children.forEach(add);
  return el;
}

export function html<T extends HTMLElement>(tag: string, cls: string, inner: string): T {
  const el = document.createElement(tag);
  el.className = cls;
  el.innerHTML = inner;
  return el as T;
}

/* ---------------- icons (inline SVG, stroke = currentColor) ---------------- */
const P: Record<string, string> = {
  pulse: "M2 12h4l3-8 4 16 3-8h6",
  box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3.3 7.5L12 12l8.7-4.5M12 22V12",
  cart: "M9 20a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2zM2 3h3l2.6 12.4A2 2 0 009.6 17H19a2 2 0 002-1.6L22.6 8H6",
  coins: "M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3.5 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5",
  brief: "M3 7h18v13H3zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18",
  chart: "M3 3v18h18M8 17V9m5 8V5m5 12v-6",
  zap: "M13 2L3 14h8l-1 8 10-12h-8l1-8z",
  plug: "M9 2v6m6-6v6M5 8h14v4a7 7 0 01-14 0V8zM12 19v3",
  cap: "M22 9L12 4 2 9l10 5 10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5",
  shield: "M12 2l8 4v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-4zM9 12l2 2 4-4",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2-1.2L14.5 3h-5L9 5.6a7.6 7.6 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 002 1.2L9.5 21h5l.4-2.6a7.6 7.6 0 002-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z",
  book: "M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 004 4.5v15A2.5 2.5 0 006.5 22H20v-2.5",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  sndOn: "M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13",
  mic: "M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8",
  sndOff: "M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6m0-6l6 6",
  x: "M18 6L6 18M6 6l12 12",
  check: "M20 6L9 17l-5-5",
  warn: "M10.3 3.8L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0zM12 9v4m0 4h.01",
  cpu: "M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3M19 9h3m-3 6h3M5 5h14v14H5zM9 9h6v6H9z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  db: "M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zm9 2c0 1.66-4.03 3-9 3s-9-1.34-9-3m18 0V5m0 7v7c0 1.66-4.03 3-9 3s-9-1.34-9-3v-7m0 0V5",
  radio: "M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M16.2 7.8a6 6 0 010 8.4m-8.4 0a6 6 0 010-8.4M19 5a10 10 0 010 14M5 19A10 10 0 015 5",
  phone: "M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.13.96.36 1.9.7 2.8a2 2 0 01-.45 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0122 16.9z",
  clock: "M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0M12 7v5l3 3",
  doc: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6",
  play: "M6 4l14 8-14 8V4z",
  pause: "M7 4h3v16H7zM14 4h3v16h-3z",
  refresh: "M21 12a9 9 0 11-2.6-6.3M21 3v6h-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z",
  menu: "M3 6h18M3 12h18M3 18h18",
  hex: "M12 2l8 4.6v9.2L12 22l-8-4.6V7.4L12 2zm0 6.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z",
  arrow: "M5 12h14m-6-6l6 6-6 6",
};

export function icon(name: keyof typeof P | string, size = 16): string {
  const d = P[name] || P.box;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d
    .split("M")
    .filter(Boolean)
    .map((p) => `<path d="M${p}"/>`)
    .join("")}</svg>`;
}

/* ---------------- toasts ---------------- */
export function toast(text: string, kind: "ok" | "warn" | "danger" | "info" = "ok") {
  let root = document.getElementById("toasts");
  if (!root) {
    root = document.createElement("div");
    root.id = "toasts";
    document.body.appendChild(root);
  }
  const icons = { ok: "check", warn: "warn", danger: "warn", info: "bell" } as const;
  const colors = { ok: "var(--acc)", warn: "var(--warn)", danger: "var(--danger)", info: "var(--info)" } as const;
  const t = html("div", `toast ${kind}`, `<span class="ic" style="color:${colors[kind]}">${icon(icons[kind], 17)}</span><div>${text}</div>`);
  root.appendChild(t);
  window.setTimeout(() => {
    t.classList.add("out");
    window.setTimeout(() => t.remove(), 260);
  }, 4200);
}

/* ---------------- sale flash ---------------- */
export function flash(label = "SALE CONFIRMED") {
  let f = document.getElementById("saleFlash");
  if (!f) {
    f = document.createElement("div");
    f.id = "saleFlash";
    document.body.appendChild(f);
  }
  f.innerHTML = `<div class="tag">${esc(label)}</div>`;
  f.classList.remove("on");
  void (f as HTMLElement).offsetWidth;
  f.classList.add("on");
  window.setTimeout(() => f.classList.remove("on"), 750);
}

/* ---------------- modal ---------------- */
export function modal(opts: { title: string; bodyHtml: string; confirmLabel?: string; cancelLabel?: string; tone?: "acc" | "danger"; wide?: boolean }): Promise<boolean> {
  /* lazy import avoided: voice never statically imports ui, so this is safe */
  return new Promise((resolve) => {
    const root = html("div", "", "");
    root.id = "modalRoot";
    root.innerHTML = `
      <div class="modal-back"></div>
      <div class="modal" style="${opts.wide ? "width:min(720px,100%)" : ""}">
        <div class="panel-h">
          <span class="t" style="color:var(--txt)">${opts.title}</span>
          <button class="btn btn-sm" style="margin-left:auto" data-close>${icon("x", 13)}</button>
        </div>
        <div class="panel-b">${opts.bodyHtml}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding:0 16px 16px">
          <button class="btn" data-no>${opts.cancelLabel || "Cancel"}</button>
          <button class="btn ${opts.tone === "danger" ? "btn-danger" : "btn-acc"}" data-yes>${opts.confirmLabel || "Confirm"}</button>
        </div>
      </div>`;
    const done = (v: boolean) => {
      voice.clearConfirm(done);
      root.remove();
      resolve(v);
    };
    /* let the voice layer approve/deny this exact dialog ("yes" / "no") */
    voice.registerConfirm(() => opts.title, done);
    root.querySelector("[data-close]")!.addEventListener("click", () => done(false));
    root.querySelector("[data-no]")!.addEventListener("click", () => done(false));
    root.querySelector("[data-yes]")!.addEventListener("click", () => done(true));
    root.querySelector(".modal-back")!.addEventListener("click", () => done(false));
    document.body.appendChild(root);
  });
}

/* ---------------- animated counter ---------------- */
export function countUp(el: HTMLElement, to: number, fmt: (n: number) => string = (n) => String(Math.round(n))) {
  const from = (el as HTMLElement & { _v?: number })._v ?? 0;
  (el as HTMLElement & { _v?: number })._v = to;
  const t0 = performance.now();
  const dur = 650;
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- canvas charts ---------------- */
function prep(cv: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300;
  const hgt = cv.clientHeight || 80;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(hgt * dpr);
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hgt);
  return ctx;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function areaChart(cv: HTMLCanvasElement, data: number[], color: string, opts?: { color2?: string; data2?: number[]; labels?: string[] }) {
  const ctx = prep(cv);
  if (!ctx) return;
  const w = cv.clientWidth;
  const hgt = cv.clientHeight;
  const pad = 6;
  const all = opts?.data2 ? [...data, ...opts.data2] : data;
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const X = (i: number, len: number) => pad + (i / Math.max(1, len - 1)) * (w - pad * 2);
  const Y = (v: number) => hgt - pad - ((v - min) / Math.max(1, max - min)) * (hgt - pad * 2);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = (hgt / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  const drawSeries = (d: number[], col: string, fill: boolean) => {
    ctx.beginPath();
    d.forEach((v, i) => (i === 0 ? ctx.moveTo(X(i, d.length), Y(v)) : ctx.lineTo(X(i, d.length), Y(v))));
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (fill) {
      ctx.lineTo(X(d.length - 1, d.length), hgt - pad);
      ctx.lineTo(X(0, d.length), hgt - pad);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, hgt);
      g.addColorStop(0, hexA(col, 0.22));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.fill();
    }
    const lx = X(d.length - 1, d.length);
    const ly = Y(d[d.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  };

  if (opts?.data2 && opts.color2) drawSeries(opts.data2, opts.color2, false);
  drawSeries(data, color, true);
}

export function barChart(cv: HTMLCanvasElement, labels: string[], a: number[], b: number[] | null, colorA: string, colorB: string) {
  const ctx = prep(cv);
  if (!ctx) return;
  const w = cv.clientWidth;
  const hgt = cv.clientHeight;
  const padB = 20;
  const max = Math.max(...a, ...(b || [0]), 1);
  const group = (w - 12) / labels.length;
  const bw = b ? group * 0.3 : group * 0.5;
  const Y = (v: number) => hgt - padB - (v / max) * (hgt - padB - 8);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let i = 1; i <= 3; i++) {
    const y = ((hgt - padB) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(6, y);
    ctx.lineTo(w - 6, y);
    ctx.stroke();
  }

  labels.forEach((lb, i) => {
    const gx = 6 + i * group + group / 2;
    const va = a[i];
    ctx.fillStyle = hexA(colorA, 0.85);
    const ya = Y(va);
    const x0 = b ? gx - bw - 1.5 : gx - bw / 2;
    roundBar(ctx, x0, ya, bw, hgt - padB - ya);
    if (b) {
      ctx.fillStyle = hexA(colorB, 0.8);
      const yb = Y(b[i]);
      roundBar(ctx, gx + 1.5, yb, bw, hgt - padB - yb);
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(lb, gx, hgt - 6);
  });
}

function roundBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (h <= 0) return;
  const r = Math.min(3, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

export function funnelBar(label: string, value: number, maxV: number, color: string): HTMLElement {
  const pctV = maxV > 0 ? (value / maxV) * 100 : 0;
  return html(
    "div",
    "mb-3",
    `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
       <span style="color:var(--txt-2)">${label}</span>
       <span class="mono" style="color:var(--txt);font-size:11.5px">${num(value)} <span style="color:var(--txt-3)">· ${pctV.toFixed(0)}%</span></span>
     </div>
     <div class="bar-track"><div class="bar-fill" style="width:0%;background:${color}"></div></div>`
  );
}
