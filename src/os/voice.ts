/* ============================================================
   NEXUS//OS — VOICE LAYER
   Conversational interface on top of the existing AI brain.
   Same engine · same memory · same tools · same RBAC gates.
   Pipeline: MIC → browser speech engine (streaming) → brain →
   natural TTS → SPEAKERS.  Upgrade path: OpenAI Realtime
   (VOICE_API_KEY) wired through the Express backend in Phase 2.
   Privacy: audio is never recorded or stored — transcripts only,
   governed by the existing memory settings.
   ============================================================ */
import { sfx, unlockAudio } from "./sound";

type VState = "idle" | "ready" | "listening" | "thinking" | "speaking" | "error" | "off";

interface VoiceCfg {
  enabled: boolean;
  continuous: boolean;
  wakeWord: boolean;
  wakeWordText: string;
  micId: string;
  voiceURI: string;
  rate: number;
  volume: number;
  maxMinutes: number;
}

const DEFAULTS: VoiceCfg = {
  enabled: true,
  continuous: true,
  wakeWord: false,
  wakeWordText: "jarvis",
  micId: "",
  voiceURI: "",
  rate: 1,
  volume: 0.9,
  maxMinutes: 5,
};

const SRCtor: any =
  typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
const SUPPORTED = !!SRCtor;
const TTS_OK = typeof window !== "undefined" && "speechSynthesis" in window;

