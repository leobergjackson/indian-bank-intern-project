# 🛡️ Banking Alert Management System

A full-stack alert system for banking operations. It monitors transaction
metrics against configurable thresholds and raises **alerts** in real time when
limits are breached — with a live operations dashboard, rule configuration, an
admin panel, and a built-in transaction simulator so you can see it working
immediately.

| Layer        | Tech                                    |
| ------------ | --------------------------------------- |
| Frontend     | React 18 + Vite + React Router          |
| Backend      | Python + FastAPI                        |
| Database     | SQLite (via SQLAlchemy)                 |
| Real-time    | WebSockets (live alerts + toasts)       |

---

## 📖 Explained simply (read this first)

### The problem it solves
Banks process a huge volume of transactions every second. A small number of them
are dangerous — **fraud, money-laundering, suspicious logins, or transfers so
large they need compliance sign-off.** Humans cannot watch every transaction by
hand.

### What this system does
It **automatically watches every transaction** against a set of rules
("thresholds"). The moment a transaction breaks a rule, it raises an **alert** on
a live dashboard so the operations / risk team can review and act on it.

> Think of it as a **smoke detector for banking transactions**: the *rules* are
> the sensitivity settings, the *alerts* are the alarms, and the *dashboard* is
> the control panel where staff see and silence the alarms.

**One-line pitch:** *A real-time monitoring dashboard that flags risky banking
activity the instant it happens and tracks every alert from "Active" to
"Resolved."*

---

### 🧱 Tech stack — what each piece is and why we chose it

| Part | Technology | What it is (plain English) | Why we use it |
| --- | --- | --- | --- |
| **Frontend** (the face) | React + Vite | The interactive web dashboard people look at | Fast, modern, reusable UI building blocks |
| **Backend** (the brain) | Python + FastAPI | The server that holds all the logic and rules | Simple, fast, and auto-generates API docs |
| **Database** (the memory) | SQLite | Stores rules, alerts, transactions, and logs | Zero-setup, file-based — ideal for a demo |
| **Real-time** (the nerves) | WebSockets | Pushes new alerts to the screen instantly | No refresh needed — alerts pop up live |

> **Brain (FastAPI) + Memory (SQLite) + Face (React) + Nerves (WebSockets).**

---

### 🔄 How an alert is born (the flow, step by step)

1. A **transaction** happens — e.g. a ₹75,00,000 transfer. *(In the demo, a
   built-in **simulator** creates realistic transactions automatically so you can
   see the system working live.)*
2. The backend's **threshold engine** checks that transaction against **every
   active rule**.
3. If a rule is broken (e.g. *"fund transfer > ₹1 crore"*), it creates an
   **alert** stamped with a **severity** and **category**.
4. The alert is **saved**, **written to the logs**, and **pushed live** to the
   dashboard — a toast notification pops up in the corner.
5. A team member **Acknowledges** it ("I'm looking into it") and later
   **Resolves** it ("handled"). Every step is recorded.

---

### 🖥️ The screens & every box explained

The app has **three screens** (top navigation bar): **Dashboard**, **Alert
Rules**, and **Admin**.

#### 1) Dashboard — the live operations screen
The main screen the team watches all day.

- **Summary boxes (stat cards) across the top:**
  | Box | Meaning |
  | --- | --- |
  | **Active alerts** (red) | Open alerts that still need attention |
  | **Acknowledged** (yellow) | Someone has taken ownership and is working on them |
  | **Resolved** (green) | Closed / handled alerts |
  | **Alerts (24h)** | How many alerts fired in the last 24 hours |
  | **Rules enabled** | How many monitoring rules are switched on (e.g. 5/5) |
  | **Transactions** | Total transactions the system has processed |
- **Filter bar:** search by text and filter by severity, category, status, and
  date range to find specific alerts.
- **Alerts table:** each **row = one alert**, showing its severity, status, which
  rule triggered it, category, the **source account**, the **actual value vs the
  threshold** (what happened vs the limit), when it fired, and **Ack / Resolve**
  buttons. Click a row for full details.
- **⚡ Simulate event button:** generates a test transaction on demand so you can
  watch an alert appear live during a demo.

#### 2) Alert Rules — the configuration screen
Where you decide *what counts as risky*.

- Each **row = one rule**: an on/off toggle, the rule name, its **condition**
  (e.g. *"Transaction amount > ₹50 lakh"*), category, severity, and Edit/Delete.
- **"+ New rule"** opens a form to create a rule: choose the **metric** (what to
  measure), the **operator** (`>`, `>=`, …), the **threshold value**, plus
  severity and category.

#### 3) Admin Panel — the control room
For supervisors / authorised users.

- **Metric cards + two bar charts:** alerts broken down **by severity** and **by
  category** — the at-a-glance health of the system.
- **Transaction simulator controls:** Start / Stop the live feed, or "Generate
  one" event manually.
