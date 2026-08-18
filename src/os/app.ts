/* ============================================================
   NEXUS//OS — application shell: sidebar · topbar · router
   ============================================================ */
import { sel, startOps, store } from "./store";
import { esc, flash, h, html, icon, timeAgo, toast } from "./ui";
import { sfx, unlockAudio } from "./sound";
import { voice } from "./voice";
import { renderCommand, type View } from "./views/command";
import { renderFinance, renderInventory, renderOrders } from "./views/tables";
import { renderAnalytics, renderAutomations, renderFreelance } from "./views/ops";
import { renderAudit, renderBlueprint, renderIntegrations, renderSettings, renderTutor } from "./views/system";

type Route =
  | "command" | "orders" | "inventory" | "finance"
  | "freelance" | "analytics" | "automations" | "integrations"
  | "tutor" | "audit" | "settings" | "blueprint";

const NAV: { sec: string; items: { id: Route; label: string; icon: string }[] }[] = [
  { sec: "Operate", items: [
    { id: "command", label: "Command Center", icon: "cpu" },
    { id: "orders", label: "Orders", icon: "cart" },
    { id: "inventory", label: "Inventory", icon: "box" },
    { id: "finance", label: "Finance", icon: "coins" },
  ]},
  { sec: "Grow", items: [
    { id: "freelance", label: "Freelance CRM", icon: "brief" },
    { id: "analytics", label: "Analytics", icon: "chart" },
  ]},
  { sec: "Automate", items: [
    { id: "automations", label: "Automations", icon: "zap" },
    { id: "integrations", label: "Integrations", icon: "plug" },
  ]},
  { sec: "Learn", items: [{ id: "tutor", label: "AI Tutor", icon: "cap" }] },
  { sec: "System", items: [
    { id: "audit", label: "Audit Log", icon: "shield" },
    { id: "settings", label: "Settings", icon: "gear" },
    { id: "blueprint", label: "Blueprint", icon: "hex" },
  ]},
];

const TITLES: Record<Route, string> = {
  command: "Command Center",
  orders: "Orders",
  inventory: "Inventory",
  finance: "Finance",
  freelance: "Freelance CRM",
  analytics: "Analytics",
  automations: "Automations",
  integrations: "Integration Manager",
  tutor: "AI Tutor & Skill Coach",
  audit: "Audit Trail",
  settings: "Settings & Memory",
  blueprint: "System Blueprint",
};

