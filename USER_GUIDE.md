# NEXUS//OS — Complete Windows Setup & User Guide

Your personal AI business operating system, running on **your** Windows PC.
Written for beginners: every command is exact, every step says *where* to click.

---

## PART 1 — INSTALL (from zero)

### What you need to install

| Software | Needed for | Link |
|---|---|---|
| **Node.js LTS** (v18+) | Running the AI server | https://nodejs.org (click the green **LTS** button) |
| **VS Code** | Editing code | https://code.visualstudio.com |
| Git *(optional for now)* | Backups/version history | https://git-scm.com |

**That's it.** The demo needs **no** Python, **no** Docker, **no** PostgreSQL, **no** API keys.
During Node.js installation just click *Next → Next → Install* (defaults are correct).

**Verify** — press `Win + R`, type `cmd`, Enter, then:
```cmd
node -v
npm -v
```
Both must print a version number (e.g. `v20.11.0`). If not, restart the PC and try again.

---

## PART 2 — PUT THE PROJECT ON YOUR PC

### Step 1 — Create the folder
Open File Explorer and create:
```
C:\Users\YourName\personal-ai
```
(Replace `YourName` with your Windows username. No spaces in the path!)

### Step 2 — Copy the project files
Copy the entire project into that folder so it looks like this:
```
C:\Users\YourName\personal-ai\
├── start-ai.bat          ← double-click this to START
├── stop-ai.bat           ← double-click this to STOP
├── standalone\           ← the runnable demo (zero dependencies)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── server.js
├── src\                  ← full typed source (Blueprint, AI Tutor, memory)
├── README.md
├── RUN.md
├── USER_GUIDE.md         ← this file
├── .env.example          ← template for real keys (Phase 2+)
├── .gitignore
└── package.json
```

### Step 3 — Open in VS Code
1. Open VS Code
2. Menu: **File → Open Folder…**
3. Select `C:\Users\YourName\personal-ai` → **Select Folder**

