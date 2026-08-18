/* ============================================================
   NEXUS//OS — Integrations · AI Tutor · Audit · Settings · Blueprint
   ============================================================ */
import { sel, store } from "../store";
import { esc, h, html, icon, ksh, modal, timeAgo, toast } from "../ui";
import { sfx } from "../sound";
import type { View } from "./command";

/* ============================================================
   INTEGRATIONS
   ============================================================ */
export function renderIntegrations(): View {
  const root = h("div", "grid gap-4");
  const head = html("div", "panel reveal", `
    <div class="panel-h"><span style="color:var(--acc)">${icon("plug", 15)}</span><span class="t">Integration manager</span>
    <span class="badge mut" style="margin-left:auto">official APIs + webhooks only — no scraping, ever</span></div>
    <div class="panel-b" style="font-size:12.5px;color:var(--txt-2);line-height:1.7">
      Every connection is scoped: <span class="badge ok">READ</span> <span class="badge info">WRITE</span> <span class="badge warn">FINANCIAL</span> <span class="badge vio">ADMIN</span>.
      The AI can never act above its scope, and FINANCIAL actions always wait for your approval.
    </div>`);
  root.appendChild(head);

  const grid = h("div", "grid md:grid-cols-2 xl:grid-cols-3 gap-4");

  function paint() {
    grid.innerHTML = "";
    store.state.integrations.forEach((it, i) => {
      const statusBadge =
        it.status === "connected"
          ? `<span class="badge ok"><span class="live-dot" style="width:6px;height:6px"></span>CONNECTED</span>`
          : it.status === "error"
          ? `<span class="badge danger">ERROR</span>`
          : `<span class="badge mut">OFF</span>`;
      const card = html("div", `panel reveal d${(i % 4) + 1}`, `
        <div class="panel-b" style="height:100%;display:flex;flex-direction:column">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="display:flex;gap:11px;align-items:center">
              <span style="width:38px;height:38px;border-radius:9px;display:grid;place-items:center;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.25);color:var(--acc)">${icon(it.id === "woo" || it.id === "wp" ? "box" : it.id === "telegram" ? "send" : it.id === "openai" ? "cpu" : it.id === "zapier" ? "zap" : "chart", 18)}</span>
              <div>
                <div style="font-family:'Chakra Petch';font-weight:700;font-size:14px">${esc(it.name)}</div>
                <div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">${it.free ? "FREE TIER" : "PAID · usage-based"}</div>
              </div>
            </div>
            ${statusBadge}
          </div>
          <div style="font-size:12px;color:var(--txt-2);margin:12px 0;line-height:1.55">${esc(it.desc)}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${it.scopes.map((sc) => `<span class="badge ${sc === "READ" ? "ok" : sc === "WRITE" ? "info" : sc === "FINANCIAL" ? "warn" : "vio"}">${sc}</span>`).join("")}</div>
          <div style="margin-top:auto;padding-top:14px;display:flex;align-items:center;gap:10px">
            <span class="mono" style="font-size:10.5px;color:var(--txt-3)">${it.status === "connected" ? "synced " + it.syncMin + "m ago" : it.status === "error" ? "cache fallback active" : "not connected"}</span>
            <span style="margin-left:auto"></span>
            ${
              it.status === "connected"
                ? `<button class="btn btn-sm btn-danger" data-act="disc" data-id="${it.id}">Disconnect</button>`
                : it.status === "error"
                ? `<button class="btn btn-sm" data-act="retry" data-id="${it.id}">${icon("refresh", 11)} Retry</button>`
                : `<button class="btn btn-sm btn-acc" data-act="conn" data-id="${it.id}">Connect</button>`
            }
          </div>
        </div>`);
      grid.appendChild(card);
    });

    grid.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", async () => {
        const id = (b as HTMLElement).getAttribute("data-id")!;
        const act = (b as HTMLElement).getAttribute("data-act")!;
        const it = store.state.integrations.find((x) => x.id === id)!;
        if (act === "conn") {
          (b as HTMLButtonElement).disabled = true;
          (b as HTMLButtonElement).textContent = "OAuth handshake…";
          window.setTimeout(() => {
            store.connectIntegration(id);
            toast(`${esc(it.name)} connected with scopes ${it.scopes.join(", ")}.`, "ok");
            sfx.ding();
            paint();
          }, 900);
        } else if (act === "disc") {
          const ok = await modal({
            title: "DISCONNECT " + it.name.toUpperCase(),
            bodyHtml: `<p style="font-size:13px;color:var(--txt-2);line-height:1.7">Modules that depend on ${esc(it.name)} will degrade gracefully (cached data + clear “degraded” flags). You can reconnect anytime.</p>`,
            confirmLabel: "Disconnect",
            tone: "danger",
          });
          if (ok) {
            store.setIntegration(id, "disconnected");
            store.addAudit("YOU", "Integrations", `Disconnected ${it.name}`, "ADMIN", "EXECUTED");
            paint();
          }
        } else {
          store.setIntegration(id, "connected");
          store.addAudit("SYSTEM", "Integrations", `Retry — ${it.name} reconnected`, "READ", "EXECUTED");
          toast(`${esc(it.name)} recovered — live sync resumed.`, "ok");
          sfx.ding();
          paint();
        }
      })
    );
  }
  paint();
  root.appendChild(grid);
  const unsub = store.on((e) => {
    if (e.kind === "alert" || e.kind === "system") paint();
  });
  return { el: root, destroy: unsub };
}

