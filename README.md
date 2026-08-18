# NEXUS//OS — Personal AI Business Operating System (Demo)

A personal AI system for a **laptop reselling business**: it monitors your store, tracks orders/revenue/profit, watches inventory, analyzes social + website data, manages freelance leads, automates workflows, and answers plain-English questions — with a command console, sound effects, and an approval-gated AI that never spends money without your sign-off.

> **Demo mode**: everything runs on fictional data stored in your browser's `localStorage`. No real payments, no real customers, no API keys, no backend required.

---

## Two ways to run it

### Option A — Portable demo (recommended, ZERO install steps beyond Node)

**Windows one-click:** double-click **`start-ai.bat`** in the project root — it checks Node.js,
starts the server and opens the dashboard for you. Stop it with **`stop-ai.bat`**.
Full step-by-step Windows guide (install from zero, connect WooCommerce, phone alerts,
troubleshooting): see **`USER_GUIDE.md`**.

Manual version:

Everything you need is in the **`standalone/`** folder. Pure vanilla HTML/CSS/JS — no frameworks, no npm packages.

```bash
# 1. open a terminal inside the standalone folder
cd standalone

# 2. start the tiny built-in server (uses only Node built-ins)
node server.js

# 3. open the printed URL
#    http://localhost:8080
```

**No Node at all?** You can even double-click `standalone/index.html` to open it directly in your browser — it works (a local server is only nicer for fonts/caching).

### Option B — Full development environment (Vite + TypeScript source)

The complete typed source (the version with the Blueprint/architecture tab, AI Tutor lessons, memory controls, full decision engine) lives in `src/`. It needs npm packages:

```bash
# from the project ROOT
npm install
npm run dev        # → http://localhost:5173
```

Production build + preview:

```bash
npm run build
npm run preview    # → http://localhost:4173
```

---

## Requirements (and how to install them)

| Software | Needed for | How to install |
|---|---|---|
| **Node.js 18+** (includes npm) | Option A & B | 1. Go to https://nodejs.org → download the **LTS** version → run the installer → restart your terminal/VS Code → verify with `node -v` and `npm -v` |
| **VS Code** (optional) | Editing | https://code.visualstudio.com |
| **A modern browser** | Running | Chrome / Edge / Firefox |

That's it. **No database, no Python, no API keys for the demo.**

---

## Project structure

```
nexus-os/
│
├── standalone/              ← PORTABLE DEMO (Option A) — copy this folder anywhere
│   ├── index.html           HTML shell
│   ├── styles.css           full dark theme (#121212 + #00ff88)
│   ├── app.js               ALL demo logic: data, AI intents, sounds, views (~1 file)
│   └── server.js            zero-dependency Node server (node server.js)
│
├── src/                     ← FULL TYPED SOURCE (Option B)
│   ├── os/                  framework-free TypeScript modules
│   │   ├── app.ts           shell: sidebar, topbar, router
│   │   ├── store.ts         state + event bus (Socket.io stand-in) + ops engine
│   │   ├── data.ts          fictional seed data
│   │   ├── selectors.ts     BI math (revenue, profit, velocity, forecast)
│   │   ├── brain.ts         AI intent engine (OpenAI stand-in)
│   │   ├── sound.ts         Web Audio: cash register, ding, whoosh
│   │   ├── ui.ts            DOM utils, icons, canvas charts, toasts
│   │   └── views/           command, tables, ops, system(+Blueprint) views
│   ├── App.tsx              thin React mount point ONLY (framework requirement here)
│   ├── main.tsx             entry
│   └── index.css            theme
│
├── public/                  static assets
├── package.json             npm config (Option B)
├── vite.config.*            build config (Option B)
├── .env.example             template for Phase 2 real keys
├── .gitignore
├── RUN.md                   quick-run cheat sheet
└── README.md                this file
```

