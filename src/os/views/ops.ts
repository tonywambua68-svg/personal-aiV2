/* ============================================================
   NEXUS//OS — Freelance · Analytics · Automations views
   ============================================================ */
import { sel, store } from "../store";
import { areaChart, esc, flash, h, html, icon, ksh, modal, num, timeAgo, toast, funnelBar } from "../ui";
import { sfx } from "../sound";
import type { View } from "./command";
import type { LeadStage } from "../types";

const STAGES: LeadStage[] = ["lead", "contacted", "proposal", "negotiation", "won"];

/* ============================================================
   FREELANCE
   ============================================================ */
export function renderFreelance(): View {
  const root = h("div", "grid gap-4");
  const open = store.state.leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const won = store.state.leads.filter((l) => l.stage === "won").reduce((a, l) => a + l.value, 0);

  const head = html(
    "div",
    "grid grid-cols-2 xl:grid-cols-4 gap-3 reveal",
    [
      ["Open deals", String(open.length), "brief"],
      ["Pipeline value", ksh(open.reduce((a, l) => a + l.value, 0)), "coins"],
      ["Won (period)", ksh(won), "check"],
      ["Win rate", Math.round((store.state.leads.filter((l) => l.stage === "won").length / Math.max(1, store.state.leads.length)) * 100) + "%", "chart"],
    ]
      .map(
        ([l, v, ic], i) =>
          `<div class="panel kpi reveal d${i + 1}"><div style="display:flex;justify-content:space-between"><span class="kpi-label">${l}</span><span style="color:var(--txt-3)">${icon(ic, 15)}</span></div><div class="kpi-val" style="margin-top:6px">${v}</div></div>`
      )
      .join("")
  );
  root.appendChild(head);

  const board = h("div", "reveal d2");
  board.style.cssText = "display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:10px;overflow-x:auto";

  function paint() {
    board.innerHTML = "";
    STAGES.forEach((st) => {
      const col = h("div", "panel");
      col.style.cssText = "min-height:220px;padding:10px;display:flex;flex-direction:column;gap:8px";
      const leads = store.state.leads.filter((l) => l.stage === st);
      col.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px 6px">
        <span class="mono" style="font-size:10px;font-weight:700;letter-spacing:0.14em;color:${st === "won" ? "var(--acc)" : "var(--txt-3)"}">${st.toUpperCase()}</span>
        <span class="badge mut">${leads.length}</span></div>`;
      leads.forEach((l) => {
        const days = Math.ceil((l.deadline - Date.now()) / 86400000);
        const dueTxt = l.stage === "won" ? "closed" : days < 0 ? `${-days}d overdue` : days === 0 ? "due today" : `due in ${days}d`;
        const card = h("div", "");
        card.style.cssText = "border:1px solid var(--line-2);border-radius:8px;padding:10px;background:var(--panel-2);transition:border-color .15s, transform .15s;cursor:default";
        card.innerHTML = `
          <div style="font-size:12.5px;font-weight:600;line-height:1.4">${esc(l.name)}</div>
          <div style="font-size:11px;color:var(--txt-2);margin:4px 0">${esc(l.service)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="mono" style="font-size:12px;color:var(--acc);font-weight:700">${ksh(l.value)}</span>
            <span class="badge ${days < 0 && l.stage !== "won" ? "danger" : "mut"}">${dueTxt}</span>
          </div>
          <div style="font-size:10.5px;color:var(--txt-3);margin-top:6px;line-height:1.5">${esc(l.note)}</div>
          <div style="display:flex;gap:6px;margin-top:8px">
            ${st !== "won" ? `<button class="btn btn-sm" data-adv="${l.id}" style="flex:1;justify-content:center">${icon("arrow", 11)} Advance</button>` : ""}
            <button class="btn btn-sm" data-prop="${l.id}" style="justify-content:center">${icon("doc", 11)}</button>
          </div>`;
        card.addEventListener("mouseenter", () => { card.style.borderColor = "rgba(0,255,136,0.45)"; card.style.transform = "translateY(-2px)"; });
        card.addEventListener("mouseleave", () => { card.style.borderColor = "var(--line-2)"; card.style.transform = "none"; });
        col.appendChild(card);
      });
      board.appendChild(col);
    });
    board.querySelectorAll("[data-adv]").forEach((b) =>
      b.addEventListener("click", () => {
        const l = store.state.leads.find((x) => x.id === (b as HTMLElement).getAttribute("data-adv"))!;
        const next = STAGES[STAGES.indexOf(l.stage) + 1];
        if (next) {
          store.moveLead(l.id, next);
          if (next === "won") { sfx.cash(); flash("DEAL WON"); } else sfx.ding();
          paint();
        }
      })
    );
    board.querySelectorAll("[data-prop]").forEach((b) =>
      b.addEventListener("click", async () => {
        const l = store.state.leads.find((x) => x.id === (b as HTMLElement).getAttribute("data-prop"))!;
        await modal({
          title: "AI-DRAFTED PROPOSAL — " + esc(l.name),
          wide: true,
          bodyHtml: `<div style="font-size:13px;line-height:1.8;border:1px solid var(--line);border-radius:8px;padding:14px;background:#141416">
            Hi ${esc(l.name.split(" ")[0])},<br/><br/>
            Here's the plan for <b>${esc(l.service)}</b>:<br/>
            <b>Scope</b> — design, build, mobile testing, plus 2 weeks of free fixes.<br/>
            <b>Timeline</b> — 10 working days from kickoff.<br/>
            <b>Investment</b> — <span class="mono" style="color:var(--acc)">${ksh(l.value)}</span> (50% kickoff, 50% on launch).<br/>
            <b>Bonus</b> — free analytics dashboard so you can see exactly what the site earns.<br/><br/>
            I've helped similar Nairobi businesses start taking bookings online within 2 weeks — happy to show you one live today.<br/><br/>
            Regards,<br/>You — powered by NEXUS
          </div>
          <div style="margin-top:10px;font-size:12px;color:var(--txt-2)">${icon("cpu", 12)} Rate check: ${ksh(l.value)} ≈ KSh ${Math.round(l.value / 40)}/hr for ~40h — ${l.value / 40 > 900 ? "solid for your level" : "consider +15%"}.</div>`,
          confirmLabel: "Send via email",
          cancelLabel: "Edit later",
        }).then((ok) => {
          if (ok) {
            store.addAudit("AI", "Freelance", `Proposal sent to ${l.name} (${ksh(l.value)})`, "WRITE", "EXECUTED");
            toast(`Proposal sent to ${esc(l.name)} — follow-up reminder set for 48h.`, "ok");
            sfx.ding();
          }
        });
      })
    );
  }
  paint();
  root.appendChild(board);

  const unsub = store.on((e) => {
    if (e.kind === "freelance") paint();
  });
  return { el: root, destroy: unsub };
}

/* ============================================================
   ANALYTICS
   ============================================================ */
export function renderAnalytics(): View {
  const root = h("div", "grid gap-4");
  const s = store.state;

  const row1 = h("div", "grid xl:grid-cols-3 gap-4");
  const trafficPanel = html("div", "panel xl:col-span-2 reveal", `<div class="panel-h"><span style="color:var(--info)">${icon("chart", 15)}</span><span class="t">Traffic & reach — 14 days</span>
    <span style="margin-left:auto;display:flex;gap:14px;font-size:11px" class="mono"><span style="color:var(--acc)">■ combined reach</span><span style="color:var(--info)">■ store views</span></span></div>
    <div class="panel-b"><canvas id="trChart" style="width:100%;height:200px;display:block"></canvas></div>`);
  const cv = trafficPanel.querySelector("#trChart") as HTMLCanvasElement;

  const funnelPanel = html("div", "panel reveal d1", `<div class="panel-h"><span style="color:var(--violet)">${icon("pulse", 15)}</span><span class="t">Purchase funnel</span></div>`);
  const fb = h("div", "panel-b");
  const views = sel.totalViews();
  const carts = Math.round(views * 0.061);
  const checkout = Math.round(carts * 0.42);
  fb.appendChild(funnelBar("Product views", views, views, "#00ff88"));
  fb.appendChild(funnelBar("Add to cart", carts, views, "#3fc0ff"));
  fb.appendChild(funnelBar("Checkout started", checkout, views, "#b48cff"));
  fb.appendChild(funnelBar("Purchases", s.orders.length, views, "#ffb020"));
  const leak = html("div", "decision", `<div style="font-size:12px;line-height:1.6"><b style="color:var(--warn)">Leak found:</b> 58% abandon at checkout. M-Pesa STK push + WhatsApp cart recovery are the highest-ROI fixes.</div>`);
  fb.appendChild(leak);
  funnelPanel.appendChild(fb);
  row1.appendChild(trafficPanel);
  row1.appendChild(funnelPanel);

  const row2 = h("div", "grid xl:grid-cols-2 gap-4");
  const ig = s.social.instagram;
  const tk = s.social.tiktok;
  const metaErr = s.integrations.find((i) => i.id === "meta")?.status === "error";

  function socialCard(name: string, color: string, st: { followers: number; growth7d: number; engRate: number; reach: number[] }, degraded: boolean, ic: string): HTMLElement {
    const p = html("div", "panel reveal d2", `
      <div class="panel-h"><span style="color:${color}">${icon(ic, 15)}</span><span class="t">${name}</span>
        ${degraded ? `<span class="badge danger" style="margin-left:auto">CACHED DATA</span>` : `<span class="badge ok" style="margin-left:auto">LIVE</span>`}</div>
      <div class="panel-b">
        <div style="display:flex;gap:22px;flex-wrap:wrap;margin-bottom:12px">
          <div><div class="kpi-label">Followers</div><div class="mono" style="font-size:20px;font-weight:700;font-family:'Chakra Petch'">${num(st.followers)}</div></div>
          <div><div class="kpi-label">7d growth</div><div class="mono" style="font-size:20px;font-weight:700;font-family:'Chakra Petch';color:var(--acc)">+${num(st.growth7d)}</div></div>
          <div><div class="kpi-label">Engagement</div><div class="mono" style="font-size:20px;font-weight:700;font-family:'Chakra Petch'">${st.engRate}%</div></div>
        </div>
        <canvas class="soc-cv" style="width:100%;height:70px;display:block"></canvas>
        ${degraded ? `<div style="margin-top:10px;font-size:12px;color:var(--warn);display:flex;gap:8px;align-items:center">${icon("warn", 13)} API rate-limited — module kept running on cache. <button class="btn btn-sm" data-retry>Retry now</button></div>` : ""}
      </div>`);
    const scv = p.querySelector(".soc-cv") as HTMLCanvasElement;
    requestAnimationFrame(() => areaChart(scv, st.reach, color));
    const retry = p.querySelector("[data-retry]");
    if (retry)
      retry.addEventListener("click", () => {
        store.setIntegration("meta", "connected");
        store.addAudit("SYSTEM", "Integrations", "Manual retry — Meta Graph reconnected", "READ", "EXECUTED");
        toast("Meta Graph API reconnected — live data resumed.", "ok");
        sfx.ding();
        const badge = p.querySelector(".panel-h .badge");
        if (badge) {
          badge.className = "badge ok";
          (badge as HTMLElement).style.marginLeft = "auto";
          badge.textContent = "LIVE";
        }
        (retry.parentElement as HTMLElement | null)?.remove();
      });
    return p;
  }

  row2.appendChild(socialCard("Instagram", "#b48cff", ig, metaErr, "chart"));
  row2.appendChild(socialCard("TikTok", "#00ff88", tk, false, "pulse"));

  const anomaly = html("div", "panel reveal d3", `
    <div class="panel-h"><span style="color:var(--warn)">${icon("cpu", 15)}</span><span class="t">AI anomaly detection</span></div>
    <div class="panel-b" style="display:flex;flex-direction:column;gap:10px;font-size:12.5px;line-height:1.6">
      <div class="decision"><div class="row"><span class="k">Signal</span><span>Traffic ↑ 32% WoW but purchases flat — product-page conversion dropped from 2.4% to 1.9%.</span></div><div class="row"><span class="k">Likely cause</span><span>New EliteBook photos load slowly on 3G (LCP 4.1s).</span></div><div class="row"><span class="k">Action</span><span>Compress images / lazy-load — est. +0.4pt conversion.</span></div></div>
      <div class="decision"><div class="row"><span class="k">Signal</span><span>T480 TikTok reach ↑ 2.1× after review video.</span></div><div class="row"><span class="k">Action</span><span>Pin video + duplicate format for X1 Carbon.</span></div></div>
      <div class="decision"><div class="row"><span class="k">Signal</span><span>WhatsApp orders close 40% faster than WooCommerce checkout.</span></div><div class="row"><span class="k">Action</span><span>Add “Order via WhatsApp” button on product pages.</span></div></div>
    </div>`);

  root.appendChild(row1);
  root.appendChild(row2);
  root.appendChild(anomaly);

  requestAnimationFrame(() => {
    const reach = sel.viewsSeries(14);
    const storeViews = reach.map((v) => Math.round(v * 0.55));
    areaChart(cv, reach, "#00ff88", { data2: storeViews, color2: "#3fc0ff" });
  });

  const unsub = store.on((e) => {
    if (e.kind === "social" || e.kind === "order" || e.kind === "tick")
      requestAnimationFrame(() => {
        const reach = sel.viewsSeries(14);
        areaChart(cv, reach, "#00ff88", { data2: reach.map((v) => Math.round(v * 0.55)), color2: "#3fc0ff" });
      });
  });
  return { el: root, destroy: unsub };
}

/* ============================================================
   AUTOMATIONS
   ============================================================ */
export function renderAutomations(): View {
  const root = h("div", "grid gap-4");

  const sim = html("div", "panel reveal", `
    <div class="panel-h"><span style="color:var(--warn)">${icon("zap", 15)}</span><span class="t">Webhook simulator</span><span class="badge mut" style="margin-left:auto">dev tool — fires real events through the pipeline</span></div>
    <div class="panel-b flex gap-2 flex-wrap">
      <button class="btn btn-acc" id="simOrder">${icon("cart", 13)} Fire order webhook</button>
      <button class="btn" id="simStock">${icon("box", 13)} Fire low-stock event</button>
      <button class="btn btn-danger" id="simFail">${icon("warn", 13)} Simulate Meta API failure</button>
      <button class="btn" id="simReport">${icon("doc", 13)} Trigger daily report</button>
    </div>`);
  root.appendChild(sim);

  const grid = h("div", "grid xl:grid-cols-2 gap-4");
  const wfWrap = h("div", "grid gap-4");

  function paint() {
    wfWrap.innerHTML = "";
    store.state.workflows.forEach((w, idx) => {
      const card = html("div", `panel reveal d${(idx % 4) + 1}`, `
        <div class="panel-h">
          <span style="color:${w.enabled ? "var(--acc)" : "var(--txt-3)"}">${icon("zap", 15)}</span>
          <span class="t" style="color:${w.enabled ? "var(--txt)" : "var(--txt-3)"}">${esc(w.name)}</span>
          <span class="mono" style="margin-left:auto;font-size:10.5px;color:var(--txt-3)">${w.runs} runs${w.lastRun ? " · last " + timeAgo(w.lastRun) : ""}</span>
        </div>
        <div class="panel-b">
          <div class="mono" style="font-size:11px;color:var(--info);margin-bottom:10px">TRIGGER · ${esc(w.trigger)}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${w.steps.map((st) => `<span class="node-box" style="padding:6px 10px">${esc(st)}</span>`).join(`<span class="node-arr">→</span>`)}
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:14px">
            <div class="toggle ${w.enabled ? "on" : ""}" data-tgl="${w.id}" role="switch" aria-label="toggle ${esc(w.name)}"></div>
            <span style="font-size:12px;color:var(--txt-2)">${w.enabled ? "Armed — listening" : "Paused"}</span>
            <button class="btn btn-sm" data-run="${w.id}" style="margin-left:auto">${icon("play", 11)} Test run</button>
          </div>
        </div>`);
      wfWrap.appendChild(card);
    });
    wfWrap.querySelectorAll("[data-tgl]").forEach((t) =>
      t.addEventListener("click", () => {
        store.toggleWorkflow((t as HTMLElement).getAttribute("data-tgl")!);
        sfx.ding();
        paint();
      })
    );
    wfWrap.querySelectorAll("[data-run]").forEach((b) =>
      b.addEventListener("click", () => {
        store.runWorkflow((b as HTMLElement).getAttribute("data-run")!);
        sfx.ding();
        toast(`Workflow test run complete — all steps green. Check the audit log.`, "info");
        paint();
        paintLog();
      })
    );
  }

  const logPanel = html("div", "panel reveal d2", `<div class="panel-h"><span style="color:var(--violet)">${icon("doc", 15)}</span><span class="t">Run log</span><span class="badge mut" style="margin-left:auto">Automation + Audit trail</span></div>
    <div class="panel-b scroll-thin" id="runLog" style="max-height:560px;overflow-y:auto;padding:8px 16px"></div>`);
  const logEl = logPanel.querySelector("#runLog") as HTMLElement;

  function paintLog() {
    logEl.innerHTML = store.state.audit
      .filter((a) => a.module === "Automation" || a.module === "E-commerce" || a.module === "BI")
      .slice(0, 14)
      .map(
        (a) => `<div class="feed-row"><span style="color:${a.outcome === "DENIED" ? "var(--danger)" : a.scope === "FINANCIAL" ? "var(--warn)" : "var(--acc)"};flex:none;margin-top:1px">${icon("zap", 13)}</span>
        <div style="flex:1;line-height:1.5">${esc(a.action)}<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">${a.actor} · ${a.module} · ${a.scope} · ${a.outcome} · ${timeAgo(a.at)}</div></div></div>`
      )
      .join("");
  }

  paint();
  paintLog();
  grid.appendChild(wfWrap);
  grid.appendChild(logPanel);
  root.appendChild(grid);

  /* simulator wiring */
  sim.querySelector("#simOrder")!.addEventListener("click", () => {
    /* the 'order' event triggers cash sound + screen flash + toast globally */
    store.recordOrder();
  });
  sim.querySelector("#simStock")!.addEventListener("click", () => {
    const p = store.state.products.find((x) => x.stock > 2);
    if (p) {
      p.stock = 2;
      store.addAudit("AI", "Automation", `Low-Stock Sentinel: ${p.name} → 2 left, reorder draft created`, "READ", "LOGGED");
      store.pushNotice("alert", `${p.name} low stock — 2 left, selling ${p.velocity}/week. Reorder suggested.`);
      store.emit("alert", p.name);
      sfx.ding();
      toast(`⚠️ ${esc(p.name)} is low on stock — reorder recommendation generated.`, "warn");
    }
  });
  sim.querySelector("#simFail")!.addEventListener("click", () => {
    store.setIntegration("meta", "error");
    store.addAudit("SYSTEM", "Integrations", "Meta Graph API error 17 — isolated, cache fallback engaged", "READ", "LOGGED");
    store.pushNotice("alert", "Meta Graph API rate-limited (error 17) — social module running on cached data.");
    store.emit("alert");
    sfx.err();
    toast(`Instagram API failed — system isolated the error and fell back to cache. Nothing crashed.`, "danger");
  });
  sim.querySelector("#simReport")!.addEventListener("click", () => {
    store.addAudit("AI", "BI", "Daily report generated + dispatched (Telegram)", "READ", "EXECUTED");
    store.pushNotice("ai", `💰 Today's profit: ${ksh(sel.profitToday())} on ${ksh(sel.revenueToday())} revenue. Full report sent.`);
    store.emit("ai");
    sfx.ding();
    toast(`Daily report compiled from 8 sources and sent to Telegram.`, "info");
  });

  const unsub = store.on((e) => {
    if (e.kind === "order" || e.kind === "system" || e.kind === "alert") {
      paint();
      paintLog();
    }
  });
  return { el: root, destroy: unsub };
}
