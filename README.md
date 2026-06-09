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
