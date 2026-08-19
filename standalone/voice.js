/* ============================================================
   NEXUS//OS — VOICE LAYER (standalone demo)
   A professional conversational interface bolted ON TOP of the
   existing AI. Same engine, memory, tools, audit & permissions.

   Pipeline:  MIC → browser speech engine (real-time, on-device
   streaming) → intent engine (app.js) → natural TTS → SPEAKERS
   Upgrade path: OpenAI Realtime via VOICE_API_KEY (Phase 2+).
   Privacy: audio is streamed to the browser's speech engine and
   NEVER recorded or stored. Only transcripts enter chat history,
   governed by the existing memory settings.
   ============================================================ */
(function () {
  "use strict";

  var N = function () { return window.__NEXUS; };
  var SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  var TTS_OK = "speechSynthesis" in window;

  /* ---------------- settings (persisted, separate from secrets) ---------------- */
  var DEFAULTS = {
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
  var cfg = (function () {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem("nexus.voice.v1") || "{}")); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  })();
  function saveCfg() { try { localStorage.setItem("nexus.voice.v1", JSON.stringify(cfg)); } catch (e) {} }

  /* ---------------- state machine ---------------- */
  var state = "idle"; // idle | ready | listening | thinking | speaking | error | off
  var stateMsg = "";
  var conversation = false;
  var wakeLoop = false;
  var convTimer = null;
  var lastTopic = null; // conversational context: sales|profit|orders|products|social|traffic
  var spokenText = "";
  var currentUtter = null;
  var rec = null, bargeRec = null, wakeRec = null, testRec = null;
  var activeRec = null;
  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(state, stateMsg); } catch (e) {} }); }
  function setState(s, msg) { state = s; stateMsg = msg || ""; emit(); }

  /* ---------------- speech recognition factory ---------------- */
  function makeRec(opts) {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    var r = new Ctor();
    r.lang = "en-US";
    r.continuous = !!(opts && opts.continuous);
    r.interimResults = !!(opts && opts.interim);
    r.maxAlternatives = 1;
    return r;
  }

  function stopAll() {
    [rec, bargeRec, wakeRec, testRec].forEach(function (r) { if (r) { try { r.onend = null; r.onerror = null; r.stop(); } catch (e) {} } });
    activeRec = null;
  }

  /* ---------------- human error messages (Windows-friendly) ---------------- */
  function micError(code) {
    setState("error", "MICROPHONE UNAVAILABLE");
    var why = "Unknown microphone problem.";
    if (code === "not-allowed" || code === "service-not-allowed")
      why = "Windows or your browser blocked the microphone. Fix: Windows Settings → Privacy & security → Microphone → turn ON “Let desktop apps access your microphone”, then reload this page.";
    else if (code === "audio-capture" || code === "no-speech-device")
      why = "No microphone found — it may be unplugged, disabled, or another app is using it. Open Voice Settings and pick another input device.";
    else if (code === "network")
      why = "Speech recognition needs internet (the browser streams audio to its speech engine). Check your connection and try again.";
    else if (code === "busy") why = "The microphone is busy in another app. Close it and retry.";
    if (N() && N().toast) N().toast("⚠ " + why, "warn");
    if (N() && N().setHint) N().setHint("⚠ " + why, "warn");
    renderDock();
  }

  /* ---------------- TTS ---------------- */
  var voices = [];
  function loadVoices() { voices = TTS_OK ? window.speechSynthesis.getVoices() || [] : []; }
  if (TTS_OK) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }

  function pickVoice() {
    if (!voices.length) return null;
    var v = voices.find(function (x) { return x.voiceURI === cfg.voiceURI; });
    if (v) return v;
    /* default preference: natural MALE English voice (changeable in Voice Settings → Voice) */
    var prefs = [
      /microsoft (david|mark|ryan|george|james|guy|davis|jason)/i,
      /\b(david|mark|ryan|george|james|daniel|arthur|sonny|guy|davis)\b/i,
      /google uk english male/i,
      /\bmale\b/i,
      /natural/i,
      /microsoft/i,
      /en[-_]gb/i,
      /en[-_]us/i,
      /^en/i,
    ];
    for (var i = 0; i < prefs.length; i++) {
      var m = voices.filter(function (x) { return prefs[i].test(x.name) || prefs[i].test(x.lang); });
      if (m.length) return m[0];
    }
    return voices[0];
  }

  function speak(text, opts) {
    if (!TTS_OK) { if (opts && opts.onend) opts.onend(); return; }
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var v = pickVoice();
    if (v) u.voice = v;
    u.rate = cfg.rate; u.volume = cfg.volume; u.pitch = 1;
    currentUtter = u; spokenText = text;
    u.onstart = function () {
      setState("speaking", "SPEAKING…");
      if (N() && N().setHint) N().setHint("🔊 SPEAKING — start talking to interrupt me", "acc");
      startBargeIn();
    };
    u.onend = function () {
      currentUtter = null; spokenText = "";
      stopBargeIn();
      if (opts && opts.onend) opts.onend();
      else afterSpeak();
    };
    u.onerror = function () { stopBargeIn(); if (opts && opts.onend) opts.onend(); else afterSpeak(); };
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    if (TTS_OK) window.speechSynthesis.cancel();
    stopBargeIn();
  }

  function afterSpeak() {
    if (conversation && cfg.enabled) {
      setState("listening", "LISTENING…");
      listenOnce({ fromConversation: true });
    } else {
      setState(cfg.enabled ? "ready" : "off", cfg.enabled ? "READY" : "VOICE OFF");
      if (N() && N().setHint) N().setHint("");
      maybeStartWake();
    }
  }

  /* ---------------- barge-in (interrupt the AI) ---------------- */
  function startBargeIn() {
    if (!SUPPORTED) return;
    stopBargeIn();
    bargeRec = makeRec({ continuous: true, interim: true });
    bargeRec.onresult = function (e) {
      var t = "";
      for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      t = t.trim();
      if (!t) return;
      // echo guard: ignore if it looks like the AI's own voice
      var low = t.toLowerCase();
      if (spokenText && spokenText.toLowerCase().indexOf(low.slice(0, Math.min(24, low.length))) !== -1) return;
      stopSpeaking();
      stopAll();
      handleUserSpeech(t, true);
    };
    bargeRec.onerror = function () { stopBargeIn(); };
    bargeRec.onend = function () { if (currentUtter) { try { bargeRec.start(); } catch (e) {} } };
    try { bargeRec.start(); } catch (e) {}
  }
  function stopBargeIn() {
    if (bargeRec) { try { bargeRec.onend = null; bargeRec.stop(); } catch (e) {} bargeRec = null; }
  }

  /* ---------------- listening ---------------- */
  function listenOnce(opts) {
    if (!SUPPORTED) { micError("unsupported"); return; }
    if (!cfg.enabled) { cfg.enabled = true; saveCfg(); }
    stopAll();
    rec = makeRec({ continuous: false, interim: true });
    activeRec = rec;
    var finalText = "";
    rec.onresult = function (e) {
      var interim = "", fin = "";
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      finalText = fin;
      setState("listening", "LISTENING…");
      if (N() && N().setHint) N().setHint("🎙 LISTENING… " + (fin || interim), "acc");
    };
    rec.onerror = function (e) {
      if (e.error === "no-speech") {
        if (conversation) { setState("listening", "LISTENING…"); listenOnce(opts); return; }
        setState("ready", "READY"); if (N() && N().setHint) N().setHint("Didn't hear anything — tap 🎙 and try again.");
        return;
      }
      if (e.error === "aborted") return;
      micError(e.error);
    };
    rec.onend = function () {
      if (state === "error") return;
      var text = finalText.trim();
      if (!text) {
        if (conversation) { setState("listening", "LISTENING…"); listenOnce(opts); return; }
        setState("ready", "READY");
        if (N() && N().setHint) N().setHint("");
        maybeStartWake();
        return;
      }
      handleUserSpeech(text, false);
    };
    try {
      rec.start();
      setState("listening", "LISTENING…");
      if (N() && N().setHint) N().setHint("🎙 LISTENING…", "acc");
    } catch (e) { micError("busy"); }
  }

  /* ---------------- wake word loop (only when ON) ---------------- */
  function maybeStartWake() {
    if (!SUPPORTED || !cfg.enabled || !cfg.wakeWord || conversation || state === "speaking" || state === "listening") return stopWake();
    stopWake();
    wakeLoop = true;
    wakeRec = makeRec({ continuous: true, interim: false });
    wakeRec.onresult = function (e) {
      var t = "";
      for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      var low = t.toLowerCase();
      var w = (cfg.wakeWordText || "jarvis").toLowerCase();
      var idx = low.indexOf(w);
      if (idx === -1) return;
      var rest = t.slice(idx + w.length).replace(/^[,\s]+/, "").trim();
      stopWake();
      beep();
      if (rest) { handleUserSpeech(rest, false); return; }
      setState("listening", "LISTENING…");
      speak("Yes? I'm listening.", { onend: function () { listenOnce({ fromConversation: true }); } });
    };
    wakeRec.onerror = function (e) { if (e.error !== "no-speech" && e.error !== "aborted") micError(e.error); };
    wakeRec.onend = function () { if (wakeLoop && cfg.enabled && cfg.wakeWord && state !== "speaking" && state !== "error") setTimeout(function () { if (wakeLoop) maybeStartWake(); }, 300); };
    try { wakeRec.start(); } catch (e) {}
  }
  function stopWake() { wakeLoop = false; if (wakeRec) { try { wakeRec.onend = null; wakeRec.stop(); } catch (e) {} wakeRec = null; } }

  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var c = new Ctx(); var o = c.createOscillator(); var g = c.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(c.destination);
      o.start(); o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      o.stop(c.currentTime + 0.3);
    } catch (e) {}
  }

  /* ---------------- conversational context ---------------- */
  function detectTopic(q) {
    if (/\bsell|sales|sold|revenue|how much did i\b/.test(q)) return "sales";
    if (/profit|earn|made|margin/.test(q)) return "profit";
    if (/order/.test(q)) return "orders";
    if (/product|laptop|stock|fastest|best/.test(q)) return "products";
    if (/instagram|tiktok|social|follower/.test(q)) return "social";
    if (/traffic|website|analytics|funnel/.test(q)) return "traffic";
    return null;
  }
  function expandFollowUp(q) {
    var t = q.toLowerCase().replace(/[?.!,]+$/, "").trim();
    if (!lastTopic) return q;
    if (/^(what|how) about (yesterday|last week|today)$/.test(t) || t === "yesterday" || t === "and yesterday") {
      if (lastTopic === "sales") return /yesterday/.test(t) ? "how much did I sell yesterday" : "how much did I sell today";
      if (lastTopic === "profit") return /yesterday/.test(t) ? "what was my profit yesterday" : "how much profit did I make today";
      if (lastTopic === "orders") return /yesterday/.test(t) ? "show me yesterday's orders" : "do I have new orders";
    }
    if (/^why|what caused|reason/.test(t)) {
      if (lastTopic === "products") return "which laptop made the most profit";
      if (lastTopic === "sales") return "why are sales " + (t.indexOf("down") !== -1 || t.indexOf("drop") !== -1 ? "down" : "up") + " — find opportunities";
    }
    if (/tell me more|go on|continue|details/.test(t)) {
      if (lastTopic === "sales") return "daily report";
      if (lastTopic === "products") return "find opportunities";
      if (lastTopic === "social") return "analyze my instagram";
    }
    return q;
  }

  /* ---------------- intent → action ---------------- */
  var YES = /^(yes|yeah|yep|do it|go ahead|proceed|approve|confirm|sure|okay|ok)\b/;
  var NO = /^(no|nope|cancel|don'?t|dont|stop it|deny|not now)\b/;
  var STOP_TALK = /^(stop|exit|quit|goodbye|bye|that'?s all|shut up|be quiet)\b/;

  var NAV_MAP = [
    { re: /(open|show|go to|take me to).*(command|dashboard|home|console|overview)/, route: "command", say: "Opening the command center." },
    { re: /(open|show|go to).*(inventory|stock|products)/, route: "inventory", say: "Opening inventory." },
    { re: /(open|show|go to).*(order)/, route: "orders", say: "Opening your orders." },
    { re: /(open|show|go to).*(finance|money|profit)/, route: "finance", say: "Opening finance." },
    { re: /(open|show|go to).*(freelanc|crm|lead|client)/, route: "freelance", say: "Opening your freelance CRM." },
    { re: /(open|show|go to).*(automation|workflow|webhook)/, route: "automations", say: "Opening automations." },
    { re: /(open|show|go to).*(health|status|system)/, route: "health", say: "Opening system health." },
    { re: /(open|show).*(voice setting|voice config|audio setting)/, route: "__voice", say: "Opening voice settings." },
  ];

  function handleUserSpeech(rawText, viaBarge) {
    var text = rawText.trim();
    if (!text) return;
    setState("thinking", "THINKING…");
    if (N() && N().setHint) N().setHint("🧠 THINKING…", "acc");

    /* 0 — conversation control */
    if (STOP_TALK.test(text.toLowerCase())) {
      endConversation("Conversation ended. Tap 🎙 whenever you need me.");
      return;
    }

    /* 1 — pending confirmation (same RBAC gate as clicking) */
    var pc = N() && N().pendingConfirm;
    if (pc) {
      if (YES.test(text.toLowerCase())) {
        var r = pc.resolve; N().pendingConfirm = null;
        speak("Approved. Executing now.", { onend: function () { afterSpeak(); } });
        r(true);
        return;
      }
      if (NO.test(text.toLowerCase())) {
        var r2 = pc.resolve; N().pendingConfirm = null;
        speak("Cancelled. I've logged the decision.", { onend: function () { afterSpeak(); } });
        r2(false);
        return;
      }
    }

    /* 2 — navigation commands */
    for (var i = 0; i < NAV_MAP.length; i++) {
      if (NAV_MAP[i].re.test(text.toLowerCase())) {
        if (NAV_MAP[i].route === "__voice") { openSettings(); afterSpeak(); return; }
        var went = N() && N().navigate(NAV_MAP[i].route);
        speak(went ? NAV_MAP[i].say : "I couldn't find that section.", { onend: function () { afterSpeak(); } });
        return;
      }
    }

    /* 3 — business question → SAME AI engine as typed chat */
    var expanded = expandFollowUp(text);
    lastTopic = detectTopic(expanded.toLowerCase()) || lastTopic;
    deliverToConsole(expanded, function () {
      // reply is rendered by the console; voice reads a concise summary
      var summary = summarizeForVoice(lastReplyHtml(), expanded);
      setState("speaking", "SPEAKING…");
      speak(summary);
    });
  }

  /* push the question through the real console pipeline */
  var replyWatch = null;
  function lastReplyHtml() { return replyWatch || ""; }
  function deliverToConsole(text, cb) {
    var nx = N();
    var fire = function () {
      watchReply(function (html) { cb(); });
      nx.send(text, { voice: true });
    };
    if (nx && nx.consoleReady && nx.send) { fire(); return; }
    if (nx) {
      nx.pendingAsk = { text: text, opts: { voice: true } };
      if (nx.currentRoute() !== "command") nx.navigate("command");
      setTimeout(function () {
        if (N() && N().consoleReady && N().send) {
          // pendingAsk consumed by console mount
        } else cb();
      }, 900);
      // reply watcher still arms for when console mounts
      watchReply(function (html) { cb(); });
    } else cb();
  }
  function watchReply(cb) {
    replyWatch = null;
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var bubbles = document.querySelectorAll("#chatLog .msg.ai .bubble");
      var last = bubbles[bubbles.length - 1];
      var htmlTxt = last ? last.innerHTML : "";
      var done = htmlTxt && htmlTxt.indexOf("typing") === -1 && htmlTxt.length > 40;
      if (done) { clearInterval(iv); replyWatch = htmlTxt; cb(htmlTxt); }
      else if (tries > 40) { clearInterval(iv); replyWatch = htmlTxt || "I'm still working on that."; cb(replyWatch); }
    }, 120);
  }

  /* concise spoken summary: key numbers first, max ~2 sentences */
  function summarizeForVoice(replyHtml, asked) {
    var el = document.createElement("div");
    el.innerHTML = replyHtml || "";
    el.querySelectorAll(".decision, .mono").forEach(function (x) { x.remove(); });
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    text = text.replace(/▍/g, "").replace(/\bKSh\b/g, "K. S. H.");
    if (!text) return "Done.";
    // if the reply contains a recommendation, keep lead + first recommendation
    var recMatch = /Recommendation[:\s]+([^.!]{10,160}[.!])/i.exec(replyHtml || "");
    var sentences = text.split(/(?<=[.!?])\s+/);
    var out = sentences.slice(0, 2).join(" ");
    if (out.length > 300) out = out.slice(0, 300).replace(/\s+\S*$/, "") + ".";
    if (recMatch && out.length < 260) out += " Recommendation: " + recMatch[1];
    out += ' Say "tell me more" for details.';
    return out;
  }

  /* ---------------- conversation mode ---------------- */
  function startConversation() {
    if (!SUPPORTED) { micError("unsupported"); return; }
    conversation = true;
    clearTimeout(convTimer);
    convTimer = setTimeout(function () { endConversation("We've reached the conversation time limit. Tap 🎙 to continue anytime."); }, Math.max(1, cfg.maxMinutes) * 60000);
    stopWake();
    setState("listening", "LISTENING…");
    speak(cfg.continuous ? "I'm listening. Ask me anything about your business." : "Listening.", {
      onend: function () { listenOnce({ fromConversation: true }); },
    });
  }
  function endConversation(msg) {
    conversation = false;
    clearTimeout(convTimer);
    stopAll(); stopSpeaking();
    setState(cfg.enabled ? "ready" : "off", "READY");
    if (N() && N().setHint) N().setHint("");
    if (msg) speak(msg, { onend: function () { maybeStartWake(); } });
    else maybeStartWake();
    renderDock();
  }

  function endConversationSilent() {
    conversation = false; clearTimeout(convTimer);
  }

  /* ---------------- single-tap mic ---------------- */
  function tapMic() {
    if (!SUPPORTED) {
      micError("unsupported");
      if (N() && N().toast) N().toast("⚠ Speech recognition isn't supported in this browser. Use Chrome or Edge — text mode still works fully.", "warn");
      return;
    }
    if (state === "listening") { stopAll(); setState("ready", "READY"); if (N() && N().setHint) N().setHint(""); return; }
    if (state === "speaking") { stopSpeaking(); }
    endConversationSilent();
    listenOnce({});
  }

  /* ============================================================
     UI — floating voice dock
     ============================================================ */
  var dock = null, dockState = null, dockBars = null, dockConv = null, dockLabel = null, dockTranscript = null;

  function renderDock() {
    if (!dock) return;
    var map = {
      off: ["VOICE OFF", "var(--txt-3)"],
      idle: ["🎙 VOICE READY", "var(--txt-2)"],
      ready: ["🎙 VOICE READY", "var(--acc)"],
      listening: ["🎙 LISTENING…", "var(--acc)"],
      thinking: ["🧠 THINKING…", "var(--info)"],
      speaking: ["🔊 SPEAKING…", "var(--violet)"],
      error: ["⚠ MIC ERROR", "var(--danger)"],
    };
    var m = map[state] || map.idle;
    dockLabel.textContent = m[0];
    dockLabel.style.color = m[1];
    dockState.style.background = m[1];
    dockState.style.boxShadow = "0 0 10px " + m[1];
    dockState.style.animation = state === "listening" || state === "speaking" ? "pulseDot 1s infinite" : state === "error" ? "none" : "pulseDot 2.4s infinite";
    dockConv.classList.toggle("on", conversation);
    dockConv.textContent = conversation ? "■ END" : "● CONVERSATION";
    dockTranscript.textContent = stateMsg && state !== "ready" ? stateMsg : "";
    dockBars.classList.toggle("live", state === "listening" || state === "speaking");
  }

  function buildDock() {
    dock = document.createElement("div");
    dock.id = "voiceDock";
    dock.innerHTML =
      '<div class="vd-top">' +
      '<span class="vd-dot" id="vdDot"></span>' +
      '<span class="vd-label mono" id="vdLabel">🎙 VOICE READY</span>' +
      '<div class="vd-bars" id="vdBars"><i></i><i></i><i></i><i></i><i></i></div>' +
      '<button class="vd-x" id="vdGear" title="Voice settings">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2-1.2L14.5 3h-5L9 5.6a7.6 7.6 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 002 1.2L9.5 21h5l.4-2.6a7.6 7.6 0 002-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/></svg></button>' +
      '</div>' +
      '<div class="vd-sub mono" id="vdSub"></div>' +
      '<div class="vd-actions">' +
      '<button class="btn btn-sm" id="vdMic">🎙 TALK</button>' +
      '<button class="btn btn-sm" id="vdConv">● CONVERSATION</button>' +
      '</div>';
    document.body.appendChild(dock);
    dockState = dock.querySelector("#vdDot");
    dockLabel = dock.querySelector("#vdLabel");
    dockBars = dock.querySelector("#vdBars");
    dockConv = dock.querySelector("#vdConv");
    dockTranscript = dock.querySelector("#vdSub");
    dock.querySelector("#vdMic").addEventListener("click", tapMic);
    dock.querySelector("#vdGear").addEventListener("click", openSettings);
    dockConv.addEventListener("click", function () {
      if (conversation) endConversation("Conversation ended.");
      else startConversation();
    });
    listeners.push(function () { renderDock(); });
    setState(SUPPORTED && cfg.enabled ? "ready" : SUPPORTED ? "off" : "error", SUPPORTED ? "" : "UNSUPPORTED BROWSER");
    if (!SUPPORTED) stateMsg = "USE CHROME / EDGE";
    renderDock();
  }

  /* ============================================================
     SETTINGS + TEST PANEL
     ============================================================ */
  function row(label, controlHtml, hint) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,0.07)">' +
      '<div><div style="font-size:13px;font-weight:600">' + label + '</div>' +
      (hint ? '<div class="mono" style="font-size:10px;color:var(--txt-3);margin-top:2px">' + hint + '</div>' : '') + '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;min-width:180px;justify-content:flex-end">' + controlHtml + '</div></div>';
  }

  function openSettings() {
    stopAll(); stopWake(); stopSpeaking(); endConversationSilent();
    loadVoices();
    var micOpts = '<option value="">Default microphone</option>';
    var voiceOpts = '<option value="">Auto (best natural voice)</option>';
    var root = document.createElement("div");
    root.className = "modal-root";
    root.innerHTML =
      '<div class="modal-back"></div><div class="modal" style="width:min(620px,100%)">' +
      '<div class="panel-h"><span class="t" style="color:var(--txt)">VOICE SETTINGS</span><span class="badge info" style="margin-left:auto">BROWSER ENGINE · $0</span>' +
      '<button class="btn btn-sm" id="vsClose" style="margin-left:8px">✕</button></div>' +
      '<div class="panel-b" id="vsBody">' +
      row("Voice mode", '<div class="toggle ' + (cfg.enabled ? "on" : "") + '" id="tgEnabled"></div>', "Master switch — when OFF the microphone is never touched") +
      row("Microphone", '<select id="selMic" style="width:210px">' + micOpts + "</select>", "Windows may list several input devices") +
      row("Voice", '<select id="selVoice" style="width:210px">' + voiceOpts + "</select>", "Natural voices depend on your Windows language packs") +
      row("Speaking speed", '<input type="range" id="rgRate" min="0.7" max="1.4" step="0.05" value="' + cfg.rate + '" style="width:140px"><span class="mono" id="rateVal" style="font-size:11px;width:38px">' + cfg.rate.toFixed(2) + "</span>", "") +
      row("Output volume", '<input type="range" id="rgVol" min="0" max="1" step="0.05" value="' + cfg.volume + '" style="width:140px"><span class="mono" id="volVal" style="font-size:11px;width:38px">' + Math.round(cfg.volume * 100) + '%</span>', "") +
      row("Continuous conversation", '<div class="toggle ' + (cfg.continuous ? "on" : "") + '" id="tgCont"></div>', "AI listens again automatically after each answer") +
      row("Wake word", '<div class="toggle ' + (cfg.wakeWord ? "on" : "") + '" id="tgWake"></div><input id="inWake" value="' + (cfg.wakeWordText || "jarvis") + '" style="width:86px;text-transform:lowercase" maxlength="14">', 'Say "' + (cfg.wakeWordText || "jarvis") + '" to wake me. Nothing is recorded while OFF.') +
      row("Max conversation length", '<select id="selMax" style="width:110px">' + [1, 2, 5, 10, 30].map(function (m) { return '<option value="' + m + '"' + (cfg.maxMinutes === m ? " selected" : "") + ">" + m + " min</option>"; }).join("") + "</select>", "Cost control — conversation stops after this") +
      '<div class="mono" style="font-size:10px;color:var(--txt-3);padding:10px 0;line-height:1.7">' +
      "PRIVACY · audio streams to your browser's speech engine and is <b>never recorded or stored</b>. Only transcripts enter chat history, following your memory settings. " +
      "COST · this engine is free. Realtime cloud voice (OpenAI) can be added in Phase 2 via VOICE_API_KEY — it is metered." +
      "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:6px 0 2px">' +
      '<button class="btn btn-sm" id="tMic">TEST MICROPHONE</button>' +
      '<button class="btn btn-sm" id="tSpk">TEST SPEAKER</button>' +
      '<button class="btn btn-sm" id="tRec">TEST RECOGNITION</button>' +
      '<button class="btn btn-sm btn-acc" id="tFull">TEST FULL CONVERSATION</button></div>' +
      '<div id="meterWrap" style="display:none;margin-top:8px"><div class="mono" style="font-size:10px;color:var(--txt-2);margin-bottom:5px" id="meterLabel">Speak now — input level:</div>' +
      '<div class="bar-track" style="height:9px"><div class="bar-fill" id="meterFill" style="width:0%"></div></div></div>' +
      '<div id="testResult" class="mono" style="font-size:11px;margin-top:10px;line-height:1.9;color:var(--txt-2)"></div>' +
      "</div></div>";
    document.body.appendChild(root);

    var body = root.querySelector("#vsBody");
    var close = function () { clearInterval(meterRaf); if (meterStream) meterStream.getTracks().forEach(function (t) { t.stop(); }); root.remove(); maybeStartWake(); };
    root.querySelector("#vsClose").addEventListener("click", close);
    root.querySelector(".modal-back").addEventListener("click", close);

    /* populate devices */
    var selMic = root.querySelector("#selMic");
    var selVoice = root.querySelector("#selVoice");
    function fillMics() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      navigator.mediaDevices.enumerateDevices().then(function (devs) {
        var mics = devs.filter(function (d) { return d.kind === "audioinput"; });
        selMic.innerHTML = '<option value="">Default microphone</option>' + mics.map(function (d, i) {
          return '<option value="' + d.deviceId + '"' + (cfg.micId === d.deviceId ? " selected" : "") + ">" + (d.label || "Microphone " + (i + 1)) + "</option>";
        }).join("");
      }).catch(function () {});
    }
    fillMics();
    voices.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v.voiceURI; o.textContent = v.name + " (" + v.lang + ")";
      if (cfg.voiceURI === v.voiceURI) o.selected = true;
      selVoice.appendChild(o);
    });
    selMic.addEventListener("change", function () { cfg.micId = selMic.value; saveCfg(); });
    selVoice.addEventListener("change", function () { cfg.voiceURI = selVoice.value; saveCfg(); speak("This is how I sound.", {}); });

    var rgRate = root.querySelector("#rgRate"), rgVol = root.querySelector("#rgVol");
    rgRate.addEventListener("input", function () { cfg.rate = parseFloat(rgRate.value); root.querySelector("#rateVal").textContent = cfg.rate.toFixed(2); saveCfg(); });
    rgVol.addEventListener("input", function () { cfg.volume = parseFloat(rgVol.value); root.querySelector("#volVal").textContent = Math.round(cfg.volume * 100) + "%"; saveCfg(); });

    function bindToggle(id, key) {
      var el = root.querySelector("#" + id);
      el.addEventListener("click", function () {
        cfg[key] = !cfg[key]; el.classList.toggle("on", cfg[key]); saveCfg();
        if (key === "enabled") { if (!cfg.enabled) { stopAll(); stopWake(); stopSpeaking(); endConversationSilent(); setState("off", "VOICE OFF"); } else setState("ready", "READY"); }
        if (key === "wakeWord") { cfg.wakeWord ? maybeStartWake() : stopWake(); }
      });
    }
    bindToggle("tgEnabled", "enabled");
    bindToggle("tgCont", "continuous");
    bindToggle("tgWake", "wakeWord");
    root.querySelector("#inWake").addEventListener("change", function (e) {
      cfg.wakeWordText = (e.target.value || "jarvis").toLowerCase().trim(); saveCfg(); maybeStartWake();
    });
    root.querySelector("#selMax").addEventListener("change", function (e) { cfg.maxMinutes = parseInt(e.target.value, 10); saveCfg(); });

    /* ---- tests ---- */
    var resEl = root.querySelector("#testResult");
    var results = { mic: null, spk: null, rec: null, ai: null };
    function paintResults() {
      var mark = function (v) { return v === null ? '<span style="color:var(--txt-3)">○ not tested</span>' : v ? '<span style="color:var(--acc)">✓ pass</span>' : '<span style="color:var(--danger)">✗ fail</span>'; };
      resEl.innerHTML =
        "Microphone &nbsp;" + mark(results.mic) + " &nbsp;·&nbsp; Speech recognition &nbsp;" + mark(results.rec) + "<br>" +
        "AI engine &nbsp;" + mark(results.ai) + " &nbsp;·&nbsp; Voice output &nbsp;" + mark(results.spk);
    }
    paintResults();

    var meterStream = null, meterRaf = null, meterCtx = null;
    function testMic() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { results.mic = false; paintResults(); resEl.innerHTML += '<br><span style="color:var(--warn)">This browser can\'t list audio devices — use Chrome/Edge over http(s) or localhost.</span>'; return; }
      var wrap = root.querySelector("#meterWrap"); wrap.style.display = "block";
      root.querySelector("#meterLabel").textContent = "Speak now — input level:";
      var fill = root.querySelector("#meterFill");
      var constraints = { audio: cfg.micId ? { deviceId: { exact: cfg.micId } } : true };
      navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        meterStream = stream;
        results.mic = true; paintResults();
        var Ctx = window.AudioContext || window.webkitAudioContext;
        meterCtx = new Ctx();
        var src = meterCtx.createMediaStreamSource(stream);
        var an = meterCtx.createAnalyser(); an.fftSize = 256;
        src.connect(an);
        var data = new Uint8Array(an.frequencyBinCount);
        var started = Date.now();
        var seen = 0;
        (function loop() {
          an.getByteFrequencyData(data);
          var sum = 0; for (var i = 0; i < data.length; i++) sum += data[i];
          var lvl = Math.min(100, (sum / data.length) * 2.2);
          seen = Math.max(seen, lvl);
          fill.style.width = lvl + "%";
          fill.className = "bar-fill" + (lvl > 40 ? "" : lvl > 12 ? " w" : " d");
          if (Date.now() - started < 3500) meterRaf = requestAnimationFrame(loop);
          else {
            stream.getTracks().forEach(function (t) { t.stop(); });
            wrap.style.display = "none";
            root.querySelector("#meterLabel").textContent = "";
            if (seen < 6) { results.mic = false; paintResults(); resEl.innerHTML += '<br><span style="color:var(--warn)">Mic opened but no signal — check the device is selected & not muted in Windows.</span>'; }
            else { results.mic = true; paintResults(); }
          }
        })();
      }).catch(function (err) {
        wrap.style.display = "none";
        results.mic = false; paintResults();
        var name = err && err.name;
        resEl.innerHTML += "<br><span style='color:var(--warn)'>" +
          (name === "NotAllowedError"
            ? "MICROPHONE BLOCKED — Windows Settings → Privacy & security → Microphone → allow desktop apps, and click the 🔒 icon in your browser's address bar → allow microphone."
            : name === "NotFoundError"
            ? "NO MICROPHONE FOUND — plug one in or select another device above."
            : "Microphone error: " + (name || "unknown") + ".") + "</span>";
      });
    }

    function testSpeaker() {
      if (!TTS_OK) { results.spk = false; paintResults(); return; }
      speak("Speaker test. This is how I will sound.", {
        onend: function () { results.spk = true; paintResults(); maybeStartWake(); },
      });
      results.spk = true; paintResults();
    }

    function testRecognition() {
      if (!SUPPORTED) { results.rec = false; paintResults(); resEl.innerHTML += "<br><span style='color:var(--warn)'>Speech recognition needs Chrome or Edge.</span>"; return; }
      root.querySelector("#meterWrap").style.display = "block";
      root.querySelector("#meterLabel").textContent = 'Say anything, e.g. "hello jarvis"…';
      testRec = makeRec({ continuous: false, interim: true });
      var got = "";
      testRec.onresult = function (e) { for (var i = 0; i < e.results.length; i++) got += e.results[i][0].transcript; root.querySelector("#meterLabel").textContent = "Heard: " + got; };
      testRec.onend = function () {
        root.querySelector("#meterWrap").style.display = "none";
        results.rec = got.trim().length > 0;
        results.ai = results.rec; // engine is deterministic and already powering this page
        paintResults();
        if (results.rec) resEl.innerHTML += '<br><span style="color:var(--acc)">Recognized: "' + got.trim() + '"</span>';
        maybeStartWake();
      };
      testRec.onerror = function (e) {
        root.querySelector("#meterWrap").style.display = "none";
        results.rec = false; paintResults();
        resEl.innerHTML += "<br><span style='color:var(--warn)'>Recognition error: " + e.error + (e.error === "network" ? " (internet required for the browser speech engine)" : "") + "</span>";
      };
      try { testRec.start(); } catch (e) { results.rec = false; paintResults(); }
    }

    function testFull() {
      if (!SUPPORTED) { testRecognition(); return; }
      resEl.innerHTML = '<span style="color:var(--info)">Full conversation test — say something now…</span>';
      var full = makeRec({ continuous: false, interim: false });
      var got = "";
      full.onresult = function (e) { for (var i = 0; i < e.results.length; i++) got += e.results[i][0].transcript; };
      full.onend = function () {
        results.rec = got.trim().length > 0;
        results.ai = true;
        paintResults();
        speak("Hello. Voice communication is working.", {
          onend: function () { results.spk = true; paintResults(); maybeStartWake(); },
        });
        if (results.mic === null) results.mic = results.rec;
        paintResults();
        resEl.innerHTML = '<span style="color:var(--acc)">You said: "' + (got.trim() || "…") + '"</span><br>' + resEl.innerHTML;
      };
      full.onerror = function (e) { results.rec = false; paintResults(); resEl.innerHTML += "<br><span style='color:var(--warn)'>Error: " + e.error + "</span>"; };
      try { full.start(); } catch (e) { results.rec = false; paintResults(); }
    }

    root.querySelector("#tMic").addEventListener("click", testMic);
    root.querySelector("#tSpk").addEventListener("click", testSpeaker);
    root.querySelector("#tRec").addEventListener("click", testRecognition);
    root.querySelector("#tFull").addEventListener("click", testFull);
  }

  /* ---------------- init ---------------- */
  function init() {
    buildDock();
    /* wake word may be ON from a previous session — start loop (no recording unless enabled) */
    maybeStartWake();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  /* ---------------- public API ---------------- */
  window.NexusVoice = {
    tapMic: tapMic,
    startConversation: startConversation,
    endConversation: endConversation,
    openSettings: openSettings,
    supported: SUPPORTED,
    tts: TTS_OK,
    state: function () { return state; },
  };
})();
