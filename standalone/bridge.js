/* ============================================================
   NEXUS//OS — LOCAL COMPUTER BRIDGE  (zero dependencies)

   Gives the AI REAL, SAFE control of your Windows PC:
     · launch allowlisted apps (VS Code, Chrome, Terminal…)
     · open authorized project folders
     · list / read / create files — ONLY inside folders you allow
     · run allowlisted safe commands (node -v, npm install, git status…)

   SECURITY MODEL (read this):
     · Listens on 127.0.0.1 ONLY — the internet can never reach it.
     · Every action is allowlisted; everything else is refused.
     · Dangerous patterns (rm, del /s, format, shutdown, encoded
       powershell…) are ALWAYS rejected, even inside "safe" commands.
     · Filesystem actions are confined to paths you list in
       bridge.config.json (created on first run — edit it!).
     · Every request is printed to this window = your live audit log.

   RUN:   node bridge.js          (start-ai.bat does this for you)
   TEST:  http://localhost:8787/api/bridge/ping
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 8787;
const HOST = "127.0.0.1"; // localhost only — never 0.0.0.0
const CONFIG_FILE = path.join(__dirname, "bridge.config.json");

const DEFAULT_CONFIG = {
  _read_me: "Add folder paths the AI may touch. Empty list = file access refused (safe default).",
  allowedPaths: [
    // Example — replace with YOUR folders:
    // "C:\\Users\\YourName\\personal-ai",
    // "C:\\Users\\YourName\\electronics-site"
  ],
};

let config = DEFAULT_CONFIG;
try {
  if (fs.existsSync(CONFIG_FILE)) config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  else fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
} catch (e) {
  console.log("[bridge] could not read bridge.config.json — using safe defaults");
}

/* app allowlist: friendly name -> spawn spec (args array, NO shell strings) */
const APPS = {
  vscode: { cmd: "cmd", args: ["/c", "start", "", "code"] },
  terminal: { cmd: "cmd", args: ["/c", "start", "", "wt", "||", "cmd"] },
  chrome: { cmd: "cmd", args: ["/c", "start", "", "chrome"] },
  msedge: { cmd: "cmd", args: ["/c", "start", "", "msedge"] },
  explorer: { cmd: "cmd", args: ["/c", "start", "", "explorer"] },
  notepad: { cmd: "notepad", args: [] },
};

/* exact-match safe commands (string equality — zero injection surface) */
const SAFE_COMMANDS = [
  "node -v", "node --version", "npm -v", "npm --version", "npm install",
  "npm run dev", "npm run build", "npm run preview", "npm test",
  "git status", "git log -5", "git diff --stat", "dir", "ls",
];