/* ============================================================
   AI TUTOR
   ============================================================ */
const LESSONS = [
  { id: "l-woo", title: "WooCommerce webhooks end-to-end", tool: "WooCommerce", mins: 12, level: "Beginner", money: "Every order lands in your DB + phone in <2s — zero manual entry.", steps: ["WooCommerce → Settings → Advanced → Webhooks → Add", "Topic: Order created · Delivery URL: your Express /hooks/woo endpoint", "Secret: generate + store in .env, verify HMAC-SHA256 on receive", "Respond 200 fast, process async via a queue", "Test with a real KSh 1 order, watch the audit log"] },
  { id: "l-wp", title: "Connect WordPress REST API safely", tool: "WordPress", mins: 8, level: "Beginner", money: "Auto-publish every laptop listing as an SEO-ready page.", steps: ["Users → Profile → Application Passwords → create one", "Store user + password in .env (never in frontend code)", "GET /wp-json/wp/v2/posts to verify access", "Use Rank Math REST fields to set SEO title + schema", "Add a WordPress webhook for form leads (Fluent Forms)"] },
  { id: "l-zap", title: "Zapier & n8n: your free automation team", tool: "Zapier / n8n", mins: 15, level: "Beginner", money: "Sell KSh 30,000+ automation setups to local businesses.", steps: ["Zapier: Zaps → Webhooks by Zapier → Catch Hook", "Paste the catch-hook URL into NEXUS workflows", "Fire a test event from the Automations simulator", "n8n alternative: self-host free, unlimited runs", "Package: lead form → CRM → WhatsApp reply → your phone"] },
  { id: "l-ga4", title: "GA4 Data API for profit people", tool: "Google Analytics", mins: 18, level: "Intermediate", money: "Find the checkout leak worth +10% revenue.", steps: ["Create a service account in GCP, enable GA4 Data API", "Grant Viewer on the property", "Run report: sessions, addToCarts, purchases by day", "Compute step conversion rates — the drop is your money leak", "Alert when conversion falls below its 14-day average"] },
  { id: "l-meta", title: "Meta Graph: know your reel economics", tool: "Meta / Instagram", mins: 14, level: "Intermediate", money: "Attribute real sales to posts; cut ads that earn nothing.", steps: ["Meta for Developers → app → Instagram Graph API", "Long-lived token via OAuth, refresh every 50 days", "Pull reach, impressions, profile_views per reel", "Match spikes to order timestamps (UTM links help)", "Respect rate limits: cache + queue, degrade gracefully"] },
];

