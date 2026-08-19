/* ============================================================
   NEXUS//OS — Command Center view
   ============================================================ */
import { sel, store } from "../store";
import { ask, greetingHtml } from "../brain";
import { voice } from "../voice";
import { areaChart, countUp, esc, h, html, icon, ksh, modal, timeAgo } from "../ui";
import { sfx } from "../sound";

export interface View {
  el: HTMLElement;
  destroy?: () => void;
}

const QUICK = [
  "How much did I sell today?",
  "Which laptop made the most profit?",
  "Do I have new orders?",
  "What needs my attention today?",
  "Find opportunities",
  "Analyze my Instagram",
  "Teach me how to connect WordPress",
  "Generate daily report",
];

export function renderCommand(): View {
  const timers: number[] = [];
  const unsubs: (() => void)[] = [];
  const root = h("div", "grid gap-4");

  /* ---------------- KPI strip ---------------- */
  const kpiRow = h("div", "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 reveal");
  const kRev = h("div", "mono");
  const kProf = h("div", "mono");
  const kOrd = h("div", "mono");
  const kMarg = h("div", "mono");
  const kWow = h("div", "mono");
  const kpiDefs: [string, HTMLElement, string][] = [
    ["Revenue today", kRev, "pulse"],
    ["Profit today", kProf, "coins"],
    ["Orders today", kOrd, "cart"],
    ["Avg margin", kMarg, "chart"],
    ["Week over week", kWow, "zap"],
  ];
  kpiDefs.forEach(([label, node, ic], i) => {
    kpiRow.appendChild(
      html(
        "div",
        `panel kpi reveal d${i + 1}`,
        `<div style="display:flex;justify-content:space-between;align-items:center"><span class="kpi-label">${label}</span><span style="color:var(--txt-3)">${icon(ic, 15)}</span></div>`
      )
    );
    const card = kpiRow.lastElementChild as HTMLElement;
    node.style.fontSize = "26px";
    node.style.fontFamily = "'Chakra Petch', sans-serif";
    node.style.fontWeight = "700";
    node.style.marginTop = "6px";
    card.appendChild(node);
    const sub = h("div", "kpi-sub");
    sub.style.marginTop = "3px";
    card.appendChild(sub);
  });

  function paintKPIs(bump = false) {
    countUp(kRev, sel.revenueToday(), (n) => ksh(n));
    countUp(kProf, sel.profitToday(), (n) => ksh(n));
    countUp(kOrd, sel.ordersToday().length, (n) => String(Math.round(n)));
    kMarg.textContent = sel.avgMargin().toFixed(1) + "%";
    const wow = sel.weekOverWeek();
    kWow.textContent = (wow >= 0 ? "+" : "") + wow.toFixed(0) + "%";
    kWow.style.color = wow >= 0 ? "var(--acc)" : "var(--danger)";
    if (bump) {
      (kpiRow.firstElementChild as HTMLElement | null)?.classList.remove("bump");
      void (kpiRow.firstElementChild as HTMLElement | null)?.offsetWidth;
      (kpiRow.firstElementChild as HTMLElement | null)?.classList.add("bump");
    }
    const subs = kpiRow.querySelectorAll(".kpi-sub");
    const low = sel.lowStock().length;
    const txt = [
      `${sel.ordersToday().length} orders · avg ${ksh(sel.avgOrderValue())}`,
      `${low ? low + " low-stock alerts" : "stock healthy"}`,
      `AOV ${ksh(sel.avgOrderValue())}`,
      `inventory ${ksh(sel.inventoryValue())} at cost`,
      `last-7d vs prior-7d`,
    ];
    subs.forEach((sEl, i) => (sEl.textContent = txt[i] || ""));
  }

  /* ---------------- console + feed row ---------------- */
  const midRow = h("div", "grid xl:grid-cols-3 gap-4");

  /* console */
  const consoleEl = html("div", "panel xl:col-span-2 reveal d1 flex flex-col", `
    <div class="panel-h">
      <span style="color:var(--acc)">${icon("cpu", 16)}</span>
      <span class="t" style="color:var(--txt)">Command console</span>
      <span class="badge ok" style="margin-left:auto">AI BRAIN · ${store.state.integrations.filter((i) => i.status === "connected").length} SOURCES</span>
    </div>`);
  const msgs = h("div", "scroll-thin");
  msgs.style.cssText = "flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;height:430px";

  const aiAva = `<span class="ava">${icon("cpu", 15)}</span>`;
  const youAva = `<span class="ava">${icon("eye", 15)}</span>`;

  function addMsg(role: "ai" | "user", inner: string): HTMLElement {
    const wrap = html("div", `msg ${role}`, role === "ai" ? aiAva : youAva);
    const bubble = h("div", "bubble");
    bubble.innerHTML = inner;
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    return bubble;
  }

  function revealBlocks(bubble: HTMLElement, htmlStr: string, onDone: () => void) {
    const tmp = document.createElement("div");
    tmp.innerHTML = htmlStr;
    const blocks = Array.from(tmp.children) as HTMLElement[];
    bubble.innerHTML = "";
    let i = 0;
    const iv = window.setInterval(() => {
      if (i >= blocks.length) {
        window.clearInterval(iv);
        onDone();
        return;
      }
      const b = blocks[i];
      b.style.animation = "msgIn 0.25s ease both";
      bubble.appendChild(b);
      if (i % 2 === 0) sfx.tick();
      msgs.scrollTop = msgs.scrollHeight;
      i++;
    }, 150);
    timers.push(iv);
  }

  function send(text: string, opts?: { voice?: boolean }) {
    const t = text.trim();
    if (!t) return;
    addMsg("user", (opts && opts.voice ? `<span title="voice input" style="color:var(--acc);margin-right:6px">${icon("mic", 12)}</span>` : "") + esc(t));
    input.value = "";
    const typing = html("div", "msg ai", aiAva + `<div class="bubble typing"><span></span><span></span><span></span></div>`);
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    const reply = ask(t);
    const wait = Math.min(1500, 550 + reply.html.length * 1.2);
    const t0 = window.setTimeout(() => {
      typing.remove();
      const bubble = addMsg("ai", "");
      const spoken =
        opts && opts.voice ? `<span title="spoken reply" style="color:var(--info)">${icon("sndOn", 13)}</span>` : "";
      revealBlocks(bubble, spoken + reply.html, () => {
        if (reply.sound === "ding") sfx.ding();
        if (reply.sound === "cash") sfx.cash();
        if (reply.approval) attachApproval(bubble, reply.approval);
        if (opts && opts.voice) voice.onReplyRendered(reply.html);
      });
    }, wait);
    timers.push(t0);
  }

  function attachApproval(bubble: HTMLElement, ap: NonNullable<ReturnType<typeof ask>["approval"]>) {
    const bar = h("div", "decision");
    bar.style.cssText = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px";
    bar.innerHTML = `<span class="badge ${ap.scope === "FINANCIAL" ? "warn" : "info"}">SCOPE: ${ap.scope}</span><span style="font-size:12.5px;color:var(--txt-2)">${esc(ap.title)} — explicit approval required.</span>`;
    const ok = h("button", "btn btn-acc btn-sm", "Approve & execute");
    ok.innerHTML = icon("check", 13) + " Approve & execute";
    const no = h("button", "btn btn-sm btn-danger", "Deny");
    no.innerHTML = icon("x", 13) + " Deny";
    bar.appendChild(ok);
    bar.appendChild(no);
    bubble.appendChild(bar);
    msgs.scrollTop = msgs.scrollHeight;

    ok.addEventListener("click", async () => {
      const yes = await modal({
        title: ap.scope + " APPROVAL",
        bodyHtml: `<p style="font-size:13px;color:var(--txt-2);margin-bottom:12px">The AI never executes ${ap.scope.toLowerCase()}-scoped actions without your explicit sign-off. Review and confirm:</p>${ap.summaryHtml}`,
        confirmLabel: "Approve",
      });
      bar.remove();
      if (yes) {
        sfx.approve();
        const confirmHtml = ap.exec();
        const b2 = addMsg("ai", "");
        revealBlocks(b2, confirmHtml, () => sfx.ding());
        paintKPIs(true);
      } else {
        store.addAudit("YOU", "Security", `Denied AI action: ${ap.title}`, ap.scope, "DENIED");
        addMsg("ai", `<div class="cl">Denied. Action blocked, decision recorded in the audit log. ${`<span class="cnum w">SCOPE ${ap.scope} · DENIED</span>`}</div>`);
      }
    });
    no.addEventListener("click", () => {
      bar.remove();
      store.addAudit("YOU", "Security", `Denied AI action: ${ap.title}`, ap.scope, "DENIED");
      addMsg("ai", `<div class="cl">Denied — logged to audit trail. I'll keep it as a recommendation, not an action.</div>`);
    });
  }

  /* greeting */
  addMsg("ai", greetingHtml());

  const chips = h("div", "flex gap-2");
  chips.style.cssText = "padding:0 16px 10px;overflow-x:auto;flex-wrap:wrap";
  QUICK.forEach((c) => {
    const chip = h("button", "chip", c);
    chip.addEventListener("click", () => send(c));
    chips.appendChild(chip);
  });

  const input = h("input", "");
  input.placeholder = "Ask your business anything…  ( / to focus )";
  input.id = "cmdInput";
  input.style.cssText = "flex:1";
  input.setAttribute("autocomplete", "off");
  const micBtn = h("button", "btn", "Talk");
  micBtn.innerHTML = icon("mic", 14) + " Talk";
  micBtn.title = "Talk to the AI (voice)";
  micBtn.addEventListener("click", () => voice.tapMic());
  const sendBtn = h("button", "btn btn-acc", "Send");
  sendBtn.innerHTML = icon("send", 14) + " Run";
  sendBtn.addEventListener("click", () => send(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send(input.value);
  });
  const inputRow = h("div", "flex gap-2");
  inputRow.style.padding = "0 16px 16px";
  inputRow.appendChild(input);
  inputRow.appendChild(micBtn);
  inputRow.appendChild(sendBtn);

  /* voice layer drives this exact console — same AI, memory & audit */
  voice.attachConsole((t, o) => send(t, o));

  consoleEl.appendChild(msgs);
  consoleEl.appendChild(chips);
  consoleEl.appendChild(inputRow);

  /* ---------------- right column: feed + attention ---------------- */
  const rightCol = h("div", "flex flex-col gap-4");

  const feedEl = html("div", "panel reveal d2", `
    <div class="panel-h"><span style="color:var(--info)">${icon("radio", 15)}</span><span class="t">Live feed</span><span class="live-dot" style="margin-left:auto"></span></div>
    <div class="panel-b scroll-thin" id="feedList" style="max-height:250px;overflow-y:auto;padding:10px 16px"></div>`);
  const feedList = feedEl.querySelector("#feedList") as HTMLElement;

  const kindColor: Record<string, string> = { sale: "var(--acc)", alert: "var(--warn)", ai: "var(--violet)", social: "var(--info)", freelance: "var(--info)", system: "var(--txt-3)" };
  const kindIcon: Record<string, string> = { sale: "coins", alert: "warn", ai: "cpu", social: "chart", freelance: "brief", system: "gear" };

  function paintFeed() {
    feedList.innerHTML = store.state.notices
      .slice(0, 8)
      .map(
        (n) =>
          `<div class="feed-row"><span style="color:${kindColor[n.kind]};flex:none;margin-top:1px">${icon(kindIcon[n.kind], 14)}</span><div style="flex:1;line-height:1.5">${esc(n.text)}<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">${timeAgo(n.at)} · ${n.kind.toUpperCase()}</div></div></div>`
      )
      .join("");
  }

  const attEl = html("div", "panel reveal d3", `
    <div class="panel-h"><span style="color:var(--warn)">${icon("warn", 15)}</span><span class="t">Needs attention</span><span class="badge mut" id="attCount" style="margin-left:auto">0</span></div>
    <div class="panel-b" id="attList" style="padding:8px 16px 14px"></div>`);
  const attList = attEl.querySelector("#attList") as HTMLElement;
  const attCount = attEl.querySelector("#attCount") as HTMLElement;

  function paintAttention() {
    const items = sel.attention();
    attCount.textContent = String(items.length);
    attCount.className = "badge " + (items.length ? (items.some((i) => i.sev === "danger") ? "danger" : "warn") : "ok");
    attCount.style.marginLeft = "auto";
    attList.innerHTML = items.length
      ? items
          .slice(0, 5)
          .map(
            (i) =>
              `<div style="display:flex;gap:9px;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,0.06);font-size:12.5px;line-height:1.55">
                <span style="color:${i.sev === "danger" ? "var(--danger)" : i.sev === "warn" ? "var(--warn)" : "var(--info)"};flex:none;margin-top:2px">${icon(i.sev === "danger" ? "warn" : "zap", 13)}</span>
                <div>${esc(i.text)}<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">${i.module.toUpperCase()}</div></div>
              </div>`
          )
          .join("")
      : `<div style="font-size:13px;color:var(--txt-2);padding:10px 0">All clear — nothing urgent right now.</div>`;
  }

  rightCol.appendChild(feedEl);
  rightCol.appendChild(attEl);
  midRow.appendChild(consoleEl);
  midRow.appendChild(rightCol);

  /* ---------------- bottom row: chart + insights ---------------- */
  const botRow = h("div", "grid xl:grid-cols-3 gap-4");
  const chartEl = html("div", "panel xl:col-span-2 reveal d2", `
    <div class="panel-h">
      <span style="color:var(--acc)">${icon("chart", 15)}</span><span class="t">Revenue — last 14 days</span>
      <span class="mono" id="chartTotal" style="margin-left:auto;font-size:11px;color:var(--txt-2)"></span>
    </div>
    <div class="panel-b"><canvas id="revChart" style="width:100%;height:190px;display:block"></canvas></div>`);
  const revCv = chartEl.querySelector("#revChart") as HTMLCanvasElement;
  const chartTotal = chartEl.querySelector("#chartTotal") as HTMLElement;

  function paintChart() {
    const data = sel.revenueSeries(14);
    areaChart(revCv, data, "#00ff88");
    chartTotal.textContent = "Σ " + ksh(data.reduce((a, b) => a + b, 0));
  }

  const insights = [
    { ic: "zap", color: "var(--acc)", text: () => `TikTok converts ${store.state.social.tiktok.engRate}% vs Instagram ${store.state.social.instagram.engRate}% — shift budget toward short-form video.`, q: "Analyze my Instagram" },
    { ic: "warn", color: "var(--warn)", text: () => { const low = sel.lowStock(); return low.length ? `${low[0].name} covers ~${Math.ceil((low[0].stock / low[0].velocity) * 7)} days of demand — reorder window is open.` : "Stock levels healthy across all SKUs."; }, q: "Restock ThinkPad T480" },
    { ic: "chart", color: "var(--info)", text: () => `Checkout drop-off ≈58% — an M-Pesa STK push could recover ${ksh(sel.avgOrderValue() * 4)}/month.`, q: "Find opportunities" },
    { ic: "brief", color: "var(--violet)", text: () => { const l = store.state.leads.find((x) => x.stage === "lead"); return l ? `${l.name} is a hot lead replied <1h ago — same-day proposals win ~2× more.` : "Pipeline healthy — no stale hot leads."; }, q: "Show my pipeline" },
  ];
  const insEl = html("div", "panel reveal d3", `<div class="panel-h"><span style="color:var(--violet)">${icon("cpu", 15)}</span><span class="t">AI insights</span></div>`);
  const insBody = h("div", "panel-b flex flex-col gap-2");
  insights.forEach((ins) => {
    const row = h("div", "");
    row.style.cssText = "display:flex;gap:10px;padding:9px 10px;border:1px solid var(--line);border-radius:8px;align-items:flex-start;transition:border-color .15s;cursor:pointer";
    row.innerHTML = `<span style="color:${ins.color};flex:none;margin-top:2px">${icon(ins.ic, 15)}</span><div style="font-size:12.5px;line-height:1.55;flex:1">${ins.text()}</div>`;
    row.addEventListener("mouseenter", () => (row.style.borderColor = "rgba(0,255,136,0.4)"));
    row.addEventListener("mouseleave", () => (row.style.borderColor = "var(--line)"));
    row.addEventListener("click", () => {
      send(ins.q);
      msgs.scrollTop = msgs.scrollHeight;
    });
    insBody.appendChild(row);
  });
  insEl.appendChild(insBody);
  botRow.appendChild(chartEl);
  botRow.appendChild(insEl);

  root.appendChild(kpiRow);
  root.appendChild(midRow);
  root.appendChild(botRow);

  paintKPIs();
  paintFeed();
  paintAttention();
  requestAnimationFrame(paintChart);

  /* ---------------- live wiring ---------------- */
  unsubs.push(
    store.on((e) => {
      if (e.kind === "order") {
        paintKPIs(true);
        paintFeed();
        paintAttention();
        paintChart();
      } else if (e.kind === "alert" || e.kind === "system" || e.kind === "freelance") {
        paintFeed();
        paintAttention();
        paintChart();
      } else if (e.kind === "social") {
        paintFeed();
      } else if (e.kind === "tick") {
        paintFeed();
        paintChart();
      }
    })
  );

  return {
    el: root,
    destroy() {
      timers.forEach((t) => {
        window.clearInterval(t);
        window.clearTimeout(t);
      });
      unsubs.forEach((u) => u());
      voice.detachConsole();
    },
  };
}
