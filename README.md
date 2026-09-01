# RemindTrack

Statutory undertrial compliance tracker for Indian Judicial Magistrate Courts under the Bharatiya Nagarik Suraksha Sanhita (BNSS 2023).

Tracks custody durations across magistrate cause lists and fires milestone alerts when undertrials approach or breach statutory detention limits — 90-day investigation deadlines (Sec 187), half-sentence bail eligibility (Sec 479), and maximum custody ceilings (Art. 21).

Built for the SIH 2026 problem statement on automating undertrial remand oversight.

---

## Quick Start

```bash
# 1. Install dependencies
npm install
pip install -r document_engine/requirements.txt -r backend/audit/requirements.txt

# 2. Run (starts Node server + Python PDF engine + Python audit logger)
./run-integrated.sh

# 3. Open
open http://localhost:3000
```

---

## Login Credentials

### Judicial Magistrates (Primary Users)
| Username | Role | Scope |
|:--|:--|:--|
| `jm-1` | Judicial Magistrate - I | JM-I bench cases only |
| `jm-2` | Judicial Magistrate - II | JM-II bench cases only |
| `jm-3` | Judicial Magistrate - III | JM-III bench cases only |
| `cjm` | Chief Judicial Magistrate | All benches (supervisory) |

### Other Stakeholders
| Username | Role |
|:--|:--|
| `io-police` or `sho` | Investigating Officer |
| `dlsa` or `counsel` | DLSA Legal Aid Counsel |
| `prison` or `jail` | Prison Authority / Jail Superintendent |
| `registry` or `clerk` | Court Registry / Head Clerk |

Password: any non-empty string (demo auth).

Hidden demo panel: type `demo` anywhere on the login page, or press `Option+L` / `Ctrl+Shift+L`.

---

## Statutory Compliance Flags

| Flag | Rule | Provision | Trigger |
|:--|:--|:--|:--|
| **RED** | Max custody exceeded | Sec 479(2) / 436A CrPC | Custody ≥ 100% of max sentence |
| **RED** | Investigation remand breached | Sec 187(2) | Beyond 60/90-day window without chargesheet |
| **ORANGE** | 1/3 sentence (first offender) | Sec 479(1) Proviso | First offender at ≥ 33% of max |
| **ORANGE** | 1/2 sentence (regular) | Sec 479(1) | Regular undertrial at ≥ 50% of max |
| **AMBER** | Approaching deadlines | Sec 187(3) / 479 | Within 30 days of any statutory threshold |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  React SPA (Vite + Tailwind)                    │
│  Login → /workspace → /workspace/case/:id       │
└──────────────────┬──────────────────────────────┘
                   │ fetch /api/*
┌──────────────────▼──────────────────────────────┐
│  Express Server (server.ts)           :3000     │
│  ├── /api/cause-list     SQLite + Rule Engine   │
│  ├── /api/generate-document  → PDF Engine       │
│  ├── /api/audit-log      → Audit Service        │
│  ├── /api/cases/verify-integrity (SHA-256)      │
│  └── /api/cases/merkle-root                     │
├─────────────────────────────────────────────────┤
│  SQLite (better-sqlite3)                        │
│  AES-256-GCM encrypted fields + SHA-256 hashes  │
└─────────────────────────────────────────────────┘
         │                        │
┌────────▼───────┐    ┌──────────▼──────────┐
│ PDF Engine     │    │ Audit Logger        │
│ (ReportLab)    │    │ (SHA-256 chain)     │
│ Python :8001   │    │ Python :8002        │
└────────────────┘    └─────────────────────┘
```

---

## Deployment (Railway)

### One-click

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template)

1. Push repo to GitHub
2. Create a new Railway project → "Deploy from GitHub repo"
3. Railway auto-detects the `Dockerfile` and deploys
4. Set env var `CASE_ENCRYPTION_KEY` in Railway dashboard (or let it auto-generate)

### Manual

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

The app runs on a single container with all 3 services (Node + Python PDF + Python Audit).

---

## Project Structure

```
├── src/                    # React frontend (Vite + Tailwind v4)
│   ├── components/         # UI components (CauseListModule, CaseDetailPanel, etc.)
│   ├── services/           # API client, auth, mock data
│   ├── router/             # Client-side routing
│   └── types/              # TypeScript interfaces
├── server.ts               # Express API gateway + Vite dev middleware
├── backend/
│   ├── db.ts               # SQLite data layer (better-sqlite3)
│   ├── encryption.ts       # AES-256-GCM field encryption
│   ├── integrity.ts        # SHA-256 hash chain + Merkle root
│   ├── seed.ts             # Database seeder
│   ├── rule-engine/        # BNSS statutory compliance engine
│   ├── data/               # SQLite DB + seed JSON files
│   └── audit/              # Module 5 audit logger (Python)
├── document_engine/        # Module 4 PDF generator (Python/ReportLab)
├── Dockerfile              # Production container (Node + Python)
├── Procfile                # Railway/Render process definition
└── run-integrated.sh       # Local dev: starts all 3 services
```

---

## Environment Variables

| Variable | Required | Default | Description |
|:--|:--|:--|:--|
| `CASE_ENCRYPTION_KEY` | No | Auto-generated | 64-char hex key for AES-256-GCM |
| `PORT` | No | `3000` | Server port |
| `PDF_SERVICE_URL` | No | `http://127.0.0.1:8001` | PDF engine URL |
| `AUDIT_SERVICE_URL` | No | `http://127.0.0.1:8002` | Audit service URL |
