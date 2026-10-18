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
|  PRIVATE STORAGE  |      |   MULTIMODAL AI   |    |    VECTOR STORE     |
|  Local disk / S3  |      |  Gemini 2.0 Flash |    | MongoDB Atlas HNSW  |
|  Isolated PDFs &  |      |  text-embedding   |    | Vector Search or    |
|  CAD Schematics   |      |  Vision Analysis  |    | Hybrid Cosine Store |
+-------------------+      +-------------------+    +---------------------+
          ^                                                   ^
          |                                                   |
          +------------------ DOCUMENT INGESTION -------------+
                             PDF text extraction + OCR fallback
                             Structural Chunking + Citations
```

## Multimodal RAG Pipeline
1. **User Inquiry**: Technician asks a troubleshooting question via text or voice.
2. **Context Resolution**: The system pulls user credentials, facility zone, and optional equipment target.
3. **Hybrid Retrieval**:
   - 70% Cosine Vector Similarity (768-dimensional text-embedding-004)
   - 30% Exact Technical Keyword Overlap (part numbers, torque specs, fault codes)
4. **Safety Verification**:
   - Queries involving hazardous energy or chemical systems (e.g. LOTO, ammonia) automatically trigger safety banners.
5. **Grounded Generation**:
   - The multimodal model synthesizes answers exclusively from retrieved evidence.
   - Returned citations strictly link back to verified source pages.

## Database Models (MongoDB / Mongoose)
- `User`: RBAC authentication (admin, engineer, viewer)
- `Equipment`: Machine registry with telemetry parameters
- `Document`: Revisions, statuses, metadata
- `DocumentChunk`: Text chunks with embedded vector representations
- `ProcessingJob`: Background ingestion lifecycle tracking
- `Conversation` & `Message`: Chat history with citation references
- `AuditEvent`: Cryptographic traceability of actions for SOC2 / ISO 55001 compliance
- `MaintenanceIssue`: Equipment failure reports
