# Demo Talk Tracks

## 30-Second Demo

This repository demonstrates a private document automation pipeline. The base pipeline takes synthetic invoice-style OCR text, segments invoice line items, extracts canonical rows, normalizes fields, validates arithmetic and required values, reconciles invoice weights, and writes JSON/CSV outputs. The orchestration layer then turns those outputs into a Power Platform-ready payload, a human review packet, and an audit log. The architecture is designed to connect into Dataverse, Power Apps review screens, Power Automate approval flows, and downstream business systems.

---

## 2-Minute Demo

The project starts with synthetic OCR-style invoice text so the public repository stays sanitized and does not expose private client documents. The first pipeline stage creates the OCR text, then a segmentation stage separates invoice item blocks. The canonical row builder converts those blocks into structured fields such as invoice number, shipment number, product number, quantity, unit price, line amount, commodity code, country of origin, order number, net weight, and gross weight.

After extraction, the validation model checks required fields and verifies that quantity multiplied by unit price equals the line amount. The reconciliation stage checks invoice-level net and gross weights against the line totals. The pipeline writes master JSON, master CSV, validation flags, and a run summary.

The new orchestration layer reads those outputs and runs bounded agents: intake, validation, routing, Power Platform payload generation, review packet generation, and audit logging. This demonstrates how the document intelligence output can become operational workflow data for Dataverse, Power Apps, Power Automate, and downstream systems.

---

## 5-Minute Demo Structure

| Minute | Section | What to Show |
|---:|---|---|
| 0-1 | Problem | Manual invoice/document extraction is slow, error-prone, and hard to audit |
| 1-2 | Base pipeline | Show OCR text to segmentation to canonical rows to validation outputs |
| 2-3 | Validation | Explain arithmetic checks, required fields, and weight reconciliation |
| 3-4 | Orchestration | Show agent state, routing, Power Automate payload, review packet, and audit log |
| 4-5 | Power Platform extension | Explain Dataverse schema, custom connector, Power Apps review console, and approval flows |

---

## Ownership Answer

I used a public-safe synthetic dataset so the repo can be shared with recruiters. The important part is the architecture pattern: extraction alone is not enough. The system has to normalize fields, validate business truth, reconcile source totals, route exceptions, preserve audit history, and produce outputs that can flow into Power Platform or other business systems.

---

## What Is Implemented

```text
synthetic OCR input
invoice item segmentation
canonical row extraction
normalization
validation
weight reconciliation
master JSON/CSV outputs
evaluation harness
multi-agent orchestration wrapper
Power Automate-ready payload
human review packet
audit log
Dataverse schema documentation
OpenAPI custom connector design
Power Platform implementation documentation
```

---

## What Is Planned Next

```text
real custom connector import into Power Platform
Dataverse solution build
Power Apps model-driven review console
Power Automate import and approval flows
optional local OCR/PDF adapter
optional RAG layer over SOP and vendor rules
```
