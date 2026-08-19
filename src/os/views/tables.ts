/* ============================================================
   NEXUS//OS — E-commerce views: Inventory · Orders · Finance
   ============================================================ */
import { sel, store } from "../store";
import { barChart, countUp, esc, h, html, icon, ksh, modal, timeAgo } from "../ui";
import type { View } from "./command";
import type { OrderStatus } from "../types";

/* ---------------- shared bits ---------------- */
function statCards(defs: { label: string; icon: string; value: () => string; sub: string }[]): HTMLElement {
  const row = h("div", "grid grid-cols-2 xl:grid-cols-4 gap-3 reveal");
  defs.forEach((d, i) => {
    const card = html(
      "div",
      `panel kpi reveal d${i + 1}`,
      `<div style="display:flex;justify-content:space-between"><span class="kpi-label">${d.label}</span><span style="color:var(--txt-3)">${icon(d.icon, 15)}</span></div>
       <div class="kpi-val" data-v style="margin-top:6px">${d.value()}</div>
       <div class="kpi-sub" style="margin-top:3px">${d.sub}</div>`
    );
    row.appendChild(card);
  });
  return row;
}

const statusBadge = (sT: OrderStatus) => {
  const map: Record<OrderStatus, string> = { paid: "ok", processing: "info", shipped: "vio", delivered: "mut" };
  return `<span class="badge ${map[sT]}">${sT}</span>`;
};

const srcBadge = (src: string) => {
  const c = src === "WooCommerce" ? "info" : src === "Instagram" ? "vio" : src === "TikTok" ? "ok" : src === "WhatsApp" ? "warn" : "mut";
  return `<span class="badge ${c}">${esc(src)}</span>`;
};

/* ============================================================
   INVENTORY
   ============================================================ */
export function renderInventory(): View {
  const root = h("div", "grid gap-4");
  const s = store.state;
  const units = s.products.reduce((a, p) => a + p.stock, 0);

  root.appendChild(
    statCards([
      { label: "Units in stock", icon: "box", value: () => String(s.products.reduce((a, p) => a + p.stock, 0)), sub: `${s.products.length} SKUs live` },
      { label: "Capital at cost", icon: "coins", value: () => ksh(sel.inventoryValue()), sub: "money sitting on shelves" },
      { label: "Low stock", icon: "warn", value: () => String(sel.lowStock().length), sub: "≤ 2 units remaining" },
      { label: "Best velocity", icon: "zap", value: () => { const p = [...s.products].sort((a, b) => b.velocity - a.velocity)[0]; return p.name.split(" ").slice(-1)[0]; }, sub: "fastest mover / week" },
    ])
  );

  const panel = html("div", "panel reveal d2", `<div class="panel-h"><span style="color:var(--acc)">${icon("box", 15)}</span><span class="t">Product performance</span><span class="badge mut" style="margin-left:auto">WOOCOMMERCE SYNC · ${timeAgo(Date.now() - (s.integrations[0]?.syncMin ?? 1) * 60000)}</span></div>`);

  const body = h("div", "scroll-thin");
  body.style.overflowX = "auto";

  function paint() {
    const rows = [...store.state.products]
      .sort((a, b) => (b.price - b.cost) * b.velocity - (a.price - a.cost) * a.velocity)
      .map((p) => {
        const margin = (((p.price - p.cost) / p.price) * 100).toFixed(1);
        const stockBadge = p.stock === 0 ? `<span class="badge danger">OUT</span>` : p.stock <= 2 ? `<span class="badge warn">${p.stock} LEFT</span>` : `<span class="badge ok">${p.stock}</span>`;
        const convW = Math.min(100, (p.conv / 3.5) * 100);
        return `<tr>
          <td><div style="font-weight:600">${esc(p.name)}</div><div class="mono" style="font-size:10.5px;color:var(--txt-3);margin-top:2px">${esc(p.spec)}</div></td>
          <td class="num">${ksh(p.cost)}</td>
          <td class="num" style="color:var(--txt)">${ksh(p.price)}</td>
          <td class="num" style="color:var(--acc)">${margin}%</td>
          <td>${stockBadge}</td>
          <td class="num">${p.velocity}/wk</td>
          <td class="num">${p.views.toLocaleString()}</td>
          <td style="min-width:110px"><div style="display:flex;align-items:center;gap:8px"><div class="bar-track" style="flex:1"><div class="bar-fill i" style="width:${convW}%"></div></div><span class="num" style="font-size:11px">${p.conv}%</span></div></td>
          <td><button class="btn btn-sm" data-restock="${p.id}">${icon("cart", 12)} Restock</button></td>
        </tr>`;
      })
      .join("");
    body.innerHTML = `<table class="tbl"><thead><tr>
      <th>Product</th><th>Cost</th><th>Price</th><th>Margin</th><th>Stock</th><th>Velocity</th><th>Views</th><th>Conversion</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>`;
    body.querySelectorAll("[data-restock]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).getAttribute("data-restock")!;
        const p = store.state.products.find((x) => x.id === id)!;
        const qty = Math.max(3, p.velocity);
        const yes = await modal({
          title: "FINANCIAL APPROVAL — REORDER",
          bodyHtml: `<div style="font-size:13px;line-height:1.7">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span style="color:var(--txt-2)">Product</span><b>${esc(p.name)}</b></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span style="color:var(--txt-2)">Quantity</span><b class="mono">${qty} units (velocity-based)</b></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:var(--txt-2)">Est. cost</span><b class="mono" style="color:var(--warn)">${ksh(p.cost * qty)}</b></div>
          </div><div class="badge warn" style="margin-top:10px">SCOPE: FINANCIAL — AI cannot spend without you</div>`,
          confirmLabel: "Approve reorder",
        });
        if (yes) {
          store.restock(p.id, qty);
          paint();
        }
      });
    });
  }
  paint();
  panel.appendChild(body);
  root.appendChild(panel);

  const unsub = store.on((e) => {
    if (e.kind === "order" || e.kind === "system") paint();
  });
  return { el: root, destroy: unsub };
}