**Production target layout** (Phase 2+, documented inside the app's Blueprint tab):
`server/` (Express + Socket.io orchestrator, RBAC, audit) + `web/` (vanilla dashboard) + PostgreSQL/Supabase. The modules in `src/os` map 1:1 onto that structure.

---

## First 60 seconds

1. **Click anywhere once** — browsers block audio until you interact. This unlocks the sound engine.
2. Wait ~18 seconds — the **live simulator** drops a sale: cash-register sound + green screen flash + toast + notification bell.
3. Or force events: **Automations → Webhook simulator**:
   - `SIMULATE NEW ORDER` → full loop: webhook → DB → sound/flash → audit
   - `META API FAILURE` → graceful degradation (cached data, auto-recovery, no crash)
   - `RESET DEMO DATA` → reseed
4. Ask the console (or press `/` to focus it):
   - `how much did I sell today`
   - `which laptop made the most profit`
   - `find opportunities`
   - `analyze my instagram`
   - `teach me how to connect WordPress`
   - `restock thinkpad t480` → **opens an approval modal** (FINANCIAL scope — approve or deny, both are audited)
5. Press **M** to mute/unmute.

---

## Demo mode — what's real vs simulated

| Feature | Demo (now) | Production (Phase 2+) |
|---|---|---|
| Orders | Simulated webhook every ~18s + simulator buttons | Real WooCommerce `order.created` webhooks over Socket.io |
| Payments | None — reorders show "demo, no real payment" | M-Pesa Daraja STK push + confirmation webhooks |
| Customers | Fictional names only | Your real customers in Supabase/PostgreSQL |
| AI brain | Built-in intent engine (works offline) | OpenAI gpt-4o-mini function-calling over live data |
| Notifications | In-app toasts + bell (styled like Telegram) | Real Telegram Bot / Email / Push |
| Analytics | Seeded demo series | GA4 Data API + Meta Graph + TikTok API |
| Persistence | `localStorage` (survives browser restarts) | PostgreSQL |

**Checkout/payments**: there are no real payments anywhere. Approving a reorder shows *"demo — no real money moves"*. In production, M-Pesa connects via Safaricom's **Daraja API** (STK push), confirmed by webhook before any order is marked paid.

**Privacy**: no sensitive data is stored — only the fictional demo dataset, in your browser only. Clear it anytime via *Automations → Reset demo data*.

---

## Editing guide — where to change things

All edits below are in **`standalone/`** (the portable demo):

| You want to change… | File | Where |
|---|---|---|
| Brand name / logo | `app.js` | search for `NEXUS` (sidebar) and the `hex` icon in `ICONS` |
| Colors | `styles.css` | the `:root` block at the top (`--bg`, `--acc`, etc.) |
| Products & prices | `app.js` | the `PRODUCTS` array (name, spec, cost, price, stock) |
| Currency | `app.js` | the `ksh()` helper — change `"KSh "` to anything |
| Customer names | `app.js` | the `NAMES` array (keep them fictional!) |
| AI answers / commands | `app.js` | the `answer()` function — each `if (...)` block is one intent |
| Quick-command chips | `app.js` | the `CHIPS` array in `viewCommand()` |
| Sounds | `app.js` | the `Sound` object (`cash`, `ding`, `whoosh`) |
| Sale flash | `styles.css` | `#saleFlash` block; label text in `flash()` |
| Sidebar menu | `app.js` | the `NAV` array |
| Workflow names/steps | `app.js` | `workflows` in `seedState()` |
| Simulated sale interval | `app.js` | bottom of file: `setInterval(..., 18000)` |

The full TypeScript version mirrors this: products in `src/os/data.ts`, intents in `src/os/brain.ts`, views in `src/os/views/`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Node.js isn't installed (or terminal wasn't restarted after install). Install LTS from nodejs.org, fully close & reopen VS Code/terminal. |
| `EADDRINUSE` / port busy | Another app uses 8080 (or 5173). Run `PORT=9090 node server.js` (Mac/Linux) or kill the other process. |
| No sound | Click anywhere on the page once (browser autoplay rule). Then check the speaker icon isn't muted (M key). |
| Blank page | Open DevTools (F12 → Console) and read the error. Usually means a file didn't copy — re-copy the whole `standalone/` folder. |
| Data looks wrong/stuck | Automations → **Reset demo data**, or DevTools → Application → Local Storage → delete `nexusos_demo_v1`. |
| Fonts look different offline | Normal — it falls back to system fonts. Reconnect to internet for Chakra Petch / IBM Plex / JetBrains Mono. |
| `npm install` fails | Delete `node_modules` + `package-lock.json`, run `npm install` again. Ensure Node 18+ (`node -v`). |

---

## Taking it to your computer / backing it up

You have the complete project as plain files — copy the whole folder via USB, or:

```bash
git init
git add .
git commit -m "NEXUS//OS demo"
# create a private repo on github.com, then:
git remote add origin https://github.com/YOURNAME/nexus-os.git
git push -u origin main
# on any other computer: git clone that URL → npm install → npm run dev
```

---

## Future development — connecting the real things

The full production plan (APIs, schema, folder structure, phasing) is inside the app's **Blueprint** tab. Short version:

1. **WordPress / WooCommerce** — REST API + application passwords + `order.created` webhooks. While developing, expose your laptop with free `ngrok http 3000`.
2. **Database** — Supabase free tier (hosted PostgreSQL). Schema is in Blueprint; swap `localStorage` reads for Supabase queries.
3. **Real backend** — Express + Socket.io server (`server/` layout in Blueprint). The event bus in `src/os/store.ts` becomes Socket.io rooms.
4. **AI** — OpenAI gpt-4o-mini with function/tool calling; the intents in `brain.ts` become tool definitions. Cost: fractions of a cent per query.
5. **M-Pesa** — Safaricom Daraja API: STK push at checkout → confirmation webhook → order marked paid. Sandbox credentials are free.
6. **Auth** — Supabase Auth (email magic link) or a single-user JWT; RBAC scopes (READ/WRITE/FINANCIAL/ADMIN) are already modeled in the audit system.
7. **Social APIs** — Meta Graph API (free, business account) for IG; TikTok Business API; GA4 Data API for traffic.
8. **Automation** — n8n self-hosted (free) or Zapier; the workflows tab maps directly to n8n nodes.
9. **Phone notifications** — Telegram Bot API: one bot token, `sendMessage` with inline approval buttons. Free and unlimited.

**Order of work**: DESIGN → DEMO (you are here) → RUN LOCALLY → LEARN → IMPROVE → CONNECT BACKEND → LAUNCH.

---

## Cost control (your rule #34)

Everything above uses free tiers: WooCommerce, WordPress, GA4, Meta, TikTok, Telegram, Supabase, n8n, ngrok. The only paid piece is the OpenAI API (~gpt-4o-mini) and optionally a $5/mo VPS when you outgrow your laptop.
