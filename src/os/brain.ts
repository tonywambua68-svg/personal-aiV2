/* ============================================================
   NEXUS//OS — AI Brain (intent router + decision engine)
   Production: OpenAI function-calling over these same tools.
   ============================================================ */
import { sel, store, todayStart } from "./store";
import { dayLabel, esc, ksh, num, timeAgo } from "./ui";
import type { Lead } from "./types";

export interface Approval {
  title: string;
  scope: "FINANCIAL" | "WRITE" | "ADMIN";
  summaryHtml: string;
  exec: () => string; // returns confirmation html
}

export interface Reply {
  html: string;
  sound: "ding" | "cash" | "none";
  approval?: Approval;
}

/* mini rendering DSL */
const S = (t: string) => `<div class="cs"><i>▸</i>${t}</div>`;
const L = (t: string) => `<div class="cl">• ${t}</div>`;
const LB = (t: string) => `<div class="cl b">— ${t}</div>`;
const N = (v: string, cls = "") => `<span class="cnum ${cls}">${v}</span>`;
const D = (rows: [string, string][]) =>
  `<div class="decision">${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`).join("")}</div>`;

function pctDelta(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? "+∞" : "0%";
  const d = ((cur - prev) / prev) * 100;
  return (d >= 0 ? "+" : "") + d.toFixed(0) + "%";
}

function productMatch(input: string) {
  const s = input.toLowerCase();
  return store.state.products.find((p) => {
    const short = p.name.toLowerCase().split(" ").filter((w) => w.length > 3);
    return short.some((w) => s.includes(w));
  });
}

function leadMatch(input: string): Lead | undefined {
  const s = input.toLowerCase();
  return store.state.leads.find((l) => s.includes(l.name.split(" ")[0].toLowerCase()) || s.includes(l.name.split(" — ")[0].toLowerCase()));
}

/* ------------------------------------------------------------------ */

export function ask(raw: string): Reply {
  const input = raw.trim();
  const q = input.toLowerCase();
  const s = store.state;

  /* ---- greetings / help ---- */
  if (/^(hi|hello|hey|yo|habari)\b/.test(q)) {
    return {
      sound: "ding",
      html:
        S("NEXUS Brain online") +
        L(`All ${s.integrations.filter((i) => i.status === "connected").length} integrations reporting. ${N(ksh(sel.revenueToday()))} booked today across ${sel.ordersToday().length} orders.`) +
        L("Ask me about sales, profit, stock, traffic, social, clients or automations — or tap a quick command below."),
    };
  }

  if (/help|what can you|capabilities|^commands$/.test(q)) {
    return {
      sound: "ding",
      html:
        S("What I can do") +
        L(`${N("Business")} — "How much did I sell today?" · "Which laptop made the most profit?" · "Forecast next week"`) +
        L(`${N("Ops")} — "Do I have new orders?" · "What needs my attention?" · "Restock ThinkPad T480"`) +
        L(`${N("Growth")} — "Analyze my Instagram" · "Find opportunities" · "Analyze my store"`) +
        L(`${N("Freelance")} — "Show my pipeline" · "Draft a proposal for Karen" · "How should I price?"`) +
        L(`${N("Learn")} — "Teach me how to connect WordPress" · "What should I learn next?"`) +
        L(`${N("Report")} — "Generate daily report"`),
    };
  }

  /* ---- sales today ---- */
  if (/(sold|sale|sales|revenue|sell).*today|today.*(sold|sale|sales|revenue|sell)|how much did i/.test(q)) {
    const today = sel.revenueToday();
    const yest = sel.revenueOn(1);
    const ot = sel.ordersToday();
    const best = sel.profitByProduct()[0];
    return {
      sound: "ding",
      html:
        S("Sales — today") +
        L(`Revenue so far: ${N(ksh(today))} across ${N(String(ot.length))} orders (avg ${N(ksh(sel.avgOrderValue()))}/order).`) +
        L(`vs yesterday: ${N(pctDelta(today, yest), today >= yest ? "" : "d")} (${ksh(yest)} at this point in the day is not comparable until close).`) +
        L(`Best mover today: ${best.p.name} — ${best.units} units, ${N(ksh(best.profit))} profit.`) +
        D([
          ["Confidence", "98% — live WooCommerce + manual order log"],
          ["Next check", "Auto-report at 19:00 EAT via Telegram"],
        ]),
    };
  }

  /* ---- profit ---- */
  if (/profit.*today|today.*profit|net profit|margin/.test(q) && !/product|laptop|most/.test(q)) {
    const p = sel.profitToday();
    const r = sel.revenueToday();
    return {
      sound: "ding",
      html:
        S("Profit — today") +
        L(`Gross profit: ${N(ksh(p))} on ${N(ksh(r))} revenue → margin ${N((r ? (p / r) * 100 : 0).toFixed(1) + "%")}.`) +
        L(`Portfolio average margin is ${N(sel.avgMargin().toFixed(1) + "%")} — you are ${p / Math.max(r, 1) > sel.avgMargin() / 100 ? "above" : "below"} it today.`) +
        L(`Inventory sitting capital: ${N(ksh(sel.inventoryValue()))} across ${s.products.reduce((a, b) => a + b.stock, 0)} units.`),
    };
  }

  /* ---- most profitable product ---- */
  if (/(most|best|top).*(profit|margin|earner)|which (laptop|product)|highest profit/.test(q)) {
    const top = sel.profitByProduct()[0];
    const second = sel.profitByProduct()[1];
    const margin = ((top.p.price - top.p.cost) / top.p.price) * 100;
    return {
      sound: "ding",
      html:
        S("Profit leader") +
        L(`${N(top.p.name)} is your #1 earner: ${top.units} units sold → ${N(ksh(top.profit))} profit (${margin.toFixed(0)}% margin).`) +
        L(`Runner-up: ${second.p.name} at ${ksh(second.profit)}.`) +
        D([
          ["Observation", `${top.p.name} converts at ${top.p.conv}% — above your ${(s.products.reduce((a, b) => a + b.conv, 0) / s.products.length).toFixed(1)}% store average.`],
          ["Recommendation", `Shift 30% of Meta budget toward it and feature it in your next TikTok video.`],
          ["Expected impact", `+${ksh(top.profit * 2)}–${ksh(top.profit * 3)} per month at current traffic.`],
          ["Confidence", "87%"],
        ]),
    };
  }

  /* ---- new orders ---- */
  if (/new order|any order|orders\??$|do i have/.test(q)) {
    const ot = sel.ordersToday();
    const recent = s.orders.slice(0, 3);
    return {
      sound: "ding",
      html:
        S("Orders") +
        L(`${N(String(ot.length))} new orders today worth ${N(ksh(sel.revenueToday()))}.`) +
        S("Latest activity") +
        recent.map((o) => LB(`${o.id} · ${esc(o.customer)} · ${esc(sel.productById(o.productId)?.name || "—")} · ${N(ksh(o.revenue))} · ${o.source} · ${timeAgo(o.at)}`)).join(""),
    };
  }

  /* ---- attention / daily brief ---- */
  if (/attention|priorit|brief|what.*(need|should).*(do|know)|today.*focus/.test(q)) {
    const items = sel.attention();
    if (!items.length)
      return { sound: "ding", html: S("All clear") + L("Nothing urgent. Inventory healthy, no overdue leads, all campaigns performing.") };
    return {
      sound: "ding",
      html:
        S(`Needs your attention — ${items.length} items`) +
        items.map((i) => L(`${N(i.sev === "danger" ? "●" : i.sev === "warn" ? "▲" : "ℹ", i.sev === "danger" ? "d" : i.sev === "warn" ? "w" : "")} <b>${i.module}:</b> ${esc(i.text)}`)).join("") +
        D([["Suggested first move", items[0].module === "Inventory" ? "Approve the reorder (say: “restock " + esc(sel.lowStock()[0]?.name || "item") + "”)" : "Handle the top item — it has the highest revenue risk."]]),
    };
  }

  /* ---- restock / reorder (FINANCIAL → approval) ---- */
  if (/restock|reorder|buy more|order more/.test(q)) {
    const p = productMatch(input) || sel.lowStock()[0] || s.products[0];
    const qty = Math.max(3, p.velocity);
    const cost = p.cost * qty;
    return {
      sound: "ding",
      html:
        S("Reorder plan drafted") +
        L(`${p.name}: ${p.stock} in stock, velocity ${p.velocity}/week → suggested order ${N("×" + qty)}.`) +
        L(`Estimated supplier cost: ${N(ksh(cost), "w")}. This is a ${N("FINANCIAL")} action — it needs your approval.`) +
        D([
          ["Observation", `Stock covers ~${Math.ceil((p.stock / p.velocity) * 7)} days of demand.`],
          ["Risk of skipping", `~${ksh((p.price - p.cost) * p.velocity)} lost profit per week if you stock out.`],
          ["Confidence", "91%"],
        ]),
      approval: {
        title: "Approve reorder — " + p.name,
        scope: "FINANCIAL",
        summaryHtml: `
          <div style="font-size:13px;line-height:1.7">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span style="color:var(--txt-2)">Product</span><b>${esc(p.name)}</b></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span style="color:var(--txt-2)">Quantity</span><b class="mono">${qty} units</b></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span style="color:var(--txt-2)">Est. cost</span><b class="mono" style="color:var(--warn)">${ksh(cost)}</b></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0"><span style="color:var(--txt-2)">Projected gross return</span><b class="mono" style="color:var(--acc)">${ksh((p.price - p.cost) * qty)}</b></div>
          </div>
          <div class="badge warn" style="margin-top:10px">SCOPE: FINANCIAL — explicit approval required</div>`,
        exec: () => {
          store.restock(p.id, qty);
          return S("Executed & verified") +
            L(`Reorder placed: ${p.name} ×${qty}. Supplier confirmed ETA 3 days.`) +
            L(`Stock on arrival: ${p.stock + qty} units ≈ ${Math.ceil(((p.stock + qty) / p.velocity) * 7)} days of cover.`) +
            L(`Recorded in audit log under FINANCIAL → APPROVED. ${N("✓ verified")}`);
        },
      },
    };
  }

  /* ---- instagram ---- */
  if (/instagram|\big\b|insta\b/.test(q) && !/tiktok/.test(q)) {
    const meta = s.integrations.find((i) => i.id === "meta");
    if (meta?.status === "error") {
      return {
        sound: "ding",
        html:
          S("Instagram — degraded mode") +
          L(`${N("Meta Graph API is rate-limited", "d")} (error 17). I did not crash — I'm answering from cache (36 min old).`) +
          L(`Cached: ${N(num(s.social.instagram.followers))} followers, engagement ${s.social.instagram.engRate}%.`) +
          L("Say “retry meta” or wait — auto-retry in ~10 min."),
      };
    }
    const ig = s.social.instagram;
    const r7 = ig.reach.slice(-7).reduce((a, b) => a + b, 0);
    const rPrev = ig.reach.slice(-14, -7).reduce((a, b) => a + b, 0);
    const delta = pctDelta(r7, rPrev);
    return {
      sound: "ding",
      html:
        S("Instagram analysis") +
        L(`Followers: ${N(num(ig.followers))} (${N("+" + num(ig.growth7d))} this week) · engagement ${N(ig.engRate + "%")} — healthy for your niche (avg 2.1%).`) +
        L(`Reach last 7d: ${N(num(r7))} (${N(delta, delta.startsWith("-") ? "d" : "")} vs previous week).`) +
        L(`Attributed sales: IG → ${s.orders.filter((o) => o.source === "Instagram").length} orders in the log, incl. high-margin MacBooks.`) +
        D([
          ["Interpretation", "Your T480 review reel is the traffic engine; link-in-bio clicks convert 2.9×."],
          ["Recommendation", "Post 1 reel/2 days featuring stock arrivals; pin the T480 review."],
          ["Expected impact", "+35–60 reach/day, ~1 extra order/week (~KSh 39,500)."],
          ["Confidence", "82%"],
        ]),
    };
  }

  /* ---- tiktok ---- */
  if (/tiktok|tik tok/.test(q)) {
    const tk = s.social.tiktok;
    const r7 = tk.reach.slice(-7).reduce((a, b) => a + b, 0);
    return {
      sound: "ding",
      html:
        S("TikTok analysis") +
        L(`Followers: ${N(num(tk.followers))} (+${num(tk.growth7d)}/wk) · engagement ${N(tk.engRate + "%")} — 1.7× your Instagram rate.`) +
        L(`7-day reach: ${N(num(r7))}. Spark Ads on the T480 video: 2 conversions for KSh 3,000 → ${N("ROAS 26.3")}.`) +
        D([["Recommendation", "TikTok is your cheapest acquisition channel. Move the underperforming IG Story budget (KSh 2,800, 0 sales) here."], ["Expected impact", "~2–3 extra attributed orders/month."], ["Confidence", "79%"]]),
    };
  }

  /* ---- social both ---- */
  if (/social|followers|engagement/.test(q)) {
    const ig = s.social.instagram;
    const tk = s.social.tiktok;
    return {
      sound: "ding",
      html:
        S("Social overview") +
        L(`Instagram — ${N(num(ig.followers))} followers · ${ig.engRate}% engagement`) +
        L(`TikTok — ${N(num(tk.followers))} followers · ${tk.engRate}% engagement`) +
        L(`Verdict: TikTok engages harder; Instagram closes higher-ticket units. Run both, different jobs.`),
    };
  }

  /* ---- traffic / website ---- */
  if (/traffic|website|ga4|google analytics|funnel|conversion rate/.test(q)) {
    const views = sel.totalViews();
    const carts = Math.round(views * 0.061);
    const checkout = Math.round(carts * 0.42);
    const purchases = s.orders.length;
    return {
      sound: "ding",
      html:
        S("Website analytics (GA4)") +
        L(`Product views (14d): ${N(num(views))} · sessions trending ${N(pctDelta(sel.viewsSeries().slice(-7).reduce((a, b) => a + b, 0), sel.viewsSeries().slice(0, 7).reduce((a, b) => a + b, 0)) || "+0%", pctDelta(1, 1).startsWith("-") ? "d" : "")} WoW.`) +
        L(`Funnel: ${num(views)} views → ${num(carts)} cart adds (6.1%) → ${num(checkout)} checkouts (2.6%) → ${num(purchases)} purchases.`) +
        D([
          ["Anomaly", "Traffic ↑ but checkout→purchase step is your leakiest joint (58% drop)."],
          ["Recommendation", "Add M-Pesa STK push at checkout + a 48h cart-recovery WhatsApp message (Zapier workflow)."],
          ["Expected impact", "+8–12% completed purchases without extra ad spend."],
          ["Confidence", "84%"],
        ]),
    };
  }

  /* ---- opportunities / analyze store ---- */
  if (/opportunit|analy.*(store|business|shop|everything)|audit my|grow/.test(q)) {
    const low = sel.lowStock();
    const top = sel.profitByProduct()[0];
    const dead = s.campaigns.find((c) => c.active && c.conversions === 0);
    const hotLead = [...s.leads].filter((l) => l.stage !== "won" && l.stage !== "lost").sort((a, b) => b.value - a.value)[0];
    const fc = sel.forecast7();
    return {
      sound: "ding",
      html:
        S("Opportunity scan — OBSERVE → RECOMMEND") +
        (low.length ? L(`1. ${N("Reorder")} ${low.map((p) => esc(p.name)).join(", ")} — stockout risk costs ~${N(ksh(low.reduce((a, p) => a + (p.price - p.cost) * p.velocity, 0)), "w")}/week. Say “restock”.`) : "") +
        L(`${low.length ? 2 : 1}. ${N("Scale")} ${top.p.name}: best margin × best conversion. Move ${N(ksh(2000))} of budget → est. ${N("+" + ksh(top.profit * 2))}/mo.`) +
        (dead ? L(`${low.length ? 3 : 2}. ${N("Kill or rework")} “${esc(dead.name)}” — ${ksh(dead.spend)} spent, zero conversions. Pausing frees cash today.`) : "") +
        (hotLead ? L(`${dead ? 4 : 3}. ${N("Close")} ${esc(hotLead.name)} (${ksh(hotLead.value)}) — in ${hotLead.stage}. A same-day follow-up lifts win rate ~2×.`) : "") +
        L(`${N("Forecast")}: next 7 days revenue ${N(ksh(fc.low))}–${N(ksh(fc.high))} (trend ${fc.trend >= 0 ? "+" : ""}${fc.trend.toFixed(0)}%).`) +
        D([["How I ranked these", "Expected value × confidence ÷ effort. Reorder wins: guaranteed margin, zero new traffic needed."], ["Confidence", "88% across 4 signals (stock, ads, CRM, GA4)"]]),
    };
  }

  /* ---- forecast ---- */
  if (/forecast|predict|next week|projection/.test(q)) {
    const fc = sel.forecast7();
    return {
      sound: "ding",
      html:
        S("7-day forecast") +
        L(`Projected revenue: ${N(ksh(fc.low))} – ${N(ksh(fc.high))} (last-14-day trend ${fc.trend >= 0 ? "+" : ""}${fc.trend.toFixed(0)}%).`) +
        L(`Watch: EliteBook & T480 drive ~60% of expected units. Weekend bumps typical Fri–Sat.`) +
        D([["Method", "Weighted moving average + day-of-week seasonality."], ["Confidence", "74% — tightens as the week lands."]]),
    };
  }

  /* ---- expenses ---- */
  if (/expense|spending|costs|outgo/.test(q)) {
    const month = s.expenses.reduce((a, e) => a + e.amount, 0);
    const recurring = s.expenses.filter((e) => e.recurring).reduce((a, e) => a + e.amount, 0);
    return {
      sound: "ding",
      html:
        S("Expenses") +
        L(`Logged this period: ${N(ksh(month), "w")} · fixed recurring: ${N(ksh(recurring), "w")}/mo.`) +
        L(`Marketing is ${((s.expenses.filter((e) => e.category === "Marketing").reduce((a, e) => a + e.amount, 0) / month) * 100).toFixed(0)}% of spend and your only scalable lever — keep ROAS ≥ 5.`) +
        L(`Blended net estimate today: ${N(ksh(sel.profitToday() * 0.82))} after ~18% operating load.`),
    };
  }

  /* ---- customers ---- */
  if (/customer|who bought|repeat buyer|crm/.test(q)) {
    const top = sel.topCustomers(3);
    const masked = !s.memory.customers;
    return {
      sound: "ding",
      html:
        S("Customer intelligence") +
        top
          .map((c, i) => L(`${N("#" + (i + 1))} ${masked ? "Customer " + c.id : esc(c.name)} — ${c.orders} orders, ${N(ksh(c.spent))} lifetime, last ${timeAgo(c.last)}.`))
          .join("") +
        (masked ? L(`(Names hidden — customer memory is OFF in Settings → Privacy.)`) : L(`Win-back idea: WhatsApp the top 5 a “new arrivals first look” — repeat buyers convert ~3×.`)),
    };
  }

  /* ---- campaigns / marketing ---- */
  if (/campaign|roas|ads|marketing|meta ads/.test(q)) {
    return {
      sound: "ding",
      html:
        S("Marketing performance") +
        s.campaigns
          .map((c) => {
            const roas = c.spend ? c.revenue / c.spend : 0;
            return L(`${esc(c.name)} (${c.platform}) — spend ${N(ksh(c.spend), "w")} · ${c.conversions} sales · ${N("ROAS " + roas.toFixed(1), roas >= 5 ? "" : "d")} ${c.active ? "" : "· paused"}`);
          })
          .join("") +
        D([["Verdict", "Spark Ads on TikTok is your efficiency king. The IG Story boost is burning cash — pause it (approval required)."]]),
    };
  }

  /* ---- pause dead campaign (WRITE approval) ---- */
  if (/pause.*(campaign|boost|ad)|kill.*(campaign|ad)|stop.*(campaign|ad)/.test(q)) {
    const dead = s.campaigns.find((c) => c.active && c.conversions === 0) || s.campaigns[0];
    return {
      sound: "ding",
      html: S("Campaign pause drafted") + L(`“${esc(dead.name)}” — ${ksh(dead.spend)} spent, ${dead.conversions} conversions. Pausing frees budget for TikTok.`),
      approval: {
        title: "Pause campaign — " + dead.name,
        scope: "WRITE",
        summaryHtml: `<div style="font-size:13px;line-height:1.7"><p style="color:var(--txt-2)">This stops delivery via Meta Marketing API. No money leaves your account; the campaign can be resumed anytime.</p><div class="badge info" style="margin-top:8px">SCOPE: WRITE</div></div>`,
        exec: () => {
          store.toggleCampaign(dead.id);
          return S("Executed") + L(`“${esc(dead.name)}” paused via Meta API. ${N(ksh(dead.spend))}/mo now available to redeploy.`) + L("Audit log updated: Marketing → WRITE → EXECUTED.");
        },
      },
    };
  }

  /* ---- freelance ---- */
  if (/pipeline|freelance|clients|leads/.test(q) && !/proposal|price/.test(q)) {
    const open = s.leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
    const value = open.reduce((a, l) => a + l.value, 0);
    const won = s.leads.filter((l) => l.stage === "won");
    return {
      sound: "ding",
      html:
        S("Freelance pipeline") +
        L(`${N(String(open.length))} open deals worth ${N(ksh(value))} — won this period: ${N(ksh(won.reduce((a, l) => a + l.value, 0)))}.`) +
        open
          .sort((a, b) => a.deadline - b.deadline)
          .slice(0, 4)
          .map((l) => LB(`${esc(l.name)} · ${esc(l.service)} · ${N(ksh(l.value))} · ${l.stage} · due ${timeAgo(l.deadline).replace(" ago", "") === "now" ? "now" : l.deadline > Date.now() ? "in " + Math.max(1, Math.ceil((l.deadline - Date.now()) / 86400000)) + "d" : "overdue"}`))
          .join("") +
        D([["Move now", "NiaFit replied <1h ago — hot leads die in 4h. Send the short proposal today."]]),
    };
  }

  if (/proposal/.test(q)) {
    const l = leadMatch(input) || s.leads.find((x) => x.stage === "proposal" || x.stage === "lead") || s.leads[0];
    return {
      sound: "ding",
      html:
        S(`Proposal draft — ${esc(l.name)}`) +
        `<div class="decision" style="font-size:13px;line-height:1.75">
          Hi ${esc(l.name.split(" ")[0])},<br/><br/>
          Quick plan for <b>${esc(l.service)}</b>:<br/>
          <b>Scope</b> — design + build + mobile testing + 2 weeks of free fixes.<br/>
          <b>Timeline</b> — 10 working days from kickoff.<br/>
          <b>Investment</b> — ${N(ksh(l.value))} (50% kickoff, 50% on launch).<br/>
          <b>Bonus</b> — free analytics dashboard setup so you can see exactly what the site earns.<br/><br/>
          I've helped similar Nairobi businesses ${l.service.toLowerCase().includes("seo") ? "rank on page 1 within 8 weeks" : "start taking bookings/orders online within 2 weeks"}. Happy to show you one live today.
        </div>` +
        L(`Pricing check: ${N(ksh(l.value))} ≈ ${(l.value / 40).toFixed(0)} KSh/hr for ~40h — ${l.value / 40 > 900 ? "solid" : "a bit low, consider +15%"} for your skill level.`),
    };
  }

  if (/price|pricing|how much should i charge|quote/.test(q)) {
    return {
      sound: "ding",
      html:
        S("Pricing coach") +
        L(`Formula: ${N("(hours × rate) + value cut")}. Your current blended rate ≈ ${N("KSh 900–1,200/hr")}.`) +
        L(`WordPress build: floor ${N(ksh(25000))} + ${N(ksh(2500))}/page + ${N(ksh(10000))} if booking/payments included.`) +
        L(`Retainers beat projects: pitch ${N(ksh(15000))}/mo care plans (hosting, edits, SEO) to every finished build.`) +
        D([["Rule of thumb", "If a client hesitates at your price, add scope — never cut rate. Discount the deposit instead."]]),
    };
  }

  /* ---- teaching ---- */
  if (/teach|learn|tutorial|how (do|to) (i )?(connect|use|set up|automate)/.test(q)) {
    if (/wordpress|\bwp\b/.test(q)) {
      return {
        sound: "ding",
        html:
          S("Lesson — connect WordPress (5 min)") +
          L(`1. In WP Admin → Users → Profile → create an ${N("Application Password")}.`) +
          L(`2. Store it in ${N(".env")} as WP_USER / WP_APP_PASS — never in code.`) +
          L(`3. NEXUS calls ${N("https://shop.ke/wp-json/wp/v2/…")} with Basic auth over HTTPS.`) +
          L(`4. Install ${N("WP Webhooks")} → point order/stock events at your Express endpoint.`) +
          L(`5. Money move: auto-publish every new laptop as a product page + SEO title via Rank Math.`) +
          D([["Practice", "Open the AI Tutor module — this lesson is tracked there with a completion badge."]]),
      };
    }
    if (/zapier|n8n|make|webhook|automat/.test(q)) {
      return {
        sound: "ding",
        html:
          S("Lesson — Zapier/webhook automation") +
          L(`1. Zapier → Zaps → trigger “Webhooks by Zapier (Catch Hook)”.`) +
          L(`2. In NEXUS → Automations → copy the ${N("catch-hook URL")} into the workflow step.`) +
          L(`3. Test with the ${N("Simulate webhook")} button — you'll see the run log tick.`) +
          L(`4. Money move: every Fluent Forms lead → auto-draft reply + Telegram ping. Costs $0 on free tiers.`),
      };
    }
    return {
      sound: "ding",
      html:
        S("AI Tutor") +
        L(`Pick a lesson in the ${N("AI Tutor")} module — WordPress, WooCommerce webhooks, Zapier, GA4, Meta API.`) +
        L(`Based on your skill map, the highest-income next learn is ${N("AI Automation (n8n/Zapier)")} — demand 92, your level 38.`),
    };
  }

  if (/what should i learn|next skill|skill/.test(q)) {
    const best = [...s.skills].sort((a, b) => b.demand - a.demand - (b.level - a.level))[0];
    return {
      sound: "ding",
      html:
        S("Skill coach") +
        L(`Learn ${N(best.name)} next: market demand ${best.demand}/100, your level ${best.level}/100.`) +
        L(`Why: it plugs directly into your reselling ops (automations) and lets you sell ${N(ksh(30000))}+ automation setups to freelancing clients.`) +
        D([["90-day plan", "Weeks 1–2 n8n basics → 3–4 build the Low-Stock Sentinel yourself → 5+ sell it as a service."]]),
    };
  }

  /* ---- daily report ---- */
  if (/daily report|report|summary/.test(q)) {
    const today = sel.revenueToday();
    const profit = sel.profitToday();
    const views = sel.viewsSeries();
    const vDelta = pctDelta(views.slice(-7).reduce((a, b) => a + b, 0), views.slice(0, 7).reduce((a, b) => a + b, 0));
    const sent = s.settings.telegram || s.settings.email || s.settings.push;
    store.addAudit("AI", "BI", "Daily report generated" + (sent ? " + dispatched (Telegram)" : ""), "READ", "EXECUTED");
    return {
      sound: "cash",
      html:
        S(`Daily report — ${new Date().toLocaleDateString("en-KE", { weekday: "short", day: "2-digit", month: "short" })}`) +
        L(`${N("Sales")} — ${ksh(today)} revenue · ${ksh(profit)} profit · ${sel.ordersToday().length} orders`) +
        L(`${N("Website")} — traffic ${vDelta} WoW · checkout drop-off remains the leak`) +
        L(`${N("Social")} — IG +${s.social.instagram.growth7d} followers · TikTok +${s.social.tiktok.growth7d} · T480 reel over-performing`) +
        L(`${N("Customers")} — ${sel.ordersToday().length} buyers today · top lifetime: ${s.memory.customers ? esc(sel.topCustomers(1)[0].name) : "masked"}`) +
        S("AI recommendations") +
        L(`Reorder ${sel.lowStock().map((p) => esc(p.name)).join(" & ") || "nothing"} · shift budget TikTok-ward · follow up NiaFit within the hour.`) +
        (sent ? L(`${N("✓ Sent to your phone")} (Telegram${s.settings.push ? " + push" : ""}).`) : L(`Delivery off — enable Telegram in Settings.`)),
    };
  }

  /* ---- memory / privacy ---- */
  if (/memory|privacy|forget|remember/.test(q)) {
    return {
      sound: "ding",
      html:
        S("Memory & privacy") +
        L(`Customer memory: ${s.memory.customers ? N("ON") : N("OFF", "w")} · finance memory: ${s.memory.finances ? N("ON") : N("OFF", "w")} · command history: ${s.memory.commands ? N("ON") : N("OFF", "w")}`) +
        L(`Everything I do is written to the ${N("Audit log")} — inspect it anytime.`) +
        L(`Toggle any of these in Settings → Memory. OFF = I mask that data everywhere, including my answers.`),
    };
  }

  /* ---- retry failed integration ---- */
  if (/retry|reconnect|recover/.test(q)) {
    const bad = s.integrations.find((i) => i.status === "error");
    if (bad) {
      store.setIntegration(bad.id, "connected");
      store.addAudit("SYSTEM", "Integrations", `Manual retry — ${bad.name} reconnected`, "READ", "EXECUTED");
      return { sound: "ding", html: S("Recovered") + L(`${bad.name} reconnected — live sync resumed, cache discarded.`) };
    }
    return { sound: "ding", html: L("Nothing to retry — all integrations healthy.") };
  }

  /* ---- webhook / zapier ---- */
  if (/webhook|zapier|n8n|make\.com/.test(q)) {
    return {
      sound: "ding",
      html:
        S("Webhooks & automation") +
        L(`Active workflows: ${N(String(s.workflows.filter((w) => w.enabled).length))} — New Order Pipeline ran ${s.workflows[0].runs}× total.`) +
        L(`Try the ${N("Automations")} module: trigger a test webhook and watch the run log + audit trail update live.`),
    };
  }

  /* ---- beginner mode: "what is X?" / "explain X" ---- */
  const GLOSSARY: { re: RegExp; name: string; plain: string; yours: string }[] = [
    { re: /web ?hook/, name: "Webhook", plain: "A doorbell for software: instead of checking your store every minute, the store calls a URL you gave it the moment something happens and hands over the details.", yours: "WooCommerce rings NEXUS//OS on every order → the AI saves it, plays the cash sound and messages your phone. Instant, no refreshing." },
    { re: /\bapi\b/, name: "API", plain: "A waiter: you don't enter the kitchen, you hand the waiter a request and it brings back exactly what you ordered from another service.", yours: "The AI uses the WooCommerce API for orders, Meta API for Instagram stats, Telegram API to reach your phone." },
    { re: /roas/, name: "ROAS", plain: "Shillings back per shilling spent on ads. ROAS 4.2 = KSh 4.20 back per KSh 1. Below ~2 usually loses money after costs.", yours: "Finance ranks campaigns by ROAS — the IG Story boost at 0.0 is flagged to pause." },
    { re: /funnel/, name: "Sales funnel", plain: "Views → clicks → carts → purchases, shrinking at every step. Your job is finding the leakiest step.", yours: "Ask “analyze my website” — the AI walks the funnel and points at your biggest leak." },
    { re: /oauth/, name: "OAuth", plain: "A hotel key-card instead of your house keys: limited access, revocable anytime, password never shared.", yours: "Meta/TikTok connections use read-only passes — the AI can never post or delete without higher permission." },
    { re: /localhost/, name: "Localhost", plain: "Your PC talking to itself. http://localhost:8080 only you can see — the internet cannot reach it directly.", yours: "To let your online store reach it while developing, use a tunnel (ask “what is ngrok?”)." },
    { re: /ngrok|tunnel/, name: "Tunnel (ngrok)", plain: "A secure hallway from the public internet into your PC: a public URL forwards everything to your localhost without opening router ports.", yours: "Point the WooCommerce webhook at your ngrok URL in development; move the receiver to a $5 VPS for 24/7 production." },
    { re: /environment variable|\.env\b|env file/, name: ".env file", plain: "A locked drawer for secrets. Code reads keys from it; it is never uploaded to GitHub — .gitignore blocks it.", yours: "The demo needs none. Phase 2 adds WooCommerce keys, OpenAI key and Telegram token there." },
    { re: /database|postgres|supabase/, name: "Database", plain: "A spreadsheet many programs can safely read/write at once, guaranteed nothing gets lost or half-written.", yours: "Demo tables live in your browser's localStorage; production uses the same schema on PostgreSQL (Supabase free tier)." },
    { re: /\bcrm\b|lead/, name: "CRM / Lead", plain: "Your notebook of everyone who might buy. A lead is one person; you move them through contacted → proposal → negotiation → won.", yours: "The Freelance tab tracks leads with deadlines; the AI nags you about hot ones." },
    { re: /stk|m-?pesa|mpesa/, name: "M-Pesa STK Push", plain: "Your server asks Safaricom to pop a PIN prompt on the customer's phone; they confirm, and Safaricom calls your webhook to verify.", yours: "Phase 3 uses the Daraja API (free sandbox). This demo's checkout is explicitly fake — no money moves." },
    { re: /conversion rate|conversion\b/, name: "Conversion rate", plain: "Out of 100 visitors, how many bought. Every +0.5% is nearly free money because the traffic already arrived.", yours: "Inventory shows it per product — ThinkPad T480 leads at 3.1%." },
    { re: /margin/, name: "Profit margin", plain: "The slice of the sale you keep: (price − cost) ÷ price. KSh 42,500 bought at 32,000 → 24.7% margin.", yours: "Finance ranks laptops by margin; high margin + high conversion = where ads should go." },
    { re: /socket|real-?time/, name: "Sockets / real-time", plain: "A phone line that stays open, so the server can push updates the instant they happen instead of you refreshing.", yours: "The production server uses Socket.io — the live feed, KPIs and cash-register flash are socket events." },
  ];
  const ex = /(what is|what's|whats|explain|define|meaning of|teach me about)\s+(?:a |an |the )?([a-z ./-]+)/i.exec(q);
  if (ex) {
    const g = GLOSSARY.find((e) => e.re.test(ex[2].trim()));
    if (g)
      return {
        sound: "ding",
        html:
          S("Beginner mode — " + g.name) +
          L(g.plain) +
          L(`<b style="color:var(--txt)">In your system:</b> ${g.yours}`) +
          D([["Tip", `Ask another: “what is ROAS?” · “explain a funnel” · “what is ngrok?”`]]),
      };
  }

  /* ---- fallback ---- */
  return {
    sound: "ding",
    html:
      S("Parse confidence low — let me help") +
      L(`I didn't map “${esc(input.length > 60 ? input.slice(0, 60) + "…" : input)}” to a tool. I combine ${s.integrations.filter((i) => i.status === "connected").length} live sources, so phrase it as a business question.`) +
      L(`Try: “How much did I sell today?” · “Find opportunities” · “Analyze my Instagram” · “Restock ThinkPad T480” · “Draft a proposal for Karen”`),
  };
}

/* greeting used when the console opens */
export function greetingHtml(): string {
  const t = new Date();
  const h = t.getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return (
    S(`Good ${part} — NEXUS Brain online`) +
    L(`${N(ksh(sel.revenueToday()))} booked today · ${sel.ordersToday().length} orders · ${sel.lowStock().length} stock alerts · ${sel.attention().length} items need attention.`) +
    L("I read WooCommerce, GA4, Meta, TikTok, your CRM and the audit log before answering. Ask anything — financial actions always wait for your approval.") +
    `<div style="color:var(--txt-3);font-size:11px;margin-top:8px" class="mono">OBSERVE → ANALYZE → EXPLAIN → RECOMMEND → ASK → EXECUTE → VERIFY → RECORD · ${dayLabel(Date.now())} ${new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", hour12: false })} EAT</div>`
  );
}

export { todayStart };
