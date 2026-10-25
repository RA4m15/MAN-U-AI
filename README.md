# MAN-U-AI: Industrial AI Copilot

[![CI](https://github.com/shivasoni66/MAN-U-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/shivasoni66/MAN-U-AI/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D9.0.0%20(rec)-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)

MAN-U-AI is an enterprise-grade, multimodal AI copilot purpose-built for heavy industry, mining operations, petrochemical plants, and advanced manufacturing facilities. It grounds generative AI in verified standard operating procedures (SOPs), equipment maintenance manuals, Lockout/Tagout (LOTO) protocols, failure code registries, and plant asset telemetry.

The platform eliminates maintenance downtime and hallucination risks by combining OCR-assisted multimodal PDF ingestion, hybrid vector/keyword search, strict page-level source citations, and role-based access control (RBAC).

---

## Key Capabilities

* **Multimodal Industrial RAG**: Answers technical troubleshooting inquiries using hybrid retrieval (cosine vector similarity + exact technical keyword overlap for part numbers, torque specs, and fault codes).
* **Strict Evidence Grounding & Anti-Hallucination**: Refuses out-of-scope inquiries and flags hazardous energy systems (e.g., LOTO, hydraulic isolation, ammonia circuits) with safety warning banners.
* **OCR & Schematic Extraction**: Extracts dense technical tables and diagrams from complex industrial PDFs with automatic Gemini Vision OCR fallback.
* **Role-Based Access Control (RBAC)**: Fine-grained permissions across `admin`, `engineer`, and `viewer` roles, restricting personnel registries and confidential engineering documents.
* **Live Telemetry & Diagnostics**: Real-time asset monitoring, sensor threshold alerts, failure mode diagnostics, and shift handover reporting.
* **Production-Grade Resilience**: Multi-model fallback (`gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3-flash-preview`), dynamic quota cooldown, request correlation IDs (`X-Request-Id`), and database-independent health/readiness probes.

---

## Monorepo Architecture

MAN-U-AI is structured as a TypeScript monorepo managed via `pnpm` workspaces:

```
MAN-U-AI/
├── apps/
│   ├── api/                  # Express 4 + TypeScript backend service
│   │   ├── src/
│   │   │   ├── config/       # Environment, database, and demo seeding
│   │   │   ├── middlewares/  # JWT auth, RBAC, and rate limiters
│   │   │   ├── models/       # Mongoose schemas (Document, User, Equipment, etc.)
│   │   │   ├── routes/       # Versioned REST endpoints (/api/v1/...)
│   │   │   ├── scripts/      # Administrative CLI utilities (provision-user)
│   │   │   ├── services/     # RAG pipeline, Gemini GenAI client, storage, vector
│   │   │   └── utils/        # Error logging and correlation helpers
│   │   └── test/             # Vitest test suites (24 test suites, unit + integration)
│   └── web/                  # React 18 + Vite frontend client
│       ├── src/
│       │   ├── components/   # UI components, layout, and Radix primitives
│       │   ├── context/      # Auth, telemetry, and socket providers
│       │   ├── hooks/        # React Query hooks and custom state
│       │   ├── pages/        # Views (Chat, Documents, Equipment, Settings)
│       │   └── styles/       # Tailwind CSS & design tokens
│       └── test/             # Vitest frontend component tests
├── packages/
│   └── shared/               # Shared TypeScript types, interfaces, and schemas
├── docs/                     # Architecture manuals and implementation specifications
├── .github/workflows/        # GitHub Actions CI workflow definitions
├── .env.example              # Canonical environment template
├── pnpm-workspace.yaml       # Workspace package definitions
└── render.yaml               # Render Infrastructure-as-Code deployment blueprint
```

---

## Prerequisites

Before setting up MAN-U-AI locally, ensure your system has:

* **Node.js**: `>= 20.0.0` (LTS recommended)
* **pnpm**: `>= 9.0.0` recommended (minimum `>= 8.0.0` defined in `package.json` engines; `pnpm 9+` matches `pnpm-lock.yaml` v9 and CI) (`npm install -g pnpm@latest`)
* **MongoDB**: `>= 7.0` (Local MongoDB instance or MongoDB Atlas cluster URI)
* **Google Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)
* **Cloudinary Account (Optional for local, required for Render production)**: Free cloud storage for uploaded equipment manuals.

---

## Installation & Quickstart

### 1. Clone the Repository
```bash
git clone https://github.com/shivasoni66/MAN-U-AI.git
cd MAN-U-AI
```

### 2. Install Workspace Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Copy the root `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```
Edit `.env` with your settings (see [Environment Variable Reference](#environment-variable-reference) below).

> **Note on Security**: Never commit `.env` or credential files to Git. The repository `.gitignore` automatically excludes `.env` and local uploads.

### 4. Build Shared Workspace Packages
```bash
pnpm build
```

### 5. Seed Initial Database Accounts & Assets (Optional for Development)
To initialize the database with default test personnel, sample industrial manuals, and equipment records:
```bash
# Provide INITIAL_SEED_PASSWORD in your .env or shell
pnpm --filter @man-u-ai/api seed
```

Alternatively, to provision or reset an individual administrator or engineer account via the dedicated CLI:
```bash
pnpm --filter @man-u-ai/api provision-user --name "Elena Rostova" --email admin@plant.io --role admin --password "YourSecurePassword123!"
```

### 6. Launch Local Development Servers
Run both API and Web frontend concurrently:
```bash
pnpm dev
```
* **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
* **Backend API Server**: [http://localhost:4000](http://localhost:4000)
* **API Health Check**: [http://localhost:4000/health](http://localhost:4000/health)

---

## Environment Variable Reference

All configuration is centralized and validated at runtime via Zod in `apps/api/src/config/env.ts`.

| Variable | Required / Default | Target | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional (`development`) | Backend | Runtime mode: `development`, `production`, or `test`. |
| `PORT` | Optional (`4000`) | Backend | HTTP port for the Express API server. |
| `CORS_ORIGIN` | Required in Prod (`http://localhost:5173`) | Backend | Allowed CORS origins. In production, must be explicit URL (no wildcard `*`). |
| `JWT_SECRET` | Required in Prod (>= 32 chars) | Backend | Secret used to sign user access tokens (7-day default expiry). |
| `JWT_EXPIRES_IN` | Optional (`7d`) | Backend | Token lifetime string (e.g., `7d`, `24h`). |
| `REFRESH_TOKEN_SECRET` | Required in Prod (>= 32 chars) | Backend | Secret used to sign refresh tokens (30-day default expiry). |
| `REFRESH_TOKEN_EXPIRES_IN` | Optional (`30d`) | Backend | Refresh token lifetime string. |
| `MONGODB_URI` | Required in Prod (Remote URI) | Backend | MongoDB connection string. Localhost rejected in production. |
| `VECTOR_STORE` | Optional (`mongodb`) | Backend | Vector storage backend: `mongodb`, `chromadb`, `pinecone`, or `memory` (dev/test only). |
| `STORAGE_PROVIDER` | Optional (`local`) | Backend | Document storage provider: `local`, `cloudinary`, `s3`, or `gcs`. |
| `STORAGE_LOCAL_PATH` | Optional (`./uploads`) | Backend | Local disk directory for uploads when `STORAGE_PROVIDER=local`. |
| `CLOUDINARY_CLOUD_NAME` | Required if Cloudinary | Backend | Cloudinary cloud identifier. |
| `CLOUDINARY_API_KEY` | Required if Cloudinary | Backend | Cloudinary API access key. |
| `CLOUDINARY_API_SECRET` | Required if Cloudinary | Backend | Cloudinary API secret. |
| `CLOUDINARY_URL` | Optional | Backend | Alternative combined connection string for Cloudinary. |
| `GEMINI_API_KEY` | Required for Live AI | Backend | Google Gemini API key. Automated deterministic fallback used during tests. |
| `GEMINI_MODEL` | Optional (`gemini-3.8-flash`) | Backend | Primary generative reasoning model. |
| `GEMINI_FALLBACK_MODELS` | Optional (`gemini-3.6-flash,gemini-3.8-flash`) | Backend | Comma-delimited list of backup models for quota/rate-limit recovery. |
| `GEMINI_EMBEDDING_MODEL` | Optional (`gemini-embedding-001`) | Backend | Embedding model for vector semantic search (768 dimensions). |
| `RATE_LIMIT_WINDOW_MS` | Optional (`60000`) | Backend | Rate limiting window in milliseconds (default: 1 minute). |
| `RATE_LIMIT_MAX_REQUESTS` | Optional (`100`) | Backend | Max requests per IP window. |
| `VITE_API_URL` | Optional (`http://localhost:4000/api/v1`) | Frontend | Base REST API URL accessed by browser client. |
| `VITE_WS_URL` | Optional (`http://localhost:4000`) | Frontend | Socket.IO server URL for real-time progress events. |

---

## Workspace Development Scripts

From the repository root, you can run commands across all packages:

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts API (`apps/api`) and Web (`apps/web`) concurrently in watch mode. |
| `pnpm dev:api` | Starts only the Express API backend via `tsx watch`. |
| `pnpm dev:web` | Starts only the Vite frontend dev server with HMR. |
| `pnpm build` | Compiles `@man-u-ai/shared`, `@man-u-ai/api`, and `@man-u-ai/web`. |
| `pnpm typecheck` | Runs TypeScript compiler checks (`tsc --noEmit`) across all workspaces. |
| `pnpm lint` | Runs `oxlint` across backend and frontend source files. |
| `pnpm test` | Runs the full Vitest automated test suite across all packages. |
| `pnpm clean` | Cleans build artifacts (`dist`, `.turbo`, `node_modules`). |

---

## Testing Strategy & Quality Assurance

MAN-U-AI enforces comprehensive test coverage with automated CI:

* **Backend Tests (`apps/api/test`)**: 24 Vitest suites covering:
  * Multimodal RAG retrieval and citation grounding (`multimodal_rag.test.ts`, `rag.test.ts`).
  * OCR fallbacks and visual schematic extraction (`stage5_ocr_semantics.test.ts`, `visual.service.ts`).
  * Authentication, session timeouts, and RBAC barriers (`stage5_auth_timeout.test.ts`, `security_hardening.test.ts`).
  * Production environment validation and secret hygiene (`stage5_provisioning.test.ts`, `security_remediation.test.ts`).
  * Model cooldown, retry loops, and deterministic test fallbacks (`stage5_cooldown_selection.test.ts`, `final_hardening.test.ts`).
  * Real-time WebSocket event dispatching (`socket_events.test.ts`).
* **Frontend Tests (`apps/web/test`)**: 5 Vitest suites validating UI state, route guards, and live telemetry rendering.
* **Continuous Integration (`.github/workflows/ci.yml`)**: Every push to `main` spins up an Ubuntu container with a live MongoDB 7.0 service, runs dependency validation, executes builds, typechecks, lints, and runs the entire automated test suite.

To run tests locally:
```bash
# Run all workspace tests
pnpm test

# Run a specific backend test suite
pnpm --filter @man-u-ai/api test test/multimodal_rag.test.ts

# Run frontend tests
pnpm --filter @man-u-ai/web test
```

---

## Deployment Overview

MAN-U-AI is preconfigured for deployment on [Render](https://render.com) using the root `render.yaml` blueprint:

1. **API Web Service (`man-u-ai-api`)**:
   * Node.js runtime executing `node dist/index.js`.
   * Health check path configured at `/health/ready`.
   * Environment secrets (MongoDB Atlas connection string, Gemini API key, Cloudinary keys) injected via Render dashboard.
2. **Web Static Site (`man-u-ai-web`)**:
   * Prebuilt static distribution published from `./apps/web/dist`.
   * SPA rewrite rule (`/* -> /index.html`) enabled for client-side routing.
   * `VITE_API_URL` and `VITE_WS_URL` wired directly to the live backend service.

---

## Troubleshooting & FAQ

* **MongoDB Connection Refused**: Ensure MongoDB is running locally (`mongod` or Docker container on port `27017`) or check network access / IP whitelisting in MongoDB Atlas.
* **Gemini Quota Exceeded / Rate Limits**: The API service includes automatic cooldown tracking and failover to `gemini-3.6-flash` and `gemini-3.8-flash`. In offline development, the deterministic fallback ensures unblocked workflows.
* **Uploads Fail (File Size / Format)**: Uploads are restricted to valid PDF files (`.pdf`) up to 50MB. Non-PDF files are rejected with `UNSUPPORTED_FILE_TYPE`.
* **CORS Origin Rejected in Production**: In `production`, `CORS_ORIGIN` must match your frontend URL exactly (e.g. `https://your-app.onrender.com`). Wildcards (`*`) are disallowed by design.

---

## License

This project is licensed under the MIT License.