### Step 4 — Open the terminal in VS Code
Press **Ctrl + `** (the backtick key, below Esc). A terminal opens **already inside your project folder**.

---

## PART 3 — FIRST RUN (one command)

### Option A — double-click (easiest)
In File Explorer, double-click **`start-ai.bat`** inside the project folder.

What happens automatically:
```
Checks Node.js  →  starts server  →  opens http://localhost:8080 in your browser
```

### Option B — from the VS Code terminal
```cmd
cd standalone
node server.js
```
Then open your browser and go to:
```
http://localhost:8080
```

**You should see the dark green NEXUS//OS dashboard.** 🎉 **Milestone 1 achieved.**

### First things to do (60 seconds)
1. **Click anywhere on the page once** — browsers block sound until you interact.
2. Go to **Automations → Webhook Simulator → "Simulate new order"** → hear the **cash register** + see the green flash.
3. Go to **System Health → "Run system test"** → watch all 7 subsystems pass.
4. In the Command Center, type: `how much did i sell today`

---

## PART 4 — STOP, RESTART, CRASHES

| Situation | What to do |
|---|---|
| **Stop the AI** | Double-click `stop-ai.bat` — or press `Ctrl + C` in the server terminal — or close the "NEXUS AI Server" window |
| **Restart after PC reboot / Windows update** | Double-click `start-ai.bat` again (your demo data is saved in the browser and survives restarts) |
| **After internet failure** | Nothing needed — the demo runs 100% offline. Just reopen http://localhost:8080 |
| **App crash / weird behavior** | Run `stop-ai.bat`, then `start-ai.bat`. Nuclear option: System Health → "Reset demo data" |
| **Start with Windows automatically** *(later, optional)* | Win key → type **Task Scheduler** → *Create Basic Task* → Trigger: *When I log on* → Action: *Start a program* → browse to `start-ai.bat`. Only do this once manual start works perfectly. |

---

## PART 5 — THE DEMO STORE (Milestone 2)

The demo ships with a fictional Nairobi laptop-reselling business: 8 products, ~40 orders over 14 days, customers, expenses, campaigns, freelance leads. **All data is fake and lives only in your browser's localStorage.** Nothing is sent anywhere.

### Ask the AI these — it answers from demo data:

| You type | What the AI does |
|---|---|
| `how much did I sell today` | Today's revenue, profit, orders, average basket, vs yesterday |
| `which laptop made the most profit` | Ranks products by profit with margins + recommendation |
| `do I have new orders` | Lists recent orders with source + status |
| `show me low stock products` | Stock vs sales velocity, reorder suggestion |
| `analyze my instagram` / `analyze tiktok` | Followers, engagement, reach trend, best post type |
| `analyze my website` | GA4-style funnel: views → cart → checkout → purchase, finds the leak |
| `find opportunities` / `what needs my attention` | Ranked money moves with expected KSh impact |
| `what should I work on today` | Prioritized action list across store, ads, freelance |
| `daily report` | Full business summary in Decision-Engine format |
| `show me my freelancing progress` | Pipeline value, hot leads, next follow-up |
| `forecast next week` | 7-day revenue projection with confidence band |
| `restock thinkpad t480` | **Financial action → approval modal** (approve AND deny once — both are logged) |

### Beginner mode — ask "what is…?"
The AI explains tech in plain language, then shows **how it works in YOUR system**:
```
what is a webhook?      what is ROAS?         what is ngrok?
explain a funnel        what is OAuth?        what is .env?
what is STK push        what is localhost?    what is a CRM?
```

### Developer mode
Every AI reply ends with a `DEV TRACE` line showing exactly which data sources it checked (safe action summary — no hidden reasoning). The full event stream lives in **System Health → Live event log**.

---

## PART 6 — ENVIRONMENT VARIABLES (Phase 2, not needed yet)

The demo uses **zero** secrets. When you connect real services, you'll create a `.env` file:

1. In VS Code, right-click `.env.example` → **Copy**
2. Right-click in the file list → **Paste** → rename the copy to `.env` (exactly, with the dot)
3. Fill in values. What each one means:

| Variable | What it is | Where you get it |
|---|---|---|
| `PORT` | Which port the server listens on (default 3000) | Leave as-is |
| `WEBHOOK_SECRET` | A random password to verify webhooks are really from WooCommerce | Type any long random text |
| `WOOCOMMERCE_STORE_URL` | Your shop address, e.g. `https://myshop.co.ke` | Your WordPress site URL |
| `WOOCOMMERCE_KEY` / `_SECRET` | Keys that let the AI read orders | WordPress admin → **WooCommerce → Settings → Advanced → REST API → Add key** (permission: Read) |
| `WP_USER` / `WP_APP_PASSWORD` | WordPress login for the REST API | **Users → Profile → scroll to "Application Passwords"** → name it "NEXUS" → copy the generated password |
| `OPENAI_API_KEY` | Powers the real AI brain | https://platform.openai.com/api-keys (gpt-4o-mini = fractions of a cent per query) |
| `TELEGRAM_BOT_TOKEN` | Your notification bot | In Telegram, message **@BotFather** → `/newbot` → copy the token |
| `TELEGRAM_CHAT_ID` | Where the bot sends messages | Message **@userinfobot** on Telegram — it replies with your numeric ID |
| `SUPABASE_URL` / `_SERVICE_KEY` | The free PostgreSQL database | https://supabase.com → New project → **Settings → API** |
| `META_ACCESS_TOKEN` | Instagram/Facebook stats | https://developers.facebook.com (Business account, free) |
| `MPESA_CONSUMER_KEY` / `_SECRET` | M-Pesa STK push (**sandbox first!**) | https://developer.safaricom.co.ke — sandbox keys are free |

⚠️ **Golden rules:** never paste real keys into code files. Never commit `.env` to GitHub (`.gitignore` already blocks it). Secrets live **only** on the backend — the browser never sees them.

---

## PART 7 — CONNECT YOUR REAL WEBSITE (Milestone 3)

```
YOUR WEBSITE (WordPress + WooCommerce, online)
        ↓  (WooCommerce sends a webhook on every order)
YOUR AI — receives it, saves to database
        ↓
AI ANALYSIS — profit, stock impact, anomalies
        ↓
PHONE NOTIFICATION — Telegram message within seconds
```