- **Admin settings:** set the **admin token** (the password that unlocks
  privileged actions).
- **System logs:** an **audit trail** of everything the system did (rules created,
  alerts fired, simulator started, notifications sent…), filterable by level.

---

### 🔐 Permissions — who can do what

The system separates **viewing** from **changing**:

| Action | Who can do it |
| --- | --- |
| View alerts, search/filter, **Acknowledge**, **Resolve** | Anyone (operations staff) |
| **Create / edit / delete rules**, **start/stop the simulator** | **Admins only** (requires the admin token) |

The **admin token** is a shared secret set in the backend `.env`
(`ADMIN_TOKEN`, default `admin-secret-token`) and entered once under **Admin →
Admin settings**. The frontend sends it as an `X-Admin-Token` header; the backend
**rejects privileged requests without it (HTTP 403).** This is a lightweight
stand-in for full user login + roles, which is the natural next step.

---

### 🏷️ What "severity" and "category" mean

- **Severity = how urgent:** **Critical** › **High** › **Medium** › **Low**.
- **Category = what kind of risk:** **Fraud**, **Compliance**, **Risk**,
  **Performance**.

---

## ✨ Features

**1. Alert configuration**
- Create / edit / delete alert rules (CRUD)
- Threshold values, comparison operators (`>`, `>=`, `<`, `<=`, `==`, `!=`)
- Severity: **Critical / High / Medium / Low**
- Category: **Fraud / Compliance / Risk / Performance**
- Enable/disable rules with a toggle

**2. Monitoring & triggering**
- Real-time threshold checking on every transaction/event
- Automatic alert generation when breached
- Timestamp + source (account) tracking
- Status lifecycle: **Active → Acknowledged → Resolved**
- Rate-based rules (e.g. *5+ transactions in 10 minutes*) over rolling windows,
  with de-duplication so a burst raises one alert, not fifty

**3. Dashboard**
- Live view of all alerts with summary stat cards
- Filter/search by severity, category, status, free text, and date range
- Alert detail view (threshold vs actual value, breach time, source)
- Acknowledge / Resolve directly from the table or the detail modal
- Full alert history

**4. Notifications**
- In-app toast notifications + a navbar badge for new alerts (via WebSocket)
- Email-on-critical (optional; falls back to a logged notice when SMTP is off,
  so it works out of the box)

**5. Admin panel**
- Performance metrics + charts (alerts by severity & category)
- Transaction simulator controls (start / stop / generate one)
- System logs viewer with level filtering
- Admin token gate for privileged actions

---

## 📁 Project structure

```
project-root/
├── backend/
│   ├── main.py          # FastAPI app, WebSocket, startup/lifespan
│   ├── database.py      # SQLAlchemy engine/session/Base
│   ├── models.py        # ORM models (AlertRule, Alert, Transaction, SystemLog)
│   ├── schemas.py       # Pydantic schemas + enums
│   ├── routes.py        # REST API endpoints
│   └── services.py      # Threshold engine, simulator, notifications, stats
├── frontend/
│   ├── src/
│   │   ├── pages/        # Dashboard, Rules, Admin
│   │   ├── components/   # Badges, modals, forms, charts, toasts
│   │   ├── context/      # LiveContext (WebSocket + toasts)
│   │   ├── api.js        # REST client
│   │   └── format.js     # INR / date / metric formatting
│   ├── vite.config.js    # Dev proxy: /api + /ws -> :8000
│   └── package.json
├── database/
│   └── schema.sql        # Reference SQL schema (auto-created by the app too)
├── requirements.txt
├── .env / .env.example
├── start-backend.ps1     # convenience launcher (Windows)
└── start-frontend.ps1    # convenience launcher (Windows)
```

---

## 🚀 Quick start

You need **Python 3.10+** and **Node.js 18+**.

### Option A — convenience scripts (Windows PowerShell)

Open **two** terminals in the project root:

```powershell
# Terminal 1 — backend (creates venv + installs deps on first run)
./start-backend.ps1

# Terminal 2 — frontend (installs node_modules on first run)
./start-frontend.ps1
```

### Option B — manual

