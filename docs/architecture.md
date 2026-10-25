# MAN-U-AI Architecture & Operational Guide

## System Overview
MAN-U-AI is a specialized full-stack industrial AI copilot engineered for heavy industry, mining, petrochemical plants, and manufacturing facilities. It automates standard operating procedure (SOP) retrieval, equipment manual technical lookup, failure code diagnosis, and shift handoffs.

```
+-------------------------------------------------------------------------+
|                                 CLIENT                                  |
|   React 18 + Vite + Tailwind CSS + TanStack Query + Linear Dark Tokens  |
+------------------------------------+------------------------------------+
                                     |  REST API / Socket.IO
                                     v
+-------------------------------------------------------------------------+
|                               API LAYER                                 |
| Express 4.x + TypeScript + Zod Validation + JWT Authentication + Multer |
+---------+--------------------------+------------------------+-----------+
          |                          |                        |
          v                          v                        v
+-------------------+      +-------------------+    +---------------------+
|  OBJECT STORAGE   |      |   MULTIMODAL AI   |    |    VECTOR STORE     |
| Cloudinary / S3 / |      | Google Gemini 3.8 |    | MongoDB Atlas HNSW  |
| Local Disk Store  |      |  gemini-embedding |    | Vector Search or    |
|                   |      |  Vision Analysis  |    | In-Memory Cosine    |
+-------------------+      +-------------------+    +---------------------+
          ^                                                   ^
          |                                                   |
          +------------------ DOCUMENT INGESTION -------------+
                             PDF text extraction + OCR fallback
                             Structural Chunking + Citations
```

---

## Multimodal Ingestion, Retrieval, & Answering Pipeline

### 1. Document Ingestion Lifecycle
1. **Upload & Validation**:
   * Accepts PDF files up to 50MB via `/api/v1/documents/upload`.
   * Magic number and MIME signature check (`%PDF`) reject corrupt or non-PDF binaries (`UNSUPPORTED_FILE_TYPE`).
2. **Text & Schematic Parsing**:
   * Extracts text, tables, and structural sections per page using `pdf-parse` / `pdf-lib`.
   * **OCR Fallback**: If a page has minimal selectable text (e.g. scanned blue-prints, low-res schematics), the system invokes Gemini Vision to extract dense text, figures, and numerical tables.
3. **Chunking & Embedding Generation**:
   * Splits extracted content into semantically coherent chunks preserving section hierarchy and page numbers.
   * Generates 768-dimensional embeddings using `gemini-embedding-001` (or deterministic embeddings during isolated test runs).
4. **Persistence & Indexing**:
   * Chunks are stored in MongoDB (`DocumentChunk` collection) with associated metadata (`documentId`, `pageNumber`, `sectionTitle`, `vector`).
   * Real-time progress is broadcast to connected frontend clients via Socket.IO events (`document:progress`, `document:status`).

### 2. Hybrid Retrieval Mechanism
When an engineer or technician submits a technical query (e.g. *"What is the gland stud torque rating and permissible shaft runout in the Heavy Duty Slurry Pump Overhaul Standard?"*):
* **Candidate Fetching**: Loads chunks from MongoDB (up to `CANDIDATE_CHUNK_LIMIT = 500`) filtered by permitted document IDs and index status (`status: "indexed"`).
* **Hybrid Scoring Formula (`vector.service.ts`)**:
  * Extracts filtered technical query tokens (excluding common English stopwords).
  * Computes cosine similarity (`cosineSim`) between query embedding and chunk embedding.
  * Measures keyword overlap (`keywordRatio = keywordMatches / totalTokens`).
  * **Scoring Logic**:
    * If `keywordMatches > 0`: `score = Math.max(cosineSim, 0.45 + keywordRatio * 0.45)` (boosts chunks with verified part numbers, torque values, or fault codes up to 0.90).
    * If `keywordMatches === 0`: `score = cosineSim * 0.5` (applies a strict 50% penalty to reduce purely lexical or semantic false-positives).
  * Chunks satisfying the minimum similarity threshold (`minSimilarity = 0.5`) are ranked and sliced to `topK` (default 5).
