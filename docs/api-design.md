# API Design

## Purpose

The API layer exposes the document automation pipeline to workflow systems.

It is designed to support:

```text
Power Automate custom connector
Dataverse import flow
Power Apps review actions
SharePoint or upload triggers
external workflow systems
```

---

## Core API Boundary

The API should not let an AI model silently write business records.

The API returns structured extraction results, validation issues, review packets, and workflow payloads. Power Automate and Dataverse then control approval, review, and downstream posting.

---

## Main Resources

| Resource | Purpose |
|---|---|
| Pipeline Run | One processing execution |
| Source Document | Input file, text, or reference |
| Canonical Invoice Line | Normalized extracted row |
| Validation Issue | Deterministic issue found by validation rules |
| Power Automate Payload | Dataverse-ready combined payload |
| Review Action | Human approval, correction, rejection, escalation, or request for information |

---

## API Operations

| Operation | Method | Path | Purpose |
|---|---|---|---|
| Create Pipeline Run | POST | `/pipeline-runs` | Start processing from documents or OCR text |
| Get Pipeline Run | GET | `/pipeline-runs/{runId}` | Read status and metrics |
| List Invoice Lines | GET | `/pipeline-runs/{runId}/invoice-lines` | Read canonical rows |
| List Validation Issues | GET | `/pipeline-runs/{runId}/validation-issues` | Read review flags |
| Get Power Automate Payload | GET | `/pipeline-runs/{runId}/power-automate-payload` | Read Dataverse-ready payload |
| Create Review Action | POST | `/review-actions` | Record human decision |

---

## Power Automate Pattern

```text
Trigger
→ Create Pipeline Run
→ wait or poll run status
→ Get Power Automate Payload
→ create Processing Run row
→ create Invoice Batch rows
→ create Invoice Line rows
→ create Validation Issue rows
→ condition: requiresHumanReview
→ review or approval path
```

---

## Local Development Shape

A local wrapper can be implemented as:

```text
Node.js Express API
or
Azure Functions JavaScript API
or
Python FastAPI service
```

For the portfolio, the OpenAPI contract is enough to show connector design and API integration thinking without exposing private endpoints or credentials.

---

## Error Handling

| Error | HTTP Status | Meaning |
|---|---:|---|
| Invalid input | 400 | Required request fields missing or invalid |
| Unauthorized | 401 | Caller not authenticated |
| Forbidden | 403 | Caller lacks permission |
| Run not found | 404 | Pipeline run id does not exist |
| Conflict | 409 | Duplicate run or duplicate source document |
| Validation failed | 422 | Input accepted but cannot be processed safely |
| Server failure | 500 | Unexpected runtime failure |

---

## Security Model

Public repo design only. Production implementation should use:

```text
Microsoft Entra authentication
least-privilege service principal
secret storage outside source code
environment variables for endpoints
request logging without sensitive document text
role-based reviewer permissions
```

---

## Public Safety Boundary

The repository includes the API contract, not a real production API URL. No secrets, client URLs, private invoice data, or private rules should be committed.