/* ============================================================
   ORDERS
   ============================================================ */
export function renderOrders(): View {
  const root = h("div", "grid gap-4");
  let statusFilter: OrderStatus | "all" = "all";
  let srcFilter = "all";

  root.appendChild(
    statCards([
      { label: "Orders today", icon: "cart", value: () => String(sel.ordersToday().length), sub: ksh(sel.revenueToday()) + " revenue" },
      { label: "Revenue 14d", icon: "pulse", value: () => ksh(sel.revenueSeries(14).reduce((a, b) => a + b, 0)), sub: "all channels" },
      { label: "Avg order value", icon: "coins", value: () => ksh(sel.avgOrderValue()), sub: "per unit blend" },
      { label: "Top source", icon: "zap", value: () => { const c: Record<string, number> = {}; store.state.orders.forEach((o) => (c[o.source] = (c[o.source] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; }, sub: "by order count" },
    ])
  );

  const panel = html("div", "panel reveal d2", `<div class="panel-h"><span style="color:var(--acc)">${icon("cart", 15)}</span><span class="t">Order book</span></div>`);
  const filterRow = h("div", "flex gap-2 flex-wrap");
  filterRow.style.padding = "12px 16px 0";
  const body = h("div", "scroll-thin");
  body.style.overflowX = "auto";

  const statuses: (OrderStatus | "all")[] = ["all", "paid", "processing", "shipped", "delivered"];
  const sources = ["all", "WooCommerce", "Instagram", "TikTok", "WhatsApp", "Walk-in"];

  function paintFilters() {
    filterRow.innerHTML = "";
    statuses.forEach((st) => {
      const c = h("button", "chip" + (statusFilter === st ? "" : ""), st === "all" ? "All statuses" : st);
      if (statusFilter === st) c.style.cssText = "color:var(--acc);border-color:rgba(0,255,136,0.5);background:rgba(0,255,136,0.08)";
      c.addEventListener("click", () => { statusFilter = st; paintFilters(); paint(); });
      filterRow.appendChild(c);
    });
    const sep = h("span", "");
    sep.style.cssText = "width:1px;background:var(--line);margin:2px 4px";
    filterRow.appendChild(sep);
    sources.forEach((sr) => {
      const c = h("button", "chip", sr === "all" ? "All sources" : sr);
      if (srcFilter === sr) c.style.cssText = "color:var(--info);border-color:rgba(63,192,255,0.5);background:rgba(63,192,255,0.08)";
      c.addEventListener("click", () => { srcFilter = sr; paintFilters(); paint(); });
      filterRow.appendChild(c);
    });
  }

  function paint() {
    const masked = !store.state.memory.customers;
    const rows = store.state.orders
      .filter((o) => (statusFilter === "all" || o.status === statusFilter) && (srcFilter === "all" || o.source === srcFilter))
      .slice(0, 40)
      .map((o) => {
        const p = sel.productById(o.productId);
        return `<tr>
          <td class="num" style="color:var(--acc)">${o.id}</td>
          <td class="mono" style="font-size:11.5px;color:var(--txt-2);white-space:nowrap">${new Date(o.at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })} ${new Date(o.at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
          <td>${masked ? `<span style="color:var(--txt-3)">Customer ${o.customer.split(" ").map((w) => w[0]).join("")}••</span>` : esc(o.customer)}</td>
          <td>${esc(p?.name || "—")} <span style="color:var(--txt-3)">×${o.qty}</span></td>
          <td>${srcBadge(o.source)}</td>
          <td class="num">${ksh(o.revenue)}</td>
          <td class="num" style="color:var(--acc)">+${ksh(o.profit)}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>`;
      })
      .join("");
    body.innerHTML = `<table class="tbl"><thead><tr><th>Order</th><th>Time</th><th>Customer</th><th>Item</th><th>Source</th><th>Revenue</th><th>Profit</th><th>Status</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:var(--txt-3);padding:26px">No orders match these filters.</td></tr>`}</tbody></table>`;
  }

  paintFilters();
  paint();
  panel.appendChild(filterRow);
  panel.appendChild(body);
  root.appendChild(panel);

  const unsub = store.on((e) => {
    if (e.kind === "order") paint();
  });
  return { el: root, destroy: unsub };
}

/* ============================================================
   FINANCE
   ============================================================ */
export function renderFinance(): View {
  const root = h("div", "grid gap-4");
  const rev14 = sel.revenueSeries(14).reduce((a, b) => a + b, 0);
  const prof14 = store.state.orders.reduce((a, o) => a + o.profit, 0);
  const exp = store.state.expenses.reduce((a, e) => a + e.amount, 0);

  root.appendChild(
    statCards([
      { label: "Revenue 14d", icon: "pulse", value: () => ksh(rev14), sub: "gross, all channels" },
      { label: "Gross profit 14d", icon: "coins", value: () => ksh(prof14), sub: ((prof14 / Math.max(rev14, 1)) * 100).toFixed(1) + "% margin" },
      { label: "Expenses logged", icon: "warn", value: () => ksh(exp), sub: store.state.expenses.filter((e) => e.recurring).length + " recurring items" },
      { label: "Est. net position", icon: "chart", value: () => ksh(prof14 - exp), sub: "before tax & provisions" },
    ])
  );

  const chartPanel = html("div", "panel reveal d2", `<div class="panel-h"><span style="color:var(--acc)">${icon("chart", 15)}</span><span class="t">Revenue vs profit — 14 days</span>
    <span style="margin-left:auto;display:flex;gap:14px;font-size:11px" class="mono"><span style="color:var(--acc)">■ revenue</span><span style="color:var(--violet)">■ profit</span></span></div>
    <div class="panel-b"><canvas id="finChart" style="width:100%;height:200px;display:block"></canvas></div>`);
  const cv = chartPanel.querySelector("#finChart") as HTMLCanvasElement;

  function paintChart() {
    const revs = sel.revenueSeries(14);
    const profs = revs.map((r) => Math.round(r * 0.24));
    const labels = revs.map((_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000);
      return d.toLocaleDateString("en-KE", { day: "2-digit" });
    });
    barChart(cv, labels, revs, profs, "#00ff88", "#b48cff");
  }

  const tablesRow = h("div", "grid xl:grid-cols-2 gap-4");

  /* expenses */
  const expPanel = html("div", "panel reveal d3", `<div class="panel-h"><span style="color:var(--warn)">${icon("coins", 15)}</span><span class="t">Expenses</span></div>`);
  expPanel.appendChild(
    html(
      "div",
      "scroll-thin",
      `<table class="tbl"><thead><tr><th>Item</th><th>Category</th><th>Amount</th><th>Type</th></tr></thead><tbody>
      ${store.state.expenses
        .map(
          (e) => `<tr><td>${esc(e.label)}</td><td><span class="badge mut">${esc(e.category)}</span></td><td class="num" style="color:var(--warn)">${ksh(e.amount)}</td><td>${e.recurring ? `<span class="badge info">monthly</span>` : `<span class="badge mut">once</span>`}</td></tr>`
        )
        .join("")}
      </tbody></table>`
    )
  );

  /* campaigns */
  const campPanel = html("div", "panel reveal d4", `<div class="panel-h"><span style="color:var(--info)">${icon("zap", 15)}</span><span class="t">Marketing ROAS</span></div>`);
  const campBody = h("div", "scroll-thin");
  function paintCampaigns() {
    campBody.innerHTML = `<table class="tbl"><thead><tr><th>Campaign</th><th>Spend</th><th>Sales</th><th>ROAS</th><th></th></tr></thead><tbody>
      ${store.state.campaigns
        .map((c) => {
          const roas = c.spend ? c.revenue / c.spend : 0;
          return `<tr>
            <td><div style="font-weight:600">${esc(c.name)}</div><div class="mono" style="font-size:10.5px;color:var(--txt-3)">${c.platform.toUpperCase()}</div></td>
            <td class="num" style="color:var(--warn)">${ksh(c.spend)}</td>
            <td class="num">${c.conversions}</td>
            <td><span class="badge ${roas >= 5 ? "ok" : roas > 0 ? "warn" : "danger"}">${roas.toFixed(1)}×</span></td>
            <td><button class="btn btn-sm ${c.active ? "btn-danger" : ""}" data-camp="${c.id}">${c.active ? "Pause" : "Resume"}</button></td>
          </tr>`;
        })
        .join("")}
    </tbody></table>`;
    campBody.querySelectorAll("[data-camp]").forEach((b) =>
      b.addEventListener("click", () => {
        store.toggleCampaign((b as HTMLElement).getAttribute("data-camp")!);
        paintCampaigns();
      })
    );
  }
  paintCampaigns();
  campPanel.appendChild(campBody);

  tablesRow.appendChild(expPanel);
  tablesRow.appendChild(campPanel);

  root.appendChild(chartPanel);
  root.appendChild(tablesRow);
  requestAnimationFrame(paintChart);

  const unsub = store.on((e) => {
    if (e.kind === "order" || e.kind === "tick") requestAnimationFrame(paintChart);
  });
  return { el: root, destroy: unsub };
}

export { countUp };