* **Access Control Filtering**: Queries strictly constrain candidate chunks to document IDs authorized for the user's role (`admin`, `engineer`, `viewer`).

### 3. Grounded Synthesis & Anti-Hallucination
* **System Prompting**: Injects retrieved document chunks as strict, bounded evidence.
* **Refusal Guardrail**: If retrieved evidence does not support the query (e.g., questions about hyperdrive reactors or unapproved modifications), the model explicitly refuses and communicates insufficient evidence without speculating.
* **Hazard & Safety Banners**: Inquiries referencing dangerous machinery, LOTO (Lockout/Tagout), or toxic chemicals automatically trigger safety warnings.
* **Source Citations**: Returns verifiable citations containing document title, revision, page number, and section anchor for every technical assertion.

---

## Active AI Model Architecture & Resilience

The platform leverages Google Gemini models via `@google/genai` (v2.30+), configured dynamically through environment variables and facility settings:

* **Primary Generative Model**: `gemini-3.8-flash` (or `gemini-3-flash-preview` in deployment).
* **Fallback Cascade**: `gemini-3.6-flash`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`.
* **Embedding Model**: `gemini-embedding-001` (768 dimensions).
* **Deterministic Reasoning**: Modern Gemini 3.x models enforce strict deterministic logic. Generation configuration omits sampling parameters (temperature, top_p, top_k) when unsupported by model capabilities.
* **Quota Management & Circuit Breakers**:
  * 429 Quota / Rate-limit responses activate model cooldown timers with exponential backoff.
  * Automatic failover cascades to configured fallback models before returning an error.
  * In offline or CI environments, deterministic mock generation allows complete pipeline testing without live API keys.

---

## Security, Access Control, & Persistence

### 1. Role-Based Access Control (RBAC)
* **`admin`**: Full access to plant configuration, integration endpoints, document deletion, and personnel user registry (`/api/v1/users`).
* **`engineer`**: Can upload documents, run troubleshooting queries, inspect telemetry, and download approved manuals. Restricted from user administration.
* **`viewer`**: Read-only query capability against approved SOPs; cannot upload or modify system configuration.

### 2. Authentication & Credential Hardening
* JWT-based access tokens with 7-day expiration and 30-day refresh tokens.
* Production validation rejects default secrets (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`) shorter than 32 characters.
* Passwords hashed using bcrypt (10 rounds) and validated against strong complexity requirements.

### 3. Database Models (MongoDB / Mongoose)
* `User`: Credentials, RBAC role, organization ID, and activity timestamps.
* `Equipment`: Asset registry, operational status, fault history, and telemetry thresholds.
* `DocumentModel`: Document metadata, revision status, approval lifecycle, and storage references.
* `DocumentChunk`: Text chunks, page numbers, figure IDs, and 768-dimensional embedding vectors.
* `Conversation` & `Message`: Chat sessions, message history, feedback ratings, and grounded citation arrays.
* `AuditEvent`: Cryptographic traceability of security, upload, and administration actions.
* `FacilitySettings`: Dynamic facility-wide configurations, model selections, and threshold overrides.

---

## Deployment & Operational Topologies

MAN-U-AI is deployed on **Render** using a dual-service architecture:

1. **API Web Service (`man-u-ai-api`)**:
   * Node.js runtime executing Express server with clustered reverse-proxy trust (`trust proxy 1`).
   * Health endpoints:
     * `/health/live`: Fast liveness check verifying Node process responsiveness.
     * `/health/ready`: Readiness check verifying MongoDB connection, vector store configuration, and app initialization.
   * Auto-deploys from `origin/main` upon successful commit.
2. **Web Static Site (`man-u-ai-web`)**:
   * Prebuilt React SPA hosted via Render Static Site with global CDN.
   * Single-page routing rewritten to `/index.html`.
3. **External Dependencies**:
   * **Database**: MongoDB Atlas M0/M10+ cluster.
   * **Object Storage**: Cloudinary (or AWS S3 / GCS) for document PDF persistence without requiring ephemeral container disk storage.
   * **LLM Engine**: Google AI Studio / Gemini API.