let cfg: VoiceCfg = { ...DEFAULTS };
try {
  cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("nexus.voice.v2") || "{}") };
} catch {
  /* defaults */
}
function saveCfg() {
  try {
    localStorage.setItem("nexus.voice.v2", JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

let state: VState = "idle";
let stateMsg = "";
let conversation = false;
let wakeLoop = false;
let convTimer = 0;
let lastTopic: string | null = null;
let spokenText = "";
let currentUtter: SpeechSynthesisUtterance | null = null;
let rec: any = null;
let bargeRec: any = null;
let wakeRec: any = null;
let awaitingVoiceReply = false;
let pendingAsk: string | null = null;

type SendFn = (text: string, opts?: { voice?: boolean }) => void;
let sendFn: SendFn | null = null;
let navigateFn: ((route: string) => boolean) | null = null;
let getRouteFn: (() => string) | null = null;
let confirmResolve: ((ok: boolean) => void) | null = null;
let confirmAsk: (() => string) | null = null;

const listeners: ((s: VState, msg: string) => void)[] = [];
function setState(s: VState, msg = "") {
  state = s;
  stateMsg = msg;
  listeners.forEach((f) => {
    try {
      f(s, msg);
    } catch {
      /* ignore */
    }
  });
  renderDock();
}

function makeRec(opts?: { continuous?: boolean; interim?: boolean }) {
  const r = new SRCtor();
  r.lang = "en-US";
  r.continuous = !!(opts && opts.continuous);
  r.interimResults = !!(opts && opts.interim);
  r.maxAlternatives = 1;
  return r;
}

function stopRecs() {
  [rec, bargeRec, wakeRec].forEach((r) => {
    if (r) {
      try {
        r.onend = null;
        r.onerror = null;
        r.stop();
      } catch {
        /* ignore */
      }
    }
  });
}

function toastWarn(msg: string) {
  import("./ui").then(({ toast }) => toast(msg, "warn"));
}

function micError(code: string) {
  setState("error", "MICROPHONE UNAVAILABLE");
  let why = "Unknown microphone problem.";
  if (code === "not-allowed" || code === "service-not-allowed")
    why =
      "Microphone blocked. Fix: Windows Settings → Privacy & security → Microphone → allow desktop apps, then reload.";
  else if (code === "audio-capture")
    why = "No microphone found — unplugged, disabled, or in use by another app. Open Voice Settings and pick another device.";
  else if (code === "network") why = "Speech recognition needs internet (browser speech engine). Check your connection.";
  else if (code === "unsupported") why = "Speech recognition needs Chrome or Edge. Text mode still works fully.";
  toastWarn("⚠ " + why);
  renderDock();
}

/* ---------------- TTS ---------------- */
let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  voices = TTS_OK ? window.speechSynthesis.getVoices() || [] : [];
}
if (TTS_OK) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const v = voices.find((x) => x.voiceURI === cfg.voiceURI);
  if (v) return v;
  const prefs = [/google us english/i, /natural/i, /aria|jenny|libby|ryan/i, /microsoft/i, /en[-_]us/i, /en[-_]gb/i, /^en/i];
  for (const p of prefs) {
    const m = voices.filter((x) => p.test(x.name) || p.test(x.lang));
    if (m.length) return m[0];
  }
  return voices[0];
}

function speak(text: string, onend?: () => void) {
  if (!TTS_OK) {
    if (onend) onend();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = cfg.rate;
  u.volume = cfg.volume;
  currentUtter = u;
  spokenText = text;
  u.onstart = () => {
    setState("speaking", "SPEAKING…");
    startBargeIn();
  };
  const fin = () => {
    currentUtter = null;
    spokenText = "";
    stopBargeIn();
    if (onend) onend();
    else afterSpeak();
  };
  u.onend = fin;
  u.onerror = fin;
  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  if (TTS_OK) window.speechSynthesis.cancel();
  stopBargeIn();
}

function afterSpeak() {
  if (conversation && cfg.enabled) {
    setState("listening", "LISTENING…");
    listenOnce();
  } else {
    setState(cfg.enabled ? "ready" : "off", cfg.enabled ? "READY" : "VOICE OFF");
    maybeStartWake();
  }
}

/* ---------------- barge-in ---------------- */
function startBargeIn() {
  if (!SUPPORTED) return;
  stopBargeIn();
  bargeRec = makeRec({ continuous: true, interim: true });
  bargeRec.onresult = (e: any) => {
    let t = "";
    for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
    t = t.trim();
    if (!t) return;
    const low = t.toLowerCase();
    if (spokenText && spokenText.toLowerCase().indexOf(low.slice(0, Math.min(24, low.length))) !== -1) return;
    stopSpeaking();
    stopRecs();
    handleSpeech(t);
  };
  bargeRec.onerror = () => stopBargeIn();
  bargeRec.onend = () => {
    if (currentUtter) {
      try {
        bargeRec.start();
      } catch {
        /* ignore */
      }
    }
  };
  try {
    bargeRec.start();
  } catch {
    /* ignore */
  }
}
function stopBargeIn() {
  if (bargeRec) {
    try {
      bargeRec.onend = null;
      bargeRec.stop();
    } catch {
      /* ignore */
    }
    bargeRec = null;
  }
}

/* ---------------- listening ---------------- */
function listenOnce() {
  if (!SUPPORTED) {
    micError("unsupported");
    return;
  }
  if (!cfg.enabled) {
    cfg.enabled = true;
    saveCfg();
  }
  stopRecs();
  rec = makeRec({ continuous: false, interim: true });
  let finalText = "";
  rec.onresult = (e: any) => {
    let interim = "";
    let fin = "";
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) fin += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    finalText = fin;
    setState("listening", fin || interim);
  };
  rec.onerror = (e: any) => {
    if (e.error === "no-speech") {
      if (conversation) listenOnce();
      else setState("ready", "READY");
      return;
    }
    if (e.error === "aborted") return;
    micError(e.error);
  };
  rec.onend = () => {
    if (state === "error") return;
    const text = finalText.trim();
    if (!text) {
      if (conversation) listenOnce();
      else {
        setState("ready", "READY");
        maybeStartWake();
      }
      return;
    }
    handleSpeech(text);
  };
  try {
    rec.start();
    setState("listening", "LISTENING…");
  } catch {
    micError("busy");
  }
}

/* ---------------- wake word ---------------- */
function maybeStartWake() {
  if (!SUPPORTED || !cfg.enabled || !cfg.wakeWord || conversation || state === "speaking" || state === "listening") {
    stopWake();
    return;
  }
  stopWake();
  wakeLoop = true;
  wakeRec = makeRec({ continuous: true });
  wakeRec.onresult = (e: any) => {
    let t = "";
    for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
    const low = t.toLowerCase();
    const w = (cfg.wakeWordText || "jarvis").toLowerCase();
    const idx = low.indexOf(w);
    if (idx === -1) return;
    const rest = t.slice(idx + w.length).replace(/^[,\s]+/, "").trim();
    stopWake();
    sfx.ding();
    if (rest) handleSpeech(rest);
    else speak("Yes? I'm listening.", () => listenOnce());
  };
  wakeRec.onerror = (e: any) => {
    if (e.error !== "no-speech" && e.error !== "aborted") micError(e.error);
  };
  wakeRec.onend = () => {
    if (wakeLoop && cfg.enabled && cfg.wakeWord && state !== "speaking" && state !== "error")
      window.setTimeout(() => {
        if (wakeLoop) maybeStartWake();
      }, 300);
  };
  try {
    wakeRec.start();
  } catch {
    /* ignore */
  }
}
function stopWake() {
  wakeLoop = false;
  if (wakeRec) {
    try {
      wakeRec.onend = null;
      wakeRec.stop();
    } catch {
      /* ignore */
    }
    wakeRec = null;
  }
}

/* ---------------- context + intents ---------------- */
function detectTopic(q: string): string | null {
  if (/\bsell|sales|sold|revenue/.test(q)) return "sales";
  if (/profit|earn|made|margin/.test(q)) return "profit";
  if (/order/.test(q)) return "orders";
  if (/product|laptop|stock|fastest|best/.test(q)) return "products";
  if (/instagram|tiktok|social|follower/.test(q)) return "social";
  if (/traffic|website|analytics|funnel/.test(q)) return "traffic";
  return null;
}

function expandFollowUp(q: string): string {
  const t = q.toLowerCase().replace(/[?.!,]+$/, "").trim();
  if (!lastTopic) return q;
  if (/^(what|how) about (yesterday|today)$/.test(t) || t === "yesterday") {
    if (lastTopic === "sales") return /yesterday/.test(t) ? "how much did I sell yesterday" : "how much did I sell today";
    if (lastTopic === "profit") return /yesterday/.test(t) ? "what was my profit yesterday" : "how much profit did I make today";
    if (lastTopic === "orders") return /yesterday/.test(t) ? "show me yesterday's orders" : "do I have new orders";
  }
  if (/^why|what caused|reason/.test(t) && lastTopic === "products") return "which laptop made the most profit";
  if (/tell me more|go on|continue/.test(t)) {
    if (lastTopic === "sales") return "daily report";
    if (lastTopic === "products") return "find opportunities";
  }
  return q;
}

const YES = /^(yes|yeah|yep|do it|go ahead|proceed|approve|confirm|sure|okay|ok)\b/;
const NO = /^(no|nope|cancel|don'?t|dont|stop it|deny|not now)\b/;
const STOP_TALK = /^(stop|exit|quit|goodbye|bye|that'?s all|be quiet)\b/;

const NAV_MAP: { re: RegExp; route: string; say: string }[] = [
  { re: /(open|show|go to).*(command|dashboard|home|console)/, route: "command", say: "Opening the command center." },
  { re: /(open|show|go to).*(inventory|stock|products)/, route: "inventory", say: "Opening inventory." },
  { re: /(open|show|go to).*order/, route: "orders", say: "Opening your orders." },
  { re: /(open|show|go to).*(finance|money)/, route: "finance", say: "Opening finance." },
  { re: /(open|show|go to).*(freelanc|crm|lead|client)/, route: "freelance", say: "Opening your freelance CRM." },
  { re: /(open|show|go to).*(automation|workflow)/, route: "automations", say: "Opening automations." },
  { re: /(open|show|go to).*(health|status|integration)/, route: "integrations", say: "Opening system status and integrations." },
  { re: /(open|show|go to).*settings/, route: "settings", say: "Opening settings." },
  { re: /(open|show|go to).*(blueprint|architecture)/, route: "blueprint", say: "Opening the architecture blueprint." },
  { re: /(open|show|go to).*(tutor|learning|learn)/, route: "tutor", say: "Opening the AI tutor." },
  { re: /(open|show|go to).*(audit|logs)/, route: "audit", say: "Opening the audit trail." },
  { re: /(open|show).*(voice setting|audio setting)/, route: "__voice", say: "" },
];

function summarizeForVoice(replyHtml: string): string {
  const el = document.createElement("div");
  el.innerHTML = replyHtml || "";
  el.querySelectorAll(".decision, .mono").forEach((x) => x.remove());
  let text = (el.textContent || "").replace(/\s+/g, " ").trim();
  text = text.replace(/▍/g, "").replace(/\bKSh\b/g, "K. S. H.");
  if (!text) return "Done.";
  const recM = /Recommendation[:\s]+([^.!]{10,160}[.!])/i.exec(replyHtml || "");
  const sentences = text.split(/(?<=[.!?])\s+/);
  let out = sentences.slice(0, 2).join(" ");
  if (out.length > 300) out = out.slice(0, 300).replace(/\s+\S*$/, "") + ".";
  if (recM && out.length < 260) out += " Recommendation: " + recM[1];
  out += ' Say "tell me more" for details.';
  return out;
}

function handleSpeech(raw: string) {
  const text = raw.trim();
  if (!text) return;
  setState("thinking", "THINKING…");

  if (STOP_TALK.test(text.toLowerCase())) {
    endConversation("Conversation ended.");
    return;
  }

  /* pending confirmation — same approval gate as the modal buttons */
  if (confirmResolve) {
    const isYes = YES.test(text.toLowerCase());
    const isNo = NO.test(text.toLowerCase());
    if (isYes || isNo) {
      const r = confirmResolve;
      confirmResolve = null;
      if (confirmAsk) confirmAsk = null;
      speak(isYes ? "Approved. Executing now." : "Cancelled. Decision logged.", () => afterSpeak());
      r(isYes);
      return;
    }
  }

  for (const n of NAV_MAP) {
    if (n.re.test(text.toLowerCase())) {
      if (n.route === "__voice") {
        openSettings();
        afterSpeak();
        return;
      }
      const went = navigateFn ? navigateFn(n.route) : false;
      speak(went ? n.say : "I couldn't find that section.", () => afterSpeak());
      return;
    }
  }

  const expanded = expandFollowUp(text);
  lastTopic = detectTopic(expanded.toLowerCase()) || lastTopic;
  awaitingVoiceReply = true;

  const fire = () => {
    if (sendFn) sendFn(expanded, { voice: true });
    else awaitingVoiceReply = false;
  };
  if (sendFn) fire();
  else {
    pendingAsk = expanded;
    if (navigateFn && getRouteFn && getRouteFn() !== "command") navigateFn("command");
    window.setTimeout(() => {
      if (!sendFn && pendingAsk) {
        pendingAsk = null;
        awaitingVoiceReply = false;
        speak("Open the command center and I'll take it from there.", () => afterSpeak());
      }
    }, 1200);
  }
}

/* called by the command console once a reply has rendered */
function onReplyRendered(replyHtml: string) {
  if (!awaitingVoiceReply) return;
  awaitingVoiceReply = false;
  setState("speaking", "SPEAKING…");
  speak(summarizeForVoice(replyHtml));
}

/* ---------------- conversation control ---------------- */
function startConversation() {
  if (!SUPPORTED) {
    micError("unsupported");
    return;
  }
  unlockAudio();
  conversation = true;
  window.clearTimeout(convTimer);
  convTimer = window.setTimeout(
    () => endConversation("Conversation time limit reached. Tap 🎙 to continue anytime."),
    Math.max(1, cfg.maxMinutes) * 60000
  );
  stopWake();
  speak(cfg.continuous ? "I'm listening. Ask me anything about your business." : "Listening.", () => listenOnce());
}

function endConversation(msg?: string) {
  conversation = false;
  window.clearTimeout(convTimer);
  stopRecs();
  stopSpeaking();
  setState(cfg.enabled ? "ready" : "off", "READY");
  if (msg) speak(msg, () => maybeStartWake());
  else maybeStartWake();
}

function tapMic() {
  unlockAudio();
  if (!SUPPORTED) {
    micError("unsupported");
    toastWarn("⚠ Speech recognition needs Chrome or Edge — text mode still works fully.");
    return;
  }
  if (state === "listening") {
    stopRecs();
    setState("ready", "READY");
    return;
  }
  if (state === "speaking") stopSpeaking();
  conversation = false;
  window.clearTimeout(convTimer);
  listenOnce();
}

/* ---------------- dock ---------------- */
let dock: HTMLElement | null = null;
let dockLabel: HTMLElement | null = null;
let dockDot: HTMLElement | null = null;
let dockConv: HTMLButtonElement | null = null;
let dockSub: HTMLElement | null = null;
let dockBars: HTMLElement | null = null;

function renderDock() {
  if (!dock) return;
  const map: Record<VState, [string, string]> = {
    off: ["VOICE OFF", "var(--txt-3)"],
    idle: ["🎙 VOICE READY", "var(--txt-2)"],
    ready: ["🎙 VOICE READY", "var(--acc)"],
    listening: ["🎙 LISTENING…", "var(--acc)"],
    thinking: ["🧠 THINKING…", "var(--info)"],
    speaking: ["🔊 SPEAKING…", "var(--violet)"],
    error: ["⚠ MIC ERROR", "var(--danger)"],
  };
  const [label, color] = map[state];
  if (dockLabel) {
    dockLabel.textContent = label;
    dockLabel.style.color = color;
  }
  if (dockDot) {
    dockDot.style.background = color;
    dockDot.style.boxShadow = `0 0 10px ${color}`;
    dockDot.style.animation = state === "listening" || state === "speaking" ? "pulseDot 1s infinite" : "pulseDot 2.4s infinite";
  }
  if (dockConv) {
    dockConv.classList.toggle("on", conversation);
    dockConv.textContent = conversation ? "■ END" : "● CONVERSATION";
  }
  if (dockSub) dockSub.textContent = stateMsg || "";
  if (dockBars) dockBars.classList.toggle("live", state === "listening" || state === "speaking");
}

function buildDock() {
  dock = document.createElement("div");
  dock.id = "voiceDock";
  dock.innerHTML = `
    <div class="vd-top">
      <span class="vd-dot"></span>
      <span class="vd-label mono"></span>
      <div class="vd-bars"><i></i><i></i><i></i><i></i><i></i></div>
      <button class="vd-x" title="Voice settings">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2-1.2L14.5 3h-5L9 5.6a7.6 7.6 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 002 1.2L9.5 21h5l.4-2.6a7.6 7.6 0 002-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/></svg>
      </button>
    </div>
    <div class="vd-sub mono"></div>
    <div class="vd-actions">
      <button class="btn btn-sm">🎙 TALK</button>
      <button class="btn btn-sm">● CONVERSATION</button>
    </div>`;
  document.body.appendChild(dock);
  dockDot = dock.querySelector(".vd-dot");
  dockLabel = dock.querySelector(".vd-label");
  dockSub = dock.querySelector(".vd-sub");
  dockBars = dock.querySelector(".vd-bars");
  dockConv = dock.querySelectorAll<HTMLButtonElement>(".vd-actions .btn")[1];
  dock.querySelectorAll<HTMLButtonElement>(".vd-actions .btn")[0].addEventListener("click", tapMic);
  dockConv.addEventListener("click", () => (conversation ? endConversation("Conversation ended.") : startConversation()));
  dock.querySelector<HTMLElement>(".vd-x")!.addEventListener("click", openSettings);
  setState(SUPPORTED && cfg.enabled ? "ready" : SUPPORTED ? "off" : "error", SUPPORTED ? "READY" : "UNSUPPORTED");
}

/* ---------------- settings + tests ---------------- */
function row(label: string, control: string, hint?: string) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,0.07)">
    <div><div style="font-size:13px;font-weight:600">${label}</div>
    ${hint ? `<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">${hint}</div>` : ""}</div>
    <div style="display:flex;align-items:center;gap:8px;min-width:180px;justify-content:flex-end">${control}</div></div>`;
}

function openSettings() {
  stopRecs();
  stopWake();
  stopSpeaking();
  loadVoices();
  const root = document.createElement("div");
  root.className = "modal-root";
  root.innerHTML = `
    <div class="modal-back"></div>
    <div class="modal" style="width:min(620px,100%)">
      <div class="panel-h"><span class="t" style="color:var(--txt)">VOICE SETTINGS</span>
        <span class="badge info" style="margin-left:auto">BROWSER ENGINE · $0</span>
        <button class="btn btn-sm" data-close style="margin-left:8px">✕</button></div>
      <div class="panel-b">
        ${row("Voice mode", `<div class="toggle ${cfg.enabled ? "on" : ""}" data-k="enabled"></div>`, "Master switch — when OFF the microphone is never touched")}
        ${row("Microphone", `<select data-mic style="width:210px"><option value="">Default microphone</option></select>`, "Windows may list several input devices")}
        ${row("Voice", `<select data-voice style="width:210px"><option value="">Auto (best natural voice)</option></select>`, "Natural voices depend on your Windows language packs")}
        ${row("Speaking speed", `<input type="range" data-rate min="0.7" max="1.4" step="0.05" value="${cfg.rate}" style="width:140px"><span class="mono" data-ratev style="font-size:11px;width:38px">${cfg.rate.toFixed(2)}</span>`)}
        ${row("Output volume", `<input type="range" data-vol min="0" max="1" step="0.05" value="${cfg.volume}" style="width:140px"><span class="mono" data-volv style="font-size:11px;width:38px">${Math.round(cfg.volume * 100)}%</span>`)}
        ${row("Continuous conversation", `<div class="toggle ${cfg.continuous ? "on" : ""}" data-k="continuous"></div>`, "AI listens again automatically after each answer")}
        ${row("Wake word", `<div class="toggle ${cfg.wakeWord ? "on" : ""}" data-k="wakeWord"></div><input data-waketxt value="${cfg.wakeWordText}" style="width:86px" maxlength="14">`, 'Say "' + cfg.wakeWordText + '" to wake me. Nothing is recorded while OFF.')}
        ${row("Max conversation length", `<select data-max style="width:110px">${[1, 2, 5, 10, 30].map((m) => `<option value="${m}" ${cfg.maxMinutes === m ? "selected" : ""}>${m} min</option>`).join("")}</select>`, "Cost control — conversation stops after this")}
        <div class="mono" style="font-size:10px;color:var(--txt-3);padding:10px 0;line-height:1.7">
          PRIVACY · audio streams to your browser's speech engine and is <b>never recorded or stored</b>. Only transcripts enter chat history, following your memory settings.
          COST · this engine is free. Realtime cloud voice (OpenAI) can be added in Phase 2 via VOICE_API_KEY — it is metered.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;padding:6px 0 2px">
          <button class="btn btn-sm" data-t="mic">TEST MICROPHONE</button>
          <button class="btn btn-sm" data-t="spk">TEST SPEAKER</button>
          <button class="btn btn-sm" data-t="rec">TEST RECOGNITION</button>
          <button class="btn btn-sm btn-acc" data-t="full">TEST FULL CONVERSATION</button>
        </div>
        <div data-meterwrap style="display:none;margin-top:8px">
          <div class="mono" style="font-size:10px;color:var(--txt-2);margin-bottom:5px" data-meterlabel>Speak now — input level:</div>
          <div class="bar-track" style="height:9px"><div class="bar-fill" data-meterfill style="width:0%"></div></div>
        </div>
        <div data-result class="mono" style="font-size:11px;margin-top:10px;line-height:1.9;color:var(--txt-2)"></div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const resEl = q<HTMLDivElement>("[data-result]");
  const results: Record<string, boolean | null> = { mic: null, spk: null, rec: null, ai: null };
  let meterStream: MediaStream | null = null;
  let meterRaf = 0;

  const close = () => {
    window.cancelAnimationFrame(meterRaf);
    if (meterStream) meterStream.getTracks().forEach((t) => t.stop());
    root.remove();
    maybeStartWake();
  };
  q("[data-close]").addEventListener("click", close);
  q(".modal-back").addEventListener("click", close);

  const selMic = q<HTMLSelectElement>("[data-mic]");
  const selVoice = q<HTMLSelectElement>("[data-voice]");
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devs) => {
        const mics = devs.filter((d) => d.kind === "audioinput");
        selMic.innerHTML =
          '<option value="">Default microphone</option>' +
          mics
            .map(
              (d, i) =>
                `<option value="${d.deviceId}" ${cfg.micId === d.deviceId ? "selected" : ""}>${d.label || "Microphone " + (i + 1)}</option>`
            )
            .join("");
      })
      .catch(() => undefined);
  }
  voices.forEach((v) => {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = `${v.name} (${v.lang})`;
    if (cfg.voiceURI === v.voiceURI) o.selected = true;
    selVoice.appendChild(o);
  });
  selMic.addEventListener("change", () => {
    cfg.micId = selMic.value;
    saveCfg();
  });
  selVoice.addEventListener("change", () => {
    cfg.voiceURI = selVoice.value;
    saveCfg();
    speak("This is how I sound.");
  });
  q<HTMLInputElement>("[data-rate]").addEventListener("input", (e) => {
    cfg.rate = parseFloat((e.target as HTMLInputElement).value);
    q("[data-ratev]").textContent = cfg.rate.toFixed(2);
    saveCfg();
  });
  q<HTMLInputElement>("[data-vol]").addEventListener("input", (e) => {
    cfg.volume = parseFloat((e.target as HTMLInputElement).value);
    q("[data-volv]").textContent = Math.round(cfg.volume * 100) + "%";
    saveCfg();
  });
  root.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => {
    el.addEventListener("click", () => {
      const k = el.getAttribute("data-k") as keyof VoiceCfg;
      (cfg as any)[k] = !(cfg as any)[k];
      el.classList.toggle("on", (cfg as any)[k]);
      saveCfg();
      if (k === "enabled") {
        if (!cfg.enabled) {
          stopRecs();
          stopWake();
          stopSpeaking();
          conversation = false;
          setState("off", "VOICE OFF");
        } else setState("ready", "READY");
      }
      if (k === "wakeWord") cfg.wakeWord ? maybeStartWake() : stopWake();
    });
  });
  q<HTMLInputElement>("[data-waketxt]").addEventListener("change", (e) => {
    cfg.wakeWordText = ((e.target as HTMLInputElement).value || "jarvis").toLowerCase().trim();
    saveCfg();
    maybeStartWake();
  });
  q<HTMLSelectElement>("[data-max]").addEventListener("change", (e) => {
    cfg.maxMinutes = parseInt((e.target as HTMLSelectElement).value, 10);
    saveCfg();
  });

  const paint = () => {
    const mark = (v: boolean | null) =>
      v === null
        ? '<span style="color:var(--txt-3)">○ not tested</span>'
        : v
        ? '<span style="color:var(--acc)">✓ pass</span>'
        : '<span style="color:var(--danger)">✗ fail</span>';
    resEl.innerHTML =
      "Microphone &nbsp;" + mark(results.mic) + " &nbsp;·&nbsp; Speech recognition &nbsp;" + mark(results.rec) + "<br>" +
      "AI engine &nbsp;" + mark(results.ai) + " &nbsp;·&nbsp; Voice output &nbsp;" + mark(results.spk);
  };
  paint();

  const testMic = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      results.mic = false;
      paint();
      return;
    }
    q<HTMLElement>("[data-meterwrap]").style.display = "block";
    const fill = q<HTMLElement>("[data-meterfill]");
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    navigator.mediaDevices
      .getUserMedia({ audio: cfg.micId ? { deviceId: { exact: cfg.micId } } : true })
      .then((stream) => {
        meterStream = stream;
        const ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        const started = Date.now();
        let seen = 0;
        const loop = () => {
          an.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const lvl = Math.min(100, (sum / data.length) * 2.2);
          seen = Math.max(seen, lvl);
          fill.style.width = lvl + "%";
          if (Date.now() - started < 3500) meterRaf = requestAnimationFrame(loop);
          else {
            stream.getTracks().forEach((t) => t.stop());
            q<HTMLElement>("[data-meterwrap]").style.display = "none";
            results.mic = seen >= 6;
            paint();
            if (seen < 6)
              resEl.innerHTML +=
                "<br><span style='color:var(--warn)'>Mic opened but no signal — check it is selected and not muted in Windows.</span>";
          }
        };
        loop();
      })
      .catch((err: DOMException) => {
        q<HTMLElement>("[data-meterwrap]").style.display = "none";
        results.mic = false;
        paint();
        resEl.innerHTML +=
          "<br><span style='color:var(--warn)'>" +
          (err && err.name === "NotAllowedError"
            ? "MICROPHONE BLOCKED — Windows Settings → Privacy & security → Microphone → allow desktop apps; also allow mic via the 🔒 icon in the address bar."
            : err && err.name === "NotFoundError"
            ? "NO MICROPHONE FOUND — plug one in or select another device above."
            : "Microphone error: " + (err && err.name) + ".") +
          "</span>";
      });
  };

  const testRecognition = (full: boolean) => {
    if (!SUPPORTED) {
      results.rec = false;
      paint();
      resEl.innerHTML += "<br><span style='color:var(--warn)'>Speech recognition needs Chrome or Edge.</span>";
      return;
    }
    q<HTMLElement>("[data-meterwrap]").style.display = "block";
    q("[data-meterlabel]").textContent = 'Say anything, e.g. "hello jarvis"…';
    const r = makeRec({});
    let got = "";
    r.onresult = (e: any) => {
      for (let i = 0; i < e.results.length; i++) got += e.results[i][0].transcript;
      q("[data-meterlabel]").textContent = "Heard: " + got;
    };
    r.onend = () => {
      q<HTMLElement>("[data-meterwrap]").style.display = "none";
      results.rec = got.trim().length > 0;
      results.ai = results.rec;
      if (full) {
        speak("Hello. Voice communication is working.", () => {
          results.spk = true;
          paint();
          maybeStartWake();
        });
        results.spk = true;
        if (results.mic === null) results.mic = results.rec;
      }
      paint();
      if (results.rec) resEl.innerHTML += `<br><span style="color:var(--acc)">Recognized: "${got.trim()}"</span>`;
      maybeStartWake();
    };
    r.onerror = (e: any) => {
      q<HTMLElement>("[data-meterwrap]").style.display = "none";
      results.rec = false;
      paint();
      resEl.innerHTML += `<br><span style='color:var(--warn)'>Recognition error: ${e.error}</span>`;
    };
    try {
      r.start();
    } catch {
      results.rec = false;
      paint();
    }
  };

  q("[data-t='mic']").addEventListener("click", testMic);
  q("[data-t='spk']").addEventListener("click", () => {
    speak("Speaker test. This is how I will sound.", () => {
      results.spk = true;
      paint();
      maybeStartWake();
    });
    results.spk = true;
    paint();
  });
  q("[data-t='rec']").addEventListener("click", () => testRecognition(false));
  q("[data-t='full']").addEventListener("click", () => {
    resEl.innerHTML = '<span style="color:var(--info)">Full conversation test — say something now…</span>';
    testRecognition(true);
  });
}

/* ---------------- public API ---------------- */
let inited = false;
export const voice = {
  init() {
    if (inited) return;
    inited = true;
    buildDock();
    maybeStartWake();
  },
  tapMic,
  startConversation,
  endConversation,
  openSettings,
  onReplyRendered,
  attachConsole(send: SendFn) {
    sendFn = send;
    if (pendingAsk) {
      const p = pendingAsk;
      pendingAsk = null;
      window.setTimeout(() => send(p, { voice: true }), 260);
    }
  },
  detachConsole() {
    sendFn = null;
  },
  setNavigate(fn: (route: string) => boolean, getRoute: () => string) {
    navigateFn = fn;
    getRouteFn = getRoute;
  },
  /* modals register here so voice can confirm/deny (same RBAC gate) */
  registerConfirm(ask: () => string, resolve: (ok: boolean) => void) {
    confirmAsk = ask;
    confirmResolve = resolve;
  },
  clearConfirm(resolve: (ok: boolean) => void) {
    if (confirmResolve === resolve) {
      confirmResolve = null;
      confirmAsk = null;
    }
  },
  supported: SUPPORTED,
  state: () => state,
};