### Step-by-step

1. **Get your WooCommerce keys** (2 minutes)
   WordPress admin → **WooCommerce → Settings → Advanced → REST API → Add key**
   - Description: `NEXUS AI`
   - Permissions: **Read** (start read-only!)
   - Click **Generate API key** → copy `Consumer key` + `Consumer secret` into your `.env`

2. **The localhost problem — read this carefully**
   Your website is on the public internet. Your AI runs on `localhost:8080` behind your router. **The website cannot reach your PC directly** — that's NAT/firewall, and it's a *good* thing. Three options:

   | Option | How | Verdict |
   |---|---|---|
   | **A — AI fully on your PC** | Use **ngrok** (free): it gives you a public URL like `https://abc123.ngrok.app` that tunnels to your localhost. Point the WooCommerce webhook there. | ✅ **Best for learning/testing.** Downside: only works while your PC + ngrok are on. |
   | **B — AI fully in the cloud (VPS)** | Rent a $5/mo VPS (Hetzner/DigitalOcean), put the Express server there, it's online 24/7. | ✅ Best for production. |
   | **C — Hybrid (recommended for you)** | Cloud: webhook receiver + PostgreSQL (Supabase, free). Your PC: dashboard + AI agent that reads the same database. | ⭐ **Recommended.** Your PC can be off and orders still land safely in the cloud DB; when you start your PC, the dashboard catches up instantly. |

   **Why C:** order data is money data — it should never depend on your laptop being awake. But you don't need a powerful server to *think*: the analysis runs on your PC (or later, the same tiny VPS).

3. **Create the webhook** (once tunnel/VPS is ready)
   WordPress admin → **WooCommerce → Settings → Advanced → Webhooks → Add webhook**
   - Name: `NEXUS new order`
   - Status: **Active**
   - Topic: **Order created**
   - Delivery URL: your ngrok URL + `/api/webhooks/woocommerce` (e.g. `https://abc123.ngrok.app/api/webhooks/woocommerce`)
   - Secret: same text as `WEBHOOK_SECRET` in your `.env`
   - Click **Save**. WooCommerce shows *Last delivery: Success* on the next order.

4. **Test it:** place a real order on your store (use a cheap product). Within seconds you should see: webhook logged → order in the Orders tab → cash sound → Telegram message.

---

## PART 8 — PHONE NOTIFICATIONS (Milestone 4)

1. In Telegram, message **@BotFather** → send `/newbot` → name it (e.g. "My Shop AI") → copy the **token**.
2. Message **@userinfobot** → it replies with your **chat ID** (a number).
3. Put both in `.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
4. The server's notification module sends: `🔔 New order — KSh 8,500 (HP EliteBook)` · `⚠️ Low stock: ThinkPad T480 (2 left)` · `💰 Daily profit: KSh X`.

WhatsApp works later via the WhatsApp Business Cloud API; Telegram is free and takes 3 minutes — start there.

---

## PART 9 — DAILY USE

```
Morning:  start-ai.bat  →  System Health glance  →  "what needs my attention today"
Midday:   live feed + Command Center for ad-hoc questions
Evening:  "daily report"  →  AI writes the summary (auto-sent to Telegram at 19:00 in production)
Weekly:   "find opportunities"  →  review recommendations  →  approve/deny actions
```

The AI **never** spends money or deletes anything without your approval — every financial action opens an approval modal and is written to the audit log.

---

## PART 10 — TROUBLESHOOTING (Windows)

| Problem | Why | Fix |
|---|---|---|
| `'node' is not recognized` | Node.js missing or terminal opened before install finished | Install Node.js LTS from nodejs.org, **close and reopen** the terminal (or restart PC) |
| `'npm' is not recognized` | Same as above | Same as above |
| **Port 8080 already in use** | An old server is still running | Run `stop-ai.bat`, then `start-ai.bat` again |
| **Firewall popup when starting** | Windows asks permission for Node | Click **Allow** (private networks). It's your own server on your own PC |
| **Blank page / console errors** | Browser cache or partial copy | Hard refresh (`Ctrl + Shift + R`); confirm all 4 files in `standalone\` were copied |
| **No sound** | Browser autoplay policy | Click anywhere on the page once; check the speaker icon isn't muted (`M` toggles) |
| **`.env` not loading** *(Phase 2)* | Wrong name or location | File must be exactly `.env` (not `.env.txt`) in the server folder; restart the server after editing |
| **Invalid API key** *(Phase 2)* | Key copied with spaces/expired | Regenerate the key; paste without leading/trailing spaces; restart server |
| **WordPress connection failed** | Permalinks off or app password wrong | Settings → Permalinks → select "Post name" → Save; regenerate Application Password |
| **WooCommerce auth failed** | Key permissions or store URL wrong | Key must be **Read**; URL must include `https://` and no trailing slash |
| **Webhook not received** | Laptop offline / ngrok URL changed / secret mismatch | Check ngrok is running (free URL changes each restart); verify webhook Secret matches `.env`; check WooCommerce → Webhooks → *Last delivery* status |
| **CORS error** | Browser calling an API from a different origin | In production the *server* calls APIs (no CORS); only fetch from your own localhost in dev |
| **AI API unavailable** | OpenAI quota/network | System degrades gracefully: rule-based answers keep working (exactly what this demo proves); check platform.openai.com status |

