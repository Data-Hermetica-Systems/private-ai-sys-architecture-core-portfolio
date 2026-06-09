# API Layer

## Purpose

This folder defines the API contract that connects the document automation pipeline to Power Automate, Dataverse, Power Apps, and downstream systems.

The public repository does not expose a production endpoint. It provides the OpenAPI contract and local-service design needed to build a custom connector or Azure Function wrapper.

---

## Files

| File | Purpose |
|---|---|
| `openapi.yaml` | Power Automate custom connector contract |
| `local-service-design.md` | Local or Azure Function service design notes |

---

## API Responsibilities

| Responsibility | Description |
|---|---|
| Start pipeline run | Accept document text or file references and create a processing run |
| Get run summary | Return extraction and validation metrics |
| List invoice lines | Return canonical normalized invoice line records |
| List validation issues | Return deterministic validation flags |
| Get Power Automate payload | Return Dataverse-ready payload for workflow automation |
| Submit review action | Record human approval, correction, rejection, escalation, or request-for-information action |

---

## Power Automate Integration Pattern

```text
Power Automate trigger
→ call custom connector action
→ receive Power Automate payload
→ create Processing Run row
→ create Invoice Batch rows
→ create Invoice Line rows
→ create Validation Issue rows
→ route review or approval flow
```

---

## Custom Connector Actions

| Connector Action | API Operation | Power Platform Use |
|---|---|---|
| Create Pipeline Run | `POST /pipeline-runs` | Start a document-processing job |
| Get Pipeline Run | `GET /pipeline-runs/{runId}` | Read run status and metrics |
| List Invoice Lines | `GET /pipeline-runs/{runId}/invoice-lines` | Import line records into Dataverse |
| List Validation Issues | `GET /pipeline-runs/{runId}/validation-issues` | Create review queue issues |
| Get Power Automate Payload | `GET /pipeline-runs/{runId}/power-automate-payload` | Single payload for Dataverse import flow |
| Create Review Action | `POST /review-actions` | Send reviewer decisions back to service |

---

## Public Safety Boundary

The API contract is public-safe and uses generic schema names. It does not include private client URLs, authentication secrets, vendor-specific rules, or production payload examples from real documents.
