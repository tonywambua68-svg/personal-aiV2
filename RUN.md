# NEXUS//OS — How to Run

## Prerequisites
- **Node.js 18+** → https://nodejs.org (LTS version)
- Verify in your terminal: `node -v` and `npm -v`

---

## Option A — Run the Phase 1 prototype (works today, zero setup)

From the project root:

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start the dev server with hot reload
npm run dev
```

Open the URL it prints — usually **http://localhost:5173**.

**Production build** (optimized, what gets deployed):

```bash
npm run build      # outputs static files to dist/
npm run preview    # serves dist/ locally at http://localhost:4173
```

### Important: sound won't play until you click once
Browsers block audio before a user gesture. Click anywhere on the dashboard
once — the Web Audio engine unlocks, then the **cash register**, **ding**,
and **whoosh** sounds fire on every event.

### What you'll see running
- Live ops simulator fires a new sale every ~17s → cash register + green screen flash
- Command console answers "How much did I sell today?", "Find opportunities", etc.
- Automations page has the **webhook simulator** — fire a manual `order.created` webhook, an integration failure, or a low-stock alert
- "Restock ThinkPad T480" in the console demonstrates the FINANCIAL approval flow
- Data persists in `localStorage` — survives refresh; reset from Settings

---

## Option B — Run the production stack (Phase 2: Node.js + Express + Socket.io + PostgreSQL)

This is the stack from your spec. When we build Phase 2, the flow is:

```bash
# 1. New folder for the server (the dist/ from above becomes its public/ folder)
mkdir nexus-server && cd nexus-server
npm init -y
npm install express socket.io cors dotenv pg

# 2. Create .env  (NEVER commit this file)
cat > .env << 'EOF'
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/nexus
OPENAI_API_KEY=sk-...
WOOCOMMERCE_URL=https://shop.ke
WOOCOMMERCE_KEY=ck_xxx
WOOCOMMERCE_SECRET=cs_xxx
TELEGRAM_BOT_TOKEN=123:ABC
TELEGRAM_CHAT_ID=your_chat_id
WEBHOOK_SECRET=a-random-strong-string
EOF

# 3. Run the server
node server.js
```

Then open **http://localhost:4000** — Express serves the vanilla HTML/CSS/JS
from `public/`, Socket.io pushes real-time events, and the AI Orchestrator
talks to PostgreSQL.

### Local webhook testing (WooCommerce → your laptop)
WooCommerce can't reach `localhost`, so tunnel it:

```bash
# install ngrok → https://ngrok.com (free tier)
ngrok http 4000
# copy the https URL it gives you, e.g. https://abc123.ngrok.io
# In WordPress: WooCommerce → Settings → Advanced → Webhooks → Add:
#   Topic:  Order created
#   URL:    https://abc123.ngrok.io/webhooks/woocommerce
#   Secret: (same as WEBHOOK_SECRET in .env)
```

### Free database (Supabase)
1. https://supabase.com → New project (free tier: 500MB PostgreSQL)
2. SQL Editor → paste the schema from the in-app **Blueprint** module
3. Copy the connection string into `DATABASE_URL`

---

## Free-tier cost checklist (all $0 to start)
| Service | Free limit |
|---|---|
| Supabase PostgreSQL | 500MB, 2 projects |
| OpenAI gpt-4o-mini | ~fractions of a cent per query |
| WooCommerce/WP REST API | Unlimited (self-hosted) |
| Google Analytics Data API | Free quota |
| Meta Graph / TikTok Business | Free with approval |
| Telegram Bot API | Unlimited messages |
| ngrok | 1 free tunnel |
| Hosting | Your laptop, or a $5 VPS (Contabo/Hetzner) |

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| No sound | Click anywhere on the page once (browser gesture rule) |
| `npm: command not found` | Reinstall Node.js from nodejs.org, restart terminal |
| Port 5173 in use | `npm run dev -- --port 5174` |
| Blank white page | Open DevTools (F12) → Console tab, read the first error |
| Stale demo data | Settings → Data → **Reset demo data** |