```powershell
# --- Backend ---
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# --- Frontend (second terminal) ---
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**.

- API docs (Swagger): **http://localhost:8000/docs**
- The transaction **simulator starts automatically** and begins generating
  events — alerts will appear within a few seconds. Toggle it from the Admin
  panel or set `SIMULATOR_ENABLED=false` in `.env`.

---

## ☁️ Deploying to Vercel (frontend + backend together)

This repo is wired to deploy as a **single Vercel project** — the React app as
static files and the FastAPI backend as a Python serverless function. Just
**import the GitHub repo in Vercel and deploy** (no env vars required; same
origin, so the frontend calls `/api/...` directly).

**How it's wired** (already configured for you):

| File | Role on Vercel |
| --- | --- |
| `vercel.json` | Builds the frontend → `public/`, runs `api/index.py` as a Python function, routes `/api/*` to it and everything else to the SPA |
| `package.json` (root) | Build command: `cd frontend && npm install && npm run build` → `public/` |
| `api/index.py` | Serverless entry — imports the FastAPI `app` and seeds the DB on cold start |

### Important: what changes on serverless
Vercel functions are **short-lived and stateless**, which means three things
behave differently than on a normal always-on server — and the app adapts
automatically:

1. **No always-on simulator.** The background loop can't run, so on each cold
   start the backend **auto-seeds a realistic sample dataset** (alerts across
   every severity/category/status, transactions, and logs). Use the **⚡ Simulate
   event** button (or Admin → *Generate one*) to create more on demand.
2. **No WebSockets.** The dashboard automatically **falls back to polling**
   (every 5 s) for live updates — the status pill shows *Auto-refresh* instead of
   *Live*.
3. **No persistent disk.** SQLite runs in the serverless `/tmp` area, so data is
   **per-instance and resets on cold starts**. That's perfect for a demo. For
   durable storage, point `DATABASE_URL` at a managed Postgres (e.g. Vercel
   Postgres / Neon) and add it as an env var — no code changes needed.

> Locally (`uvicorn`) you still get the **full experience**: live WebSocket
> updates and the always-on simulator. None of the above changes local dev.

---

## 🔧 Configuration (`.env`)

| Variable                     | Default                                  | Purpose                              |
| ---------------------------- | ---------------------------------------- | ------------------------------------ |
| `DATABASE_URL`               | `sqlite:///./database/banking_alerts.db` | Database location                    |
| `SIMULATOR_ENABLED`          | `true`                                   | Auto-start the simulator             |
| `SIMULATOR_INTERVAL_SECONDS` | `4`                                      | Seconds between simulated events     |
| `ADMIN_TOKEN`                | `admin-secret-token`                     | Token for rule/simulator changes     |
| `EMAIL_ENABLED`              | `false`                                  | Send real email on critical alerts   |
| `SMTP_*`, `ALERT_EMAIL_TO`   | —                                        | SMTP settings for email              |

**Admin token:** privileged actions (creating/editing/deleting rules, starting/
stopping the simulator) require the `X-Admin-Token` header. In the UI, set it
under **Admin → Admin settings** (defaults to `admin-secret-token`).

---

## 🧪 Default seeded rules

On first run the system seeds these example rules:

| Rule                       | Condition                          | Category   | Severity  |
| -------------------------- | ---------------------------------- | ---------- | --------- |
| High-value transaction     | amount > ₹50 lakh                  | Compliance | High      |
| Large fund transfer        | transfer amount > ₹1 crore        | Risk       | Critical  |
| Rapid transaction pattern  | ≥ 5 transactions in 10 min        | Fraud      | High      |
| Repeated failed logins     | ≥ 3 failed logins in 5 min        | Fraud      | Critical  |
| Unusual login location     | login from an unrecognised city   | Fraud      | Medium    |

### Trigger an alert manually

Use the **⚡ Simulate event** button on the dashboard, or POST a transaction:

```bash
curl -X POST http://localhost:8000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"account_id":"ACC1234","amount":75000000,"txn_type":"transfer","location":"Mumbai"}'
```

---

## 📡 Key API endpoints

| Method   | Path                          | Description                          |
| -------- | ----------------------------- | ------------------------------------ |
| GET      | `/api/rules`                  | List alert rules                     |
| POST     | `/api/rules` 🔒               | Create a rule                        |
| PUT      | `/api/rules/{id}` 🔒          | Update a rule                        |
| DELETE   | `/api/rules/{id}` 🔒          | Delete a rule                        |
| GET      | `/api/alerts`                 | List alerts (filterable)             |
| PATCH    | `/api/alerts/{id}/status`     | Acknowledge / resolve                |
| POST     | `/api/transactions`           | Submit a transaction (runs engine)   |
| GET      | `/api/stats`                  | Dashboard metrics                    |
| GET      | `/api/logs`                   | System logs                          |
| POST     | `/api/simulator/start` 🔒     | Start the simulator                  |
| POST     | `/api/simulator/tick`         | Generate one event                   |
| WS       | `/ws/alerts`                  | Live alert/transaction stream        |

🔒 = requires the admin token.

---

## 🧠 How the threshold engine works

Every transaction (from the simulator or the API) is evaluated against all
**enabled** rules in `services.evaluate_transaction()`:

1. Compute the *actual value* for the rule's metric (amount, rolling count,
   unusual-location flag, …).
2. Compare it to the rule's threshold using the configured operator.
3. On a breach, create an `Alert`, write a system log, fire notifications, and
   broadcast it to all connected dashboards over the WebSocket.

Rate-based metrics (`transaction_count`, `failed_login_count`) look back over
`time_window_seconds` and de-duplicate against existing active alerts.