Still stuck? Copy the exact red error text — the fix is always in the first line.

---

## PART 11 — BACKUP & GITHUB

### What to back up (weekly)
Copy to a USB/OneDrive folder:
- `C:\Users\YourName\personal-ai\` — the whole project (small, no node_modules needed)
- Your `.env` — **separately and encrypted** (e.g. a password manager note), never in git
- Browser demo data — System Health area / Settings → Export (downloads JSON)
- Phase 2: Supabase dashboard → **Database → Backups** (automatic on paid; free tier: use the SQL dump button monthly)

### GitHub (safe way)
```cmd
cd C:\Users\YourName\personal-ai
git init
git add .
git commit -m "NEXUS OS - phase 1 demo"
git branch -M main
git remote add origin https://github.com/YOURNAME/personal-ai.git
git push -u origin main
```
`.gitignore` already **excludes** `.env`, `node_modules/`, `keys/`, logs and data exports. Before your first push, run `git status` and confirm `.env` is NOT listed. Create the empty repository on github.com first (no README when creating, to avoid conflicts).

### Updating later
```
Backup project folder  →  copy new files  →  npm install (if package.json changed)
→  run any migration noted in release notes  →  start-ai.bat  →  System Health test
```

---

## PART 12 — DEVELOPMENT MODE vs PRODUCTION MODE

| | Development (now) | Production (later) |
|---|---|---|
| Where | Your PC, `localhost:8080` | $5 VPS + Supabase, HTTPS, your domain |
| For | Learning, testing, building | Real money, 24/7 |
| Data | localStorage demo | PostgreSQL |
| AI | Built-in intent engine | OpenAI function-calling over live data |
| **Move when** | you have processed real orders for 2+ weeks in dev and nothing broke | |

---

## PART 13 — THE ROAD AHEAD (milestones)

1. ✅ **Milestone 1** — dashboard running on your Windows PC with demo data *(you are here)*
2. ✅ **Milestone 2** — AI tracking demo orders, generating reports, answering business questions
3. ⬜ **Milestone 3** — Express + Socket.io server + real WooCommerce webhook (ngrok for dev)
4. ⬜ **Milestone 4** — real Telegram notifications to your phone
5. ⬜ Analytics (GA4), social (Meta/TikTok), automation (n8n/Zapier), freelance CRM live, M-Pesa STK (sandbox), AI Tutor with your real skill data

**Next step when you're ready:** say *"start Phase 2"* and I generate the Express server — one file at a time, each with exact run instructions, exactly as planned in the Blueprint tab.

---

## PART 14 — VOICE CONVERSATION (talk to your AI)

Your AI now has a full voice layer — **same brain, same memory, same data, same approval gates** as text. Nothing was rebuilt; voice is an additional interface.

### How it works (architecture)
```
MICROPHONE → browser speech engine (real-time streaming, no file uploads)
           → intent engine / AI brain (the exact same one as typed chat)
           → natural text-to-speech → YOUR SPEAKERS