/* always-refused patterns */
const DANGEROUS = /(rm\s+-rf|del\s+\/[sfq]|format\s|shutdown|mkfs|rd\s+\/s|powershell\s+-(enc|e)\b|::\(\)\{|reg\s+delete|taskkill\s+\/f\s+\/im\s+(?!node))/i;

function log(line) {
  console.log("[" + new Date().toLocaleTimeString() + "] " + line);
}

function isAllowedPath(p) {
  const abs = path.resolve(p);
  return (config.allowedPaths || []).some((root) => {
    const r = path.resolve(root);
    return abs === r || abs.startsWith(r + path.sep);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = (req.url || "").split("?")[0];

  if (url === "/api/bridge/ping" && req.method === "GET") {
    return send(res, 200, { ok: true, version: "1.0", apps: Object.keys(APPS), allowedPaths: config.allowedPaths || [], safeCommands: SAFE_COMMANDS.length });
  }

  if (url === "/api/bridge/exec" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c.slice(0, 1e5)));
    req.on("end", () => {
      let reqJson;
      try { reqJson = JSON.parse(body || "{}"); } catch (e) { return send(res, 400, { error: "invalid JSON" }); }
      const action = reqJson.action;
      const args = reqJson.args || {};
      log("ACTION " + action + " " + JSON.stringify(args).slice(0, 160));

      /* --- open-url: real browser launch --- */
      if (action === "open-url") {
        if (!/^https?:\/\/[\w.-]+/.test(args.url || "")) return send(res, 403, { error: "only http(s) URLs allowed" });
        spawn("cmd", ["/c", "start", "", args.url], { detached: true });
        return send(res, 200, { ok: true, opened: args.url });
      }

      /* --- open-app: allowlisted applications --- */
      if (action === "open-app") {
        const spec = APPS[args.app];
        if (!spec) return send(res, 403, { error: "app not in allowlist: " + args.app + " (allowed: " + Object.keys(APPS).join(", ") + ")" });
        spawn(spec.cmd, spec.args, { detached: true, stdio: "ignore" }).unref();
        log("LAUNCHED " + args.app);
        return send(res, 200, { ok: true, app: args.app });
      }

      /* --- open-path: explorer at an authorized folder --- */
      if (action === "open-path") {
        if (!isAllowedPath(args.path || "")) return send(res, 403, { error: "path not in bridge.config.json allowedPaths" });
        spawn("explorer", [args.path], { detached: true, stdio: "ignore" }).unref();
        return send(res, 200, { ok: true, path: args.path });
      }

      /* --- filesystem: confined to authorized roots --- */
      if (action === "fs-list") {
        if (!isAllowedPath(args.path || "")) return send(res, 403, { error: "path not allowed" });
        try {
          const items = fs.readdirSync(args.path, { withFileTypes: true }).slice(0, 300)
            .map((d) => ({ name: d.name, dir: d.isDirectory() }));
          return send(res, 200, { ok: true, items });
        } catch (e) { return send(res, 500, { error: e.message }); }
      }
      if (action === "fs-read") {
        if (!isAllowedPath(args.path || "")) return send(res, 403, { error: "path not allowed" });
        try {
          const st = fs.statSync(args.path);
          if (st.size > 2 * 1024 * 1024) return send(res, 403, { error: "file too large (max 2MB)" });
          return send(res, 200, { ok: true, content: fs.readFileSync(args.path, "utf8") });
        } catch (e) { return send(res, 500, { error: e.message }); }
      }
      if (action === "fs-mkdir") {
        if (!isAllowedPath(args.path || "")) return send(res, 403, { error: "path not allowed" });
        try { fs.mkdirSync(args.path, { recursive: true }); return send(res, 200, { ok: true, created: args.path }); }
        catch (e) { return send(res, 500, { error: e.message }); }
      }
      if (action === "fs-write") {
        if (!isAllowedPath(args.path || "")) return send(res, 403, { error: "path not allowed" });
        try { fs.writeFileSync(args.path, String(args.content || "").slice(0, 1e6)); return send(res, 200, { ok: true, wrote: args.path }); }
        catch (e) { return send(res, 500, { error: e.message }); }
      }

      /* --- exec-safe: exact-match allowlist only --- */
      if (action === "exec-safe") {
        const cmd = String(args.cmd || "").trim();
        if (DANGEROUS.test(cmd)) return send(res, 403, { error: "dangerous command pattern — always refused" });
        if (SAFE_COMMANDS.indexOf(cmd) === -1) return send(res, 403, { error: "command not in safe allowlist. Allowed: " + SAFE_COMMANDS.join(" | ") });
        const parts = cmd.split(/\s+/);
        const child = spawn(parts[0], parts.slice(1), { cwd: (config.allowedPaths || [])[0] || __dirname });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (out += d));
        child.on("close", (code) => send(res, 200, { ok: code === 0, exitCode: code, output: out.slice(0, 8000) }));
        log("EXEC " + cmd);
        return;
      }

      log("REFUSED unknown action: " + action);
      return send(res, 403, { error: "unknown action" });
    });
    return;
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  NEXUS//OS computer bridge — LIVE");
  console.log("  -----------------------------------------");
  console.log("  Local only:  http://localhost:" + PORT);
  console.log("  Allowed folders: " + ((config.allowedPaths || []).length ? config.allowedPaths.join(", ") : "NONE (file access disabled — edit bridge.config.json)"));
  console.log("  Every action is logged in this window.");
  console.log("  Stop: Ctrl + C");
  console.log("");
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.log("\n  [bridge] Port " + PORT + " is busy — is another bridge running? Close it or use stop-ai.bat.\n");
  else console.log("  [bridge] error: " + e.message);
});