export function renderTutor(): View {
  const root = h("div", "grid gap-4");
  const s = store.state;
  const done = s.lessonsDone.length;

  const next = [...s.skills].sort((a, b) => b.demand - b.demand + a.level - (a.level - b.level + b.level))[0];
  const best = [...s.skills].sort((a, b) => b.demand - a.level * 0.4 - (a.demand - a.level * 0.4))[0];

  const hero = html("div", "panel reveal", `
    <div class="panel-h"><span style="color:var(--violet)">${icon("cap", 15)}</span><span class="t">AI Tutor & skill coach</span><span class="badge vio" style="margin-left:auto">${done}/${LESSONS.length} lessons done</span></div>
    <div class="panel-b" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:260px">
        <div style="font-family:'Chakra Petch';font-weight:700;font-size:19px;line-height:1.35">Next highest-income skill: <span style="color:var(--acc)">${esc(best.name)}</span></div>
        <div style="font-size:13px;color:var(--txt-2);margin-top:6px;line-height:1.6">Demand ${best.demand}/100, your level ${best.level}/100. Mastering it lets you sell automation setups (${ksh(30000)}+) and run your own ops hands-free. Every new tool you connect gets a plain-language lesson here — what it does, how to automate it, how it makes money.</div>
      </div>
      <div class="bar-track" style="flex:1;min-width:200px;height:9px"><div class="bar-fill" style="width:${(done / LESSONS.length) * 100}%;background:var(--violet)"></div></div>
    </div>`);
  root.appendChild(hero);

  const grid = h("div", "grid xl:grid-cols-3 gap-4");
  const lessonsCol = h("div", "xl:col-span-2 grid gap-3");
  LESSONS.forEach((ls, i) => {
    const isDone = s.lessonsDone.includes(ls.id);
    const card = html("div", `panel reveal d${(i % 4) + 1}`, `
      <div class="panel-b" style="display:flex;gap:14px;align-items:flex-start;cursor:pointer" data-lesson="${ls.id}">
        <span style="width:36px;height:36px;flex:none;border-radius:9px;display:grid;place-items:center;border:1px solid ${isDone ? "rgba(0,255,136,0.4)" : "var(--line-2)"};background:${isDone ? "rgba(0,255,136,0.1)" : "var(--panel-2)"};color:${isDone ? "var(--acc)" : "var(--txt-3)"}">${icon(isDone ? "check" : "book", 16)}</span>
        <div style="flex:1">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span style="font-family:'Chakra Petch';font-weight:700;font-size:14px">${esc(ls.title)}</span>
            <span class="badge mut">${esc(ls.tool)}</span><span class="badge info">${ls.mins} min</span><span class="badge ${isDone ? "ok" : "mut"}">${isDone ? "DONE" : esc(ls.level)}</span>
          </div>
          <div style="font-size:12.5px;color:var(--acc);margin-top:5px">💡 ${esc(ls.money)}</div>
        </div>
        <span style="color:var(--txt-3)">${icon("arrow", 15)}</span>
      </div>`);
    card.addEventListener("mouseenter", () => (card.style.borderColor = "rgba(0,255,136,0.35)"));
    card.addEventListener("mouseleave", () => (card.style.borderColor = "var(--line)"));
    card.querySelector("[data-lesson]")!.addEventListener("click", async () => {
      await modal({
        title: ls.title.toUpperCase(),
        wide: true,
        bodyHtml: `<div style="font-size:13px;line-height:1.8">${ls.steps.map((st, j) => `<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed rgba(255,255,255,0.06)"><span class="mono" style="color:var(--acc);font-weight:700">${String(j + 1).padStart(2, "0")}</span><span>${esc(st)}</span></div>`).join("")}</div>
        <div class="decision" style="margin-top:12px"><div style="font-size:12.5px">💡 <b>Money angle:</b> ${esc(ls.money)}</div></div>`,
        confirmLabel: s.lessonsDone.includes(ls.id) ? "Done ✓ (again)" : "Mark complete",
        cancelLabel: "Close",
      }).then((ok) => {
        if (ok && !s.lessonsDone.includes(ls.id)) {
          store.lessonDone(ls.id);
          toast(`Lesson complete — skill map updated. ${esc(ls.tool)} +1.`, "ok");
          sfx.ding();
          paintSkills();
        }
      });
    });
    lessonsCol.appendChild(card);
  });

  const skillCol = html("div", "panel reveal d2", `<div class="panel-h"><span style="color:var(--acc)">${icon("chart", 15)}</span><span class="t">Skill map</span></div><div class="panel-b" id="skillMap"></div>`);
  const skillMap = skillCol.querySelector("#skillMap") as HTMLElement;
  function paintSkills() {
    skillMap.innerHTML = [...store.state.skills]
      .sort((a, b) => b.demand - a.demand)
      .map(
        (sk) => `<div style="margin-bottom:13px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><span>${esc(sk.name)}</span><span class="mono" style="font-size:10.5px;color:var(--txt-3)">lvl ${sk.level} · demand ${sk.demand}</span></div>
        <div style="display:flex;gap:5px;align-items:center">
          <div class="bar-track" style="flex:1"><div class="bar-fill${sk.demand > 85 && sk.level < 50 ? " w" : ""}" style="width:${sk.level}%"></div></div>
          ${sk.demand > 85 && sk.level < 50 ? `<span class="badge warn">GAP</span>` : ""}
        </div></div>`
      )
      .join("");
  }
  paintSkills();

  grid.appendChild(lessonsCol);
  grid.appendChild(skillCol);
  root.appendChild(grid);
  void next;
  return { el: root };
}

/* ============================================================
   AUDIT LOG
   ============================================================ */
export function renderAudit(): View {
  const root = h("div", "grid gap-4");
  let actor = "all";
  let scope = "all";

  const panel = html("div", "panel reveal", `<div class="panel-h"><span style="color:var(--warn)">${icon("shield", 15)}</span><span class="t">Audit trail — every AI decision & action</span><span class="badge mut" style="margin-left:auto">immutable by design</span></div>`);
  const filterRow = h("div", "flex gap-2 flex-wrap");
  filterRow.style.padding = "12px 16px 0";
  const body = h("div", "scroll-thin");
  body.style.overflowX = "auto";

  function paint() {
    filterRow.innerHTML = "";
    ["all", "AI", "YOU", "SYSTEM"].forEach((a) => {
      const c = h("button", "chip", a === "all" ? "All actors" : a);
      if (actor === a) c.style.cssText = "color:var(--acc);border-color:rgba(0,255,136,0.5);background:rgba(0,255,136,0.08)";
      c.addEventListener("click", () => { actor = a; paint(); });
      filterRow.appendChild(c);
    });
    ["all", "READ", "WRITE", "FINANCIAL", "ADMIN"].forEach((sc) => {
      const c = h("button", "chip", sc === "all" ? "All scopes" : sc);
      if (scope === sc) c.style.cssText = "color:var(--info);border-color:rgba(63,192,255,0.5);background:rgba(63,192,255,0.08)";
      c.addEventListener("click", () => { scope = sc; paint(); });
      filterRow.appendChild(c);
    });

    const rows = store.state.audit
      .filter((a) => (actor === "all" || a.actor === actor) && (scope === "all" || a.scope === scope))
      .slice(0, 60)
      .map(
        (a) => `<tr>
        <td class="mono" style="font-size:11px;color:var(--txt-3);white-space:nowrap">${new Date(a.at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" })} ${new Date(a.at).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
        <td><span class="badge ${a.actor === "AI" ? "vio" : a.actor === "YOU" ? "ok" : "mut"}">${a.actor}</span></td>
        <td class="mono" style="font-size:11px;color:var(--txt-2)">${esc(a.module)}</td>
        <td style="max-width:420px;line-height:1.5">${esc(a.action)}</td>
        <td><span class="badge ${a.scope === "READ" ? "ok" : a.scope === "WRITE" ? "info" : a.scope === "FINANCIAL" ? "warn" : "vio"}">${a.scope}</span></td>
        <td><span class="badge ${a.outcome === "DENIED" ? "danger" : a.outcome === "PENDING" ? "warn" : "ok"}">${esc(a.outcome)}</span></td>
      </tr>`
      )
      .join("");
    body.innerHTML = `<table class="tbl"><thead><tr><th>Time</th><th>Actor</th><th>Module</th><th>Action</th><th>Scope</th><th>Outcome</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  paint();
  panel.appendChild(filterRow);
  panel.appendChild(body);
  root.appendChild(panel);
  const unsub = store.on(() => paint());
  return { el: root, destroy: unsub };
}

/* ============================================================
   SETTINGS
   ============================================================ */
export function renderSettings(): View {
  const root = h("div", "grid xl:grid-cols-2 gap-4");
  const s = store.state;

  function toggleRow(label: string, desc: string, get: () => boolean, set: (v: boolean) => void): HTMLElement {
    const row = h("div", "");
    row.style.cssText = "display:flex;gap:12px;align-items:center;padding:11px 0;border-bottom:1px dashed rgba(255,255,255,0.06)";
    row.innerHTML = `<div style="flex:1"><div style="font-size:13.5px;font-weight:600">${label}</div><div style="font-size:12px;color:var(--txt-2);margin-top:2px">${desc}</div></div>`;
    const tg = h("div", "toggle" + (get() ? " on" : ""));
    tg.addEventListener("click", () => {
      set(!get());
      tg.classList.toggle("on", get());
      sfx.ding();
    });
    row.appendChild(tg);
    return row;
  }

  /* sound + notifications */
  const sndPanel = html("div", "panel reveal", `<div class="panel-h"><span style="color:var(--acc)">${icon(s.settings.sound ? "sndOn" : "sndOff", 15)}</span><span class="t">Sound & notifications</span></div>`);
  const sndBody = h("div", "panel-b");
  sndBody.appendChild(toggleRow("Sound effects", "Cash register on sale · ding on AI actions", () => store.state.settings.sound, (v) => store.setSettings({ sound: v })));
  const volRow = h("div", "");
  volRow.style.cssText = "padding:11px 0;border-bottom:1px dashed rgba(255,255,255,0.06)";
  volRow.innerHTML = `<div style="font-size:13.5px;font-weight:600;margin-bottom:8px">Volume</div>`;
  const vol = document.createElement("input");
  vol.type = "range";
  vol.min = "0";
  vol.max = "1";
  vol.step = "0.05";
  vol.value = String(s.settings.volume);
  vol.style.cssText = "width:100%;accent-color:var(--acc);padding:0;background:transparent;border:none";
  vol.addEventListener("input", () => store.setSettings({ volume: parseFloat(vol.value) }));
  volRow.appendChild(vol);
  sndBody.appendChild(volRow);
  sndBody.appendChild(toggleRow("Telegram alerts", "🔔 orders · ⚠️ low stock · 💰 daily profit → your phone", () => store.state.settings.telegram, (v) => store.setSettings({ telegram: v })));
  sndBody.appendChild(toggleRow("Email digest", "Daily 19:00 EAT summary with AI recommendations", () => store.state.settings.email, (v) => store.setSettings({ email: v })));
  sndBody.appendChild(toggleRow("Push notifications", "Browser push for FINANCIAL approval requests", () => store.state.settings.push, (v) => store.setSettings({ push: v })));
  sndBody.appendChild(toggleRow("Live operations simulator", "Streams realistic webhooks (orders, spikes, failures) for demo", () => store.state.settings.sim, (v) => store.setSettings({ sim: v })));
  const testBtn = h("button", "btn", "Play cash-register test");
  testBtn.innerHTML = icon("sndOn", 13) + " Play cash-register test";
  testBtn.style.marginTop = "14px";
  testBtn.addEventListener("click", () => sfx.cash());
  sndBody.appendChild(testBtn);
  sndPanel.appendChild(sndBody);

  /* memory & privacy */
  const memPanel = html("div", "panel reveal d1", `<div class="panel-h"><span style="color:var(--violet)">${icon("db", 15)}</span><span class="t">Memory & privacy controls</span></div>`);
  const memBody = h("div", "panel-b");
  memBody.appendChild(toggleRow("Customer memory", "Remember names & purchase history. Off = masked everywhere.", () => store.state.memory.customers, (v) => store.setMemory({ customers: v })));
  memBody.appendChild(toggleRow("Finance memory", "Persist profit & expense history for trend analysis.", () => store.state.memory.finances, (v) => store.setMemory({ finances: v })));
  memBody.appendChild(toggleRow("Command history", "Let the AI use your past questions for context.", () => store.state.memory.commands, (v) => store.setMemory({ commands: v })));
  const danger = h("div", "");
  danger.style.cssText = "margin-top:16px;padding:14px;border:1px solid rgba(255,77,94,0.3);border-radius:8px;background:rgba(255,77,94,0.04)";
  danger.innerHTML = `<div style="font-family:'Chakra Petch';font-weight:700;font-size:12px;letter-spacing:0.12em;color:var(--danger);margin-bottom:6px">DANGER ZONE</div><div style="font-size:12px;color:var(--txt-2);margin-bottom:10px">Wipe local memory and reseed the demo database. Requires ADMIN confirmation.</div>`;
  const wipe = h("button", "btn btn-danger btn-sm", "Wipe memory & reseed");
  wipe.addEventListener("click", async () => {
    const ok = await modal({ title: "ADMIN — WIPE MEMORY", bodyHtml: `<p style="font-size:13px;color:var(--txt-2)">This clears all locally stored orders, customers, audit entries and settings, then reseeds the demo snapshot. Cannot be undone.</p><div class="badge vio" style="margin-top:8px">SCOPE: ADMIN</div>`, confirmLabel: "Wipe everything", tone: "danger" });
    if (ok) {
      store.reset();
      toast("Memory wiped — database reseeded.", "warn");
      sfx.err();
      window.location.reload();
    }
  });
  const exportBtn = h("button", "btn btn-sm", "Export JSON");
  exportBtn.style.marginLeft = "8px";
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nexus-os-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
    store.addAudit("YOU", "Memory", "Exported full database snapshot (JSON)", "ADMIN", "EXECUTED");
    toast("Database snapshot exported.", "ok");
  });
  danger.appendChild(wipe);
  danger.appendChild(exportBtn);
  memBody.appendChild(danger);
  memPanel.appendChild(memBody);

  root.appendChild(sndPanel);
  root.appendChild(memPanel);
  return { el: root };
}

/* ============================================================
   BLUEPRINT — architecture, schema, APIs, roadmap
   ============================================================ */
export function renderBlueprint(): View {
  const root = h("div", "grid gap-4");

  /* diagram */
  const diagram = html("div", "panel reveal", `
    <div class="panel-h"><span style="color:var(--acc)">${icon("hex", 15)}</span><span class="t">System architecture</span><span class="badge ok" style="margin-left:auto">this prototype runs the same pipeline in-browser</span></div>
    <div class="panel-b">
      <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:8px;align-items:stretch" id="archRow">
        <div class="node-box" style="border-color:rgba(0,255,136,0.4)"><div class="mono" style="font-size:9px;color:var(--txt-3)">LAYER 1</div><b style="font-family:'Chakra Petch'">Dashboard</b><div style="font-size:10.5px;color:var(--txt-2);margin-top:4px">Vanilla HTML/CSS/JS<br/>sound + flash + charts</div></div>
        <div class="node-arr">→</div>
        <div class="node-box" style="border-color:rgba(0,255,136,0.4)"><div class="mono" style="font-size:9px;color:var(--txt-3)">LAYER 2</div><b style="font-family:'Chakra Petch'">AI Orchestrator</b><div style="font-size:10.5px;color:var(--txt-2);margin-top:4px">Express.js + Socket.io<br/>intent router · RBAC · audit</div></div>
        <div class="node-arr">→</div>
        <div class="node-box" style="border-color:rgba(0,255,136,0.4)"><div class="mono" style="font-size:9px;color:var(--txt-3)">LAYER 3</div><b style="font-family:'Chakra Petch'">Tool / API layer</b><div style="font-size:10.5px;color:var(--txt-2);margin-top:4px">modular adapters<br/>each fails independently</div></div>
        <div class="node-arr">→</div>
        <div class="node-box" style="border-color:rgba(0,255,136,0.4)"><div class="mono" style="font-size:9px;color:var(--txt-3)">LAYER 4</div><b style="font-family:'Chakra Petch'">Data + Services</b><div style="font-size:10.5px;color:var(--txt-2);margin-top:4px">PostgreSQL / Supabase<br/>Telegram · OpenAI · Zapier</div></div>
      </div>
      <div class="tree" style="margin-top:16px;border:1px solid var(--line);border-radius:8px;padding:12px;background:#141416">LOOP  ·  OBSERVE → ANALYZE → EXPLAIN → RECOMMEND → <span class="d">ASK FOR APPROVAL</span> → EXECUTE → VERIFY → RECORD</div>
      <div style="margin-top:14px;font-size:12.5px;color:var(--txt-2);line-height:1.7">19 modules: <span class="mono" style="font-size:11px">AI-Brain · Business-Intelligence · E-commerce · WordPress · Social · Marketing · Freelancing · CRM · Finance · Notifications · Automation · AI-Tutor · Security · Logging · Analytics · Memory · Settings · Integrations · Webhooks</span></div>
    </div>`);

  /* folder tree */
  const tree = html("div", "panel reveal d1", `
    <div class="panel-h"><span style="color:var(--info)">${icon("doc", 15)}</span><span class="t">Project structure (production)</span></div>
    <div class="panel-b"><div class="tree" style="background:#141416;border:1px solid var(--line);border-radius:8px;padding:14px">nexus-os/
├─ <span class="d">server/</span>
│  ├─ index.js              <span class="c"># Express + Socket.io bootstrap, .env loading</span>
│  ├─ <span class="d">orchestrator/</span>        <span class="c"># AI Brain: intent router, OpenAI tool-calling, RBAC gates</span>
│  ├─ <span class="d">modules/</span>
│  │  ├─ ecommerce.js      <span class="c"># orders, stock, velocity, profit</span>
│  │  ├─ wordpress.js      <span class="c"># WP REST + WooCommerce REST + webhooks</span>
│  │  ├─ social.js         <span class="c"># Meta Graph + TikTok Business</span>
│  │  ├─ marketing.js      <span class="c"># campaigns, ROAS, attribution</span>
│  │  ├─ freelance.js      <span class="c"># CRM: leads, proposals, deadlines</span>
│  │  ├─ finance.js        <span class="c"># expenses, P&L, forecasting</span>
│  │  ├─ analytics.js      <span class="c"># GA4 Data API, funnels, anomalies</span>
│  │  ├─ notifications.js  <span class="c"># Telegram / Email / Push dispatcher</span>
│  │  ├─ automation.js     <span class="c"># Zapier / Make / n8n webhook bridge</span>
│  │  ├─ tutor.js          <span class="c"># lessons + skill map</span>
│  │  └─ memory.js         <span class="c"># persistent memory + privacy scopes</span>
│  ├─ <span class="d">integrations/</span>        <span class="c"># one adapter per service, isolated try/catch</span>
│  ├─ <span class="d">middleware/</span>          <span class="c"># rbac.js · audit.js · errors.js · hmac.js</span>
│  └─ <span class="d">db/</span> schema.sql · queries.js
├─ <span class="d">web/</span>                    <span class="c"># vanilla HTML5/CSS3/ES6+ (this dashboard, wired to socket.io)</span>
│  ├─ index.html · css/app.css
│  └─ js/ socket.js · views/ · sound.js · charts.js
└─ .env                     <span class="c"># keys live here ONLY — never in web/</span></div></div>`);

  /* schema */
  const SCHEMA: [string, string[]][] = [
    ["products", ["id PK", "name", "sku", "cost NUMERIC", "price NUMERIC", "stock INT", "views INT", "conv_rate NUMERIC", "velocity NUMERIC"]],
    ["orders", ["id PK", "customer_id FK", "product_id FK", "qty INT", "revenue NUMERIC", "profit NUMERIC", "status ENUM", "source ENUM", "created_at"]],
    ["customers", ["id PK", "name", "email UNIQUE", "total_spent", "orders_count", "last_purchase"]],
    ["expenses", ["id PK", "category", "amount NUMERIC", "recurring BOOL", "created_at"]],
    ["campaigns", ["id PK", "name", "platform ENUM", "spend", "conversions", "revenue_attrib"]],
    ["leads", ["id PK", "name", "service", "value", "stage ENUM", "deadline TIMESTAMPTZ"]],
    ["audit_log", ["id PK", "actor ENUM", "module", "action TEXT", "scope ENUM", "outcome ENUM", "created_at"]],
    ["memory", ["key PK", "value JSONB", "scope ENUM", "created_at", "expires_at"]],
  ];
  const schema = html("div", "panel reveal d2", `<div class="panel-h"><span style="color:var(--violet)">${icon("db", 15)}</span><span class="t">Database schema — PostgreSQL / Supabase</span></div>
    <div class="panel-b"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px">
    ${SCHEMA.map(([t, cols]) => `<div style="border:1px solid var(--line-2);border-radius:8px;overflow:hidden"><div class="mono" style="font-size:11px;font-weight:700;padding:7px 10px;background:rgba(0,255,136,0.07);color:var(--acc);border-bottom:1px solid var(--line)">${t}</div><div style="padding:8px 10px;font-size:11px;line-height:1.8;color:var(--txt-2)" class="mono">${cols.join("<br/>")}</div></div>`).join("")}
    </div></div>`);

  /* api matrix */
  const APIS: [string, string, string, string][] = [
    ["WooCommerce REST + webhooks", "orders, products, stock", "Free", "Phase 1"],
    ["WordPress REST + App Passwords", "pages, Fluent Forms, Rank Math", "Free", "Phase 2"],
    ["GA4 Data API", "traffic, funnels, behaviour", "Free", "Phase 3"],
    ["Meta Graph API", "Instagram/FB reach, engagement, ads", "Free (rate-limited)", "Phase 3"],
    ["TikTok Business API", "video stats, Spark Ads", "Free (approval)", "Phase 3"],
    ["Zapier / Make / n8n", "3-party automation webhooks", "Free tiers (n8n self-host = unlimited)", "Phase 2"],
    ["Telegram Bot API", "phone notifications + approval buttons", "Free", "Phase 2"],
    ["OpenAI gpt-4o-mini", "AI Brain tool-calling", "Paid — ~$0.15/1M input tokens", "Phase 1"],
    ["Supabase PostgreSQL", "hosted DB + realtime", "Free 500MB", "Phase 1"],
    ["Render / Railway / $5 VPS", "Express host", "Free tier → $5/mo", "Phase 1"],
  ];
  const apis = html("div", "panel reveal d3", `<div class="panel-h"><span style="color:var(--warn)">${icon("plug", 15)}</span><span class="t">Required APIs & accounts</span></div>
    <div class="scroll-thin" style="overflow-x:auto"><table class="tbl"><thead><tr><th>Service</th><th>Purpose</th><th>Cost</th><th>Phase</th></tr></thead><tbody>
    ${APIS.map(([a, b, c, d]) => `<tr><td style="font-weight:600">${a}</td><td style="color:var(--txt-2)">${b}</td><td><span class="badge ${c.startsWith("Free") ? "ok" : "warn"}">${c}</span></td><td><span class="badge mut">${d}</span></td></tr>`).join("")}
    </tbody></table></div>`);

  /* roadmap */
  const PHASES: [string, string, string, boolean][] = [
    ["Phase 1 — Core OS", "Dashboard, AI Brain intent router, BI selectors, audit, RBAC approvals, sound + flash, memory + privacy", "LIVE NOW — this prototype", true],
    ["Phase 2 — Real pipes", "Express + Socket.io server, Supabase schema, WooCommerce webhooks (HMAC), Telegram bot with inline approve buttons", "next", false],
    ["Phase 3 — Growth data", "GA4 Data API, Meta Graph + TikTok adapters with cache fallback, anomaly detection jobs", "planned", false],
    ["Phase 4 — Automation", "n8n self-host (free, unlimited), Zapier bridge, daily report cron, phone approvals end-to-end", "planned", false],
    ["Phase 5 — Foresight", "Forecasting models, per-product reorder automation (with FINANCIAL gates), tutor personalisation", "planned", false],
  ];
  const road = html("div", "panel reveal d4", `<div class="panel-h"><span style="color:var(--acc)">${icon("zap", 15)}</span><span class="t">Build roadmap</span></div>
    <div class="panel-b" style="display:grid;gap:10px">
    ${PHASES.map(([t, d, tag, live]) => `<div style="display:flex;gap:14px;padding:13px 14px;border:1px solid ${live ? "rgba(0,255,136,0.4)" : "var(--line)"};border-radius:8px;background:${live ? "rgba(0,255,136,0.04)" : "transparent"}">
      <span style="color:${live ? "var(--acc)" : "var(--txt-3)"};flex:none;margin-top:2px">${icon(live ? "play" : "clock", 16)}</span>
      <div style="flex:1"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-family:'Chakra Petch';font-size:14px">${t}</b><span class="badge ${live ? "ok" : "mut"}">${tag}</span></div>
      <div style="font-size:12.5px;color:var(--txt-2);margin-top:4px;line-height:1.6">${d}</div></div></div>`).join("")}
    </div>`);

  root.appendChild(diagram);
  const twoCol = h("div", "grid xl:grid-cols-2 gap-4");
  twoCol.appendChild(tree);
  twoCol.appendChild(schema);
  root.appendChild(twoCol);
  root.appendChild(apis);
  root.appendChild(road);

  if (window.innerWidth < 900) {
    const row = diagram.querySelector("#archRow") as HTMLElement | null;
    if (row) row.style.gridTemplateColumns = "1fr";
  }
  void sel;
  void ksh;
  return { el: root };
}