export function boot(root: HTMLElement) {
  if (root.dataset.booted) return;
  root.dataset.booted = "1";
  root.className = "os-root";

  /* sync sound engine with settings */
  sfx.setMuted(!store.state.settings.sound);
  sfx.setVolume(store.state.settings.volume);
  window.addEventListener("pointerdown", unlockAudio, { once: true });

  /* ---------------- sidebar ---------------- */
  const sidebar = h("aside", "");
  sidebar.id = "sidebar";
  sidebar.style.cssText = "width:228px;flex:none;border-right:1px solid var(--line);background:rgba(17,17,17,0.9);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;transition:transform .2s ease";

  const brand = html("div", "", `
    <div style="display:flex;gap:11px;align-items:center;padding:18px 16px 14px">
      <span style="width:36px;height:36px;border-radius:9px;display:grid;place-items:center;background:rgba(0,255,136,0.12);border:1px solid rgba(0,255,136,0.45);color:var(--acc)">${icon("hex", 20)}</span>
      <div>
        <div class="font-display" style="font-weight:700;font-size:15px;letter-spacing:0.06em">NEXUS<span style="color:var(--acc)">//</span>OS</div>
        <div class="mono" style="font-size:9.5px;color:var(--txt-3);letter-spacing:0.1em;margin-top:1px">LAPTOPHUB KE · v1.0</div>
      </div>
    </div>
    <div style="height:1px;background:var(--line);margin:0 14px 6px"></div>`);
  sidebar.appendChild(brand);

  const navList = h("nav", "scroll-thin");
  navList.style.cssText = "flex:1;overflow-y:auto;padding:4px 10px 10px";
  NAV.forEach((group) => {
    navList.appendChild(h("div", "nav-sec", group.sec));
    group.items.forEach((it) => {
      const b = h("button", "nav-item");
      b.dataset.route = it.id;
      b.innerHTML = `<span style="display:grid;place-items:center">${icon(it.icon, 16)}</span><span>${it.label}</span>`;
      b.addEventListener("click", () => go(it.id));
      navList.appendChild(b);
    });
  });
  sidebar.appendChild(navList);

  const foot = html("div", "", `
    <div style="padding:12px 16px;border-top:1px solid var(--line);font-size:11px;color:var(--txt-3);line-height:1.6">
      <div style="display:flex;align-items:center;gap:7px"><span class="live-dot" id="footDot"></span><span class="mono" style="font-size:10px;letter-spacing:0.08em">SOCKET LIVE · 19 MODULES</span></div>
      <div class="mono" style="font-size:9.5px;margin-top:5px">OBSERVE → ANALYZE → RECOMMEND → ASK</div>
    </div>`);
  sidebar.appendChild(foot);

  /* ---------------- topbar ---------------- */
  const topbar = h("header", "");
  topbar.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(18,18,18,0.86);backdrop-filter:blur(8px);z-index:40";

  const menuBtn = h("button", "btn btn-sm hamb", "");
  menuBtn.innerHTML = icon("menu", 15);
  menuBtn.addEventListener("click", () => sidebar.classList.toggle("open"));

  const title = h("div", "font-display");
  title.style.cssText = "font-weight:700;font-size:17px;letter-spacing:0.04em";

  const liveWrap = h("div", "");
  liveWrap.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:14px";

  const simBtn = h("button", "btn btn-sm", "");
  function paintSim() {
    const on = store.state.settings.sim;
    simBtn.innerHTML = (on ? icon("pause", 12) : icon("play", 12)) + (on ? " SIM LIVE" : " SIM PAUSED");
    const dot = topbar.querySelector("#topDot");
    if (dot) dot.classList.toggle("paused", !on);
    const fd = sidebar.querySelector("#footDot");
    if (fd) fd.classList.toggle("paused", !on);
  }
  simBtn.addEventListener("click", () => {
    store.setSettings({ sim: !store.state.settings.sim });
    paintSim();
    toast(store.state.settings.sim ? "Operations simulator resumed — live events streaming." : "Operations simulator paused.", "info");
  });

  const clock = h("span", "mono");
  clock.style.cssText = "font-size:12px;color:var(--txt-2);letter-spacing:0.05em";

  const sndBtn = h("button", "btn btn-sm", "");
  function paintSnd() {
    const on = store.state.settings.sound;
    sndBtn.innerHTML = icon(on ? "sndOn" : "sndOff", 14);
    sndBtn.title = on ? "Mute sound effects" : "Unmute sound effects";
  }
  sndBtn.addEventListener("click", () => {
    store.setSettings({ sound: !store.state.settings.sound });
    paintSnd();
    if (store.state.settings.sound) sfx.ding();
  });

  const bellBtn = h("button", "btn btn-sm", "");
  bellBtn.style.position = "relative";
  function paintBell() {
    const u = sel.unread();
    bellBtn.innerHTML = icon("bell", 14) + (u ? `<span class="mono" style="position:absolute;top:-6px;right:-6px;background:var(--acc);color:#08130d;font-size:9.5px;font-weight:700;border-radius:99px;padding:1px 5px">${u}</span>` : "");
  }

  const bellDrop = h("div", "panel scroll-thin");
  bellDrop.style.cssText = "position:absolute;top:44px;right:0;width:min(380px,calc(100vw - 32px));max-height:420px;overflow-y:auto;display:none;z-index:50;box-shadow:0 20px 50px rgba(0,0,0,0.55)";
  function paintBellDrop() {
    bellDrop.innerHTML = `<div class="panel-h"><span class="t" style="color:var(--txt)">Notifications</span><button class="btn btn-sm" id="markRead" style="margin-left:auto">Mark all read</button></div>
      <div style="padding:6px 12px">` +
      store.state.notices.slice(0, 12).map((n) => `
        <div class="feed-row" style="${n.read ? "opacity:0.55" : ""}">
          <span style="color:${n.read ? "var(--txt-3)" : "var(--acc)"};flex:none;margin-top:2px">${icon(n.kind === "sale" ? "coins" : n.kind === "alert" ? "warn" : n.kind === "freelance" ? "brief" : "cpu", 14)}</span>
          <div style="flex:1;line-height:1.5">${esc(n.text)}<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">${timeAgo(n.at)} · to: ${[store.state.settings.telegram ? "Telegram" : "", store.state.settings.push ? "Push" : "", store.state.settings.email ? "Email" : ""].filter(Boolean).join(" + ") || "no channels"}</div></div>
        </div>`).join("") + `</div>`;
    bellDrop.querySelector("#markRead")!.addEventListener("click", () => {
      store.markAllRead();
      paintBell();
      paintBellDrop();
    });
  }
  const bellHost = h("div", "");
  bellHost.style.position = "relative";
  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = bellDrop.style.display === "block";
    bellDrop.style.display = open ? "none" : "block";
    if (!open) {
      store.markAllRead();
      paintBell();
      paintBellDrop();
    }
  });
  document.addEventListener("click", () => (bellDrop.style.display = "none"));
  bellHost.appendChild(bellBtn);
  bellHost.appendChild(bellDrop);

  liveWrap.innerHTML = `<span style="display:flex;align-items:center;gap:7px"><span class="live-dot" id="topDot"></span><span class="mono" style="font-size:10px;letter-spacing:0.14em;color:var(--txt-2)">LIVE</span></span>`;
  liveWrap.appendChild(simBtn);
  liveWrap.appendChild(clock);
  liveWrap.appendChild(sndBtn);
  liveWrap.appendChild(bellHost);

  topbar.appendChild(menuBtn);
  topbar.appendChild(title);
  topbar.appendChild(liveWrap);

  /* ---------------- main + router ---------------- */
  const main = h("main", "scroll-thin");
  main.style.cssText = "flex:1;min-width:0;padding:20px;overflow-y:auto;height:100vh";

  const layout = h("div", "flex");
  layout.appendChild(sidebar);
  const right = h("div", "");
  right.style.cssText = "flex:1;min-width:0;display:flex;flex-direction:column";
  right.appendChild(topbar);
  right.appendChild(main);
  layout.appendChild(right);
  root.appendChild(layout);

  let current: View | null = null;
  let route: Route = "command";

  const renderers: Record<Route, () => View> = {
    command: renderCommand,
    orders: renderOrders,
    inventory: renderInventory,
    finance: renderFinance,
    freelance: renderFreelance,
    analytics: renderAnalytics,
    automations: renderAutomations,
    integrations: renderIntegrations,
    tutor: renderTutor,
    audit: renderAudit,
    settings: renderSettings,
    blueprint: renderBlueprint,
  };

  function go(r: Route) {
    route = r;
    if (current?.destroy) current.destroy();
    main.innerHTML = "";
    current = renderers[r]();
    main.appendChild(current.el);
    main.scrollTop = 0;
    title.textContent = TITLES[r];
    navList.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", (n as HTMLElement).dataset.route === r));
    sidebar.classList.remove("open");
    if (r === "command") window.setTimeout(() => document.getElementById("cmdInput")?.focus(), 60);
  }

  /* keyboard: "/" focuses the console */
  document.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
      e.preventDefault();
      if (route !== "command") go("command");
      else document.getElementById("cmdInput")?.focus();
    }
  });

  /* ---------------- global event wiring (sound · flash · toast) ---------------- */
  store.on((e) => {
    paintBell();
    if (e.kind === "order") {
      sfx.cash();
      flash("SALE CONFIRMED");
      const n = store.state.notices[0];
      if (n) toast(n.text, "ok");
    } else if (e.kind === "alert") {
      sfx.err();
      const n = store.state.notices[0];
      if (n) toast(n.text, "warn");
    } else if (e.kind === "social" || e.kind === "freelance") {
      sfx.whoosh();
      const n = store.state.notices[0];
      if (n && Date.now() - n.at < 2000) toast(n.text, "info");
    } else if (e.kind === "settings") {
      sfx.setMuted(!store.state.settings.sound);
      sfx.setVolume(store.state.settings.volume);
    }
  });

  /* clock */
  const tickClock = () => {
    clock.textContent = new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " EAT";
  };
  tickClock();
  window.setInterval(tickClock, 1000);

  /* redraw charts on resize */
  let rz = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(rz);
    rz = window.setTimeout(() => store.emit("tick"), 200);
  });

  /* voice layer — same AI brain, memory & approval gates */
  voice.init();
  voice.setNavigate(
    (r) => {
      if (r in renderers) {
        go(r as Route);
        return true;
      }
      return false;
    },
    () => route
  );

  paintSim();
  paintSnd();
  paintBell();
  go("command");
  startOps();
}