```
- **Cost: $0** — it uses the speech engine built into Chrome/Edge.
- **Privacy: audio is never recorded or stored.** Only transcripts enter chat history, following your existing memory settings.
- **Upgrade path:** in Phase 2 the Express backend can swap in OpenAI Realtime (`VOICE_API_KEY` in `.env`) for cloud-grade latency — the key stays server-side, never in the browser.

### Use it
1. Start the AI (`start-ai.bat`) and click the page once (unlocks audio).
2. Bottom-right you'll see the **voice dock**: `🎙 VOICE READY`.
3. **TALK** — press, speak one question, get a spoken + written answer.
   Or press **● CONVERSATION** — the AI says "I'm listening", you talk, it answers, then listens again automatically (like a real assistant). Say **"stop"** or **"goodbye"** to end.
4. In the Command Center, the **🎙 TALK** button next to the input does the same.
5. Status states: `🎙 READY` → `🎙 LISTENING…` → `🧠 THINKING…` → `🔊 SPEAKING…`. Errors show `⚠ MIC ERROR` with the exact fix.

### What you can say
Everything you can type — it routes through the same tools:
- *"How much did I sell today?"* · *"How much profit did I make?"* · *"Do I have new orders?"*
- *"Which product is selling fastest?"* · *"Which products are low in stock?"*
- *"How is my website performing?"* · *"How are my social media doing?"*
- *"What should I work on today?"* · *"Give me my daily report"*
- **Navigation:** *"Open inventory"*, *"Show me orders"*, *"Open my freelancing tasks"*, *"Open system health"*
- **Learning:** *"Teach me how APIs work"* → then *"Give me an example"* → *"Test me"*
- **Context memory:** ask *"How much did I sell today?"* then just say *"What about yesterday?"* — the AI knows you mean sales.

### Wake word ("Jarvis")
Gear icon on the dock → **Voice Settings** → turn **Wake word** ON (default word: `jarvis`, editable).
Then say: *"Jarvis, how many orders today?"* — it wakes and answers.
**When OFF, the microphone is completely idle — nothing is recorded.**

### Interrupting
While the AI is speaking, just start talking — it **stops mid-sentence** and listens to you.

### Voice confirmations (same safety as clicking)
Financial actions still require approval. When the AI asks *"Do you want me to proceed?"* you can say:
**"Yes" / "Do it" / "Go ahead"** — or — **"No" / "Cancel" / "Don't do it"**. Both are logged to the audit trail.

### Windows microphone setup (if it doesn't work)
1. Windows **Settings → Privacy & security → Microphone**
2. Turn ON **"Microphone access"** and **"Let desktop apps access your microphone"**
3. In Chrome/Edge, click the 🔒 icon in the address bar → **Microphone → Allow**
4. Reload the page. If you have several mics, pick yours in Voice Settings.

### Voice test page
Voice Settings → **TEST MICROPHONE** (live input level bar) · **TEST SPEAKER** · **TEST RECOGNITION** · **TEST FULL CONVERSATION** (say "hello" → AI answers → checklist ✓✓✓✓).

### Cost controls (in Voice Settings)
Voice mode ON/OFF · continuous conversation ON/OFF · max conversation length (1–30 min) · wake word ON/OFF.
The dock tells you the engine is free; cloud realtime voice is the only metered option and is OFF by default.

### Fallbacks (nothing ever breaks)
- Mic fails → clear error + fix instructions; **text mode keeps working 100%**.
- TTS fails → you still get the written answer.
- Non-Chrome browser → dock says `UNSUPPORTED`; everything else works.

---

## CHEAT SHEET

```
START ........ double-click  start-ai.bat
TALK ......... click 🎙 TALK in the dock, or say "Jarvis" (if wake word is ON)
OPEN ......... http://localhost:8080
SOUND ........ click page once after loading
TEST ......... System Health → Run system test
STOP ......... double-click  stop-ai.bat   (or Ctrl+C in terminal)
RESET ........ System Health → Reset demo data
ASK .......... "how much did I sell today" · "find opportunities" · "what is a webhook?"
```

---

## PART 15 — UPGRADED MODULES (audit & repair pass)

### What was audited, fixed, and added

| Area | Status |
|---|---|
| AI brain, intents, RBAC approvals, audit log | ✅ verified working |
| Voice (STT/TTS/wake word/barge-in/device select) | ✅ verified — **now defaults to a natural MALE voice** (change in Voice Settings → Voice) |
| Computer control (bridge) | ✅ upgraded — every action now reports **ACTION STARTED / COMPLETED / FAILED / REQUIRES BRIDGE** |
| `start-ai.bat` | 🛠 **fixed** — now also starts `bridge.js` (computer control) automatically |
| Tech Intelligence | 🆕 **new** — say **"tech news"**: live Hacker News scan (free, no key), filtered to your focus, each signal analyzed as Service to sell / Skill to learn / Build idea. Never invents news. |
| Security Monitoring | 🆕 **new** — say **"security check"**: evidence-based scan (denied actions, pending approvals, failing integrations, error rate, storage footprint). Never claims an intrusion without evidence. |
| Website Monitoring | 🆕 **new** — say **"my website is https://…"** then **"check my website"**: real reachability probe with response time, logged to audit. |
| Startup sequence | 🆕 **new** — every boot runs a 12-point health check (AI, voice, DB, internet, bridge, business, freelance, website, security, tech feed, memory, tasks) and posts a **startup report**. |
| Daily briefing | ⬆ upgraded — now includes Security, Website, Tech, and a computed **Top opportunity today** |
| "Required to complete JARVIS" | 🆕 **new** — System Health panel: REQUIRED NOW / RECOMMENDED / OPTIONAL / FUTURE with cost, key, software and permission flags |
| Prompt-injection barrier | ✅ documented + enforced — external content (web/email/docs) is data, never instructions |

### New things you can say

```
tech news                          → live tech intelligence scan
security check                     → evidence-based security scan
my website is https://shop.co.ke   → connect website monitoring
check my website                   → live uptime + response-time probe
startup report                     → 12-point system health check
give me my daily briefing          → full briefing incl. security/tech/opportunity
find my personal ai project        → locates it (lists files if bridge is on)
read the file README.md            → reads via bridge (allowed folders only)
run my application                 → npm run dev via bridge
take a screenshot                  → honest: REQUIRES EXTENSION (Win+Shift+S for now)
check why my app crashed           → error triage with fixes
```

### Dangerous actions — confirmation rules (already enforced)

The AI **always asks first** for: deleting files/folders, financial actions (reorders, payments), sending messages/proposals, publishing, security changes, unknown programs. Harmless actions (open app, read info, search, check systems) run immediately. Approve/deny by button **or by voice** ("yes" / "no").

### Exact VS Code run commands (Windows)

```
1.  Open VS Code → File → Open Folder → C:\Users\YourName\personal-ai
2.  Open terminal:  Ctrl + `
3.  You are already in the project root. For the portable demo:
        cd standalone
        node server.js        (terminal 1 — dashboard at http://localhost:8080)
    Then a SECOND terminal (click the + icon):
        cd standalone
        node bridge.js        (terminal 2 — computer control at http://localhost:8787)
    OR just double-click start-ai.bat — it opens both windows for you.
4.  For the full typed source (one terminal, from the project ROOT):
        npm install           (first time only, needs Node 18+)
        npm run dev           (http://localhost:5173)
5.  Stop:  Ctrl+C in each terminal, or double-click stop-ai.bat
```

**No Python. No virtual environment. No database install.** Node.js LTS is the only requirement; everything else is free-tier or browser-built-in.

### Phone connection (honest architecture)

Not configured — and not pretended. The safe path (Phase 5): an Android companion app pairing over your **local network** via QR + authenticated WebSocket; notifications flow through the **Telegram bot** today (free, 3-minute setup in PART 8). JARVIS is never exposed to the public internet without authentication + TLS.
