# Private AI Document Automation Platform

## Local-First Document Intelligence for Logistics and Customs Invoice Automation

This repository contains a sanitized public portfolio implementation of a private document automation platform.

The project demonstrates a local-first document intelligence architecture that converts semi-structured invoice text into canonical JSON and CSV outputs using OCR-style input simulation, invoice item segmentation, schema-guided extraction, validation rules, and invoice-level weight reconciliation.

The repository is designed to show the architecture, processing pattern, validation model, and Power Platform integration roadmap without exposing private production extraction rules, client data, internal prompts, private document samples, or deployment-specific business logic.

---

## Project Summary

The system demonstrates how a private document automation pipeline can process logistics, customs, commercial, and proforma invoice data into review-ready structured records.

The public demo uses synthetic invoice data and generalized parser logic.

The broader architecture is designed to support:

```text
local/private document processing
OCR and document parsing
canonical JSON/CSV extraction
validation and reconciliation
human review workflows
Dataverse storage
Power Apps review console
Power Automate approval workflows
custom connector integration
API service integration
local AI fallback
RAG over SOP/vendor rules
ALM and deployment documentation
```

---

## Problem Solved

Document-heavy logistics and customs workflows often require repeated manual extraction from invoices and supporting documents.

Common source fields include:

```text
Invoice number
Invoice date
Shipment number
Material or product number
Description
Quantity
Unit price
Line amount
Commodity code
Country of origin
Delivery note
Order number
Net weight
Gross weight
```

Manual processing creates recurring problems:

```text
copy/paste errors
inconsistent invoice layouts
missing fields
unverified totals
weak auditability
manual exception routing
slow approval cycles
poor downstream integration
```

This project demonstrates a structured automation architecture for converting invoice-like source data into validated, review-ready records.

---

## Current Public Demo Pipeline

The public demo pipeline uses synthetic invoice text and produces local JSON/CSV outputs.

```text
Synthetic invoice OCR text
→ invoice item segmentation
→ canonical row extraction
→ field normalization
→ line amount validation
→ weight-total reconciliation
→ master JSON output
→ master CSV output
→ master validation flags CSV
→ master pipeline summary
```

Short form:

```text
synthetic input
→ segmentation
→ canonical rows
→ validation
→ reconciliation
→ master outputs
```

---

## Current Verified Public Demo Results

The public demo pipeline processes a synthetic invoice sample and produces review-ready structured outputs.

```text
1 synthetic invoice sample
1 generalized invoice family
3 extracted canonical rows
2236.97 USD line amount grand total
1 weight reconciliation job
0 validation flags
master JSON output created
master CSV output created
master validation flags CSV created
master pipeline summary created
```

Latest verified demo run behavior:

```text
Pipeline status: completed
Rows: 3
Line amount grand total USD: 2236.97
Total validation flags: 0
Has validation errors: false
```

Important interpretation:

```text
The public repository uses a sanitized demonstration dataset.

The private implementation benchmark processes a larger internal document set with multiple invoice families, additional reconciliation cases, and source validation flag carry-forward behavior.
```

---

## Why This Architecture Matters

A basic OCR script only extracts text.

A production-grade document automation platform needs a stronger architecture:

```text
OCR or text extraction
+ document-family recognition
+ schema-guided extraction
+ deterministic validation
+ source-total reconciliation
+ exception reporting
+ human review workflow
+ downstream system integration
```

This project demonstrates the core architecture required for reliable document automation:

```text
private processing
repeatable parsing
canonical data modeling
validation-first outputs
auditability
exception routing
integration readiness
```

---

## Technology Stack

Implemented in the public demo:

```text
Node.js
JavaScript
JSON
CSV
PowerShell-compatible local execution
Git/GitHub
```

Architecture targets and extension points:

```text
Tesseract OCR
Poppler PDF rendering
Dataverse
Power Apps
Power Automate
custom connectors
OpenAPI
Azure Functions or local API service
local AI fallback
Qwen
RAG
embeddings
private inference
human review queue
ALM/deployment
```

---

## Public Demo Commands

Install dependencies if needed:

```powershell
npm install
```

Run the public demo pipeline:

```powershell
npm run demo
```

or:

```powershell
npm test
```

Expected runner stages:

```text
STEP 1: Create synthetic OCR input
STEP 2: Segment invoice items
STEP 3: Build canonical invoice rows
STEP 4: Reconcile invoice weight totals
STEP 5: Build master JSON, CSV, and validation flag outputs
```

Expected final summary:

```text
PIPELINE RUN COMPLETE
Rows: 3
Line amount grand total USD: 2236.97
Total validation flags: 0
Has validation errors: false
```

---

## Main Public Demo Scripts

```text
src/demo-ocr-pipeline.js
src/demo-segment-invoice-items.js
src/demo-build-canonical-rows.js
src/demo-reconcile-weight-totals.js
src/demo-build-master-output.js
src/run-demo-pipeline.js
```

These scripts intentionally use a sanitized synthetic invoice sample and generalized demo logic.

They are not the private production extraction engine.

---

## Generated Demo Outputs

The demo creates generated local output files:

```text
ocr/synthetic-commercial-invoice-001-ocr.txt
ocr/synthetic-commercial-invoice-001-segments.json
ocr/demo-ocr-run-summary.json
ocr/demo-segmentation-summary.json
outputs/synthetic-commercial-invoice-001-canonical-lines.json
outputs/synthetic-commercial-invoice-001-canonical-lines.csv
outputs/synthetic-commercial-invoice-001-weight-reconciliation.json
outputs/demo-canonical-lines-summary.json
outputs/demo-weight-reconciliation-summary.json
outputs/master-canonical-invoice-lines.json
outputs/master-canonical-invoice-lines.csv
outputs/master-validation-flags.csv
outputs/master-pipeline-run-summary.json
```

Generated runtime files are ignored by Git.

---

## Canonical Output Schema

The master canonical output uses this row structure:

```text
SourceInvoiceFile
SourceParser
InvoiceNumber
InvoiceDate
ShipmentNumber
InvoiceFamily
LineNo
ProductNumber
Description
Unit
Quantity
UnitPriceUSD
LineAmountUSD
CommodityCode
CountryOfOrigin
DeliveryNote
OrderNumber
NetWeightKG
GrossWeightKG
```

This schema is designed to support downstream mapping into:

```text
Dataverse tables
Power Apps review screens
Power Automate approval flows
ERP integrations
customs workflows
finance processing
analytics dashboards
```

---

## Validation Model

The pipeline validates:

```text
expected row count
required canonical fields
missing product numbers
missing line numbers
missing quantities
missing unit prices
missing line amounts
duplicate line numbers
Quantity × UnitPriceUSD versus LineAmountUSD
NetWeightKG greater than GrossWeightKG
invoice total net weight versus sum(line NetWeightKG)
invoice total gross weight versus sum(line GrossWeightKG)
validation flag carry-forward into master output
```

The system separates:

```text
extraction success
from
verified source truth
```

That means a pipeline run can extract all rows successfully while still producing validation flags if source totals do not reconcile.

---

## Weight Reconciliation

The system includes invoice-level weight reconciliation.

Example numeric normalization rules:

```text
23,580 KG → 23.580 KG
2.495,934 KG → 2495.934 KG
2.268 KG → ambiguous: 2.268 KG or 2268 KG
```

Ambiguous values should only be corrected when invoice totals prove the correction.

The system does not invent line weights to force totals. If line-item totals do not reconcile with invoice-level totals, the system emits validation flags for review.

---

## Repository Structure

```text
private-ai-sys-architecture-core-portfolio
├── README.md
├── CHANGELOG.md
├── package.json
├── .gitignore
├── Project Folder Structure.txt
├── docs
│   ├── architecture.md
│   ├── validation-rules.md
│   ├── weight-reconciliation.md
│   ├── portfolio-summary.md
│   ├── power-platform-extension.md
│   ├── dataverse-schema.md
│   ├── api-design.md
│   ├── custom-connector-design.md
│   ├── evaluation-harness.md
│   ├── rag-rules-layer.md
│   ├── local-ai-inference.md
│   ├── alm-deployment.md
│   └── screenshots.md
├── src
│   ├── demo-ocr-pipeline.js
│   ├── demo-segment-invoice-items.js
│   ├── demo-build-canonical-rows.js
│   ├── demo-reconcile-weight-totals.js
│   ├── demo-build-master-output.js
│   └── run-demo-pipeline.js
├── api
│   ├── README.md
│   ├── openapi.yaml
│   └── local-service-design.md
├── power-platform
│   ├── README.md
│   ├── dataverse-tables.md
│   ├── model-driven-app.md
│   ├── power-automate-flows.md
│   ├── custom-connector.md
│   ├── security-roles.md
│   └── solution-alm.md
├── evaluation
│   ├── README.md
│   ├── evaluation-metrics.md
│   ├── expected-output-schema.md
│   └── sample-evaluation-report.md
├── samples
├── expected
├── images
│   └── .gitkeep
├── ocr
│   └── .gitkeep
└── outputs
    └── .gitkeep
```

---

## Public Repository Scope

This public repository is a sanitized portfolio version of the system.

It intentionally excludes:

```text
private source PDFs
real invoice samples
generated OCR from real documents
generated page images from real documents
generated production outputs
private business notes
internal build workbench files
private extraction rules
client-specific SOPs
vendor-specific rule sets
```

It includes:

```text
sanitized demo pipeline
system architecture
source code for the public demo
validation model
weight reconciliation design
Power Platform extension design
API integration design
evaluation roadmap
local AI/RAG extension roadmap
ALM/deployment roadmap
```

---

## Implemented Versus Planned Scope

| Layer | Status | Notes |
|---|---:|---|
| Sanitized public demo pipeline | Implemented | Synthetic invoice sample, canonical rows, validation, reconciliation, master outputs |
| Canonical JSON/CSV output | Implemented | Public demo generates master JSON and CSV |
| Validation logic | Implemented | Row, arithmetic, and reconciliation checks in demo form |
| Weight reconciliation | Implemented | Demo validates line weights against invoice totals |
| Power Platform extension | Designed | Dataverse, review app, flows, connector, security, ALM docs planned |
| Dataverse schema | Planned documentation | Invoice Batch, Invoice Line, Validation Issue, Processing Run, Vendor Rule, Review Action |
| Evaluation harness | Planned | Expected-vs-actual comparison and metrics |
| API wrapper | Planned | OpenAPI/local service design |
| Custom connector | Planned | Power Platform connector to API layer |
| Local AI fallback | Planned | Qwen/local inference for ambiguity handling |
| RAG over SOP/rules | Planned | Vendor and document-family rule retrieval |
| Human review queue | Planned | Power Apps and Dataverse-based review workflow |
| ALM/deployment | Planned | Solution packaging, environment variables, deployment notes |

---

## Planned Platform Architecture

The full staged platform roadmap:

```text
Email / upload / folder drop
→ document stored
→ OCR / text extraction
→ local extraction pipeline
→ deterministic validation
→ weight-total reconciliation
→ RAG lookup against SOP/vendor rules
→ local AI fallback for ambiguous fields
→ normalized JSON
→ Dataverse record
→ Power Apps review console
→ Power Automate approval / exception workflow
→ audit log and metrics
→ ERP/customs/finance integration
```

---

## Power Platform Extension

Planned Dataverse tables:

```text
Invoice Batch
Invoice Line
Validation Issue
Processing Run
Vendor Rule
Review Action
```

Planned app/workflow components:

```text
model-driven review app
validation issue queue
invoice line review form
approval workflow
export workflow
custom connector
OpenAPI definition
environment variables
security roles
solution packaging
deployment notes
```

This extension is designed to demonstrate Power Platform developer skills including:

```text
Dataverse modeling
business process automation
custom connector design
security role planning
solution-aware development
ALM planning
external API integration
```

---

## API and Custom Connector Roadmap

Planned API capabilities:

```text
POST /pipeline/runs
GET /pipeline/runs/{runId}
GET /pipeline/runs/{runId}/lines
GET /pipeline/runs/{runId}/validation-flags
GET /health
```

The API layer is intended to support:

```text
Power Platform custom connector
Azure Function proxy or local service wrapper
Dataverse import workflow
review status queries
validation flag retrieval
```

---

## Evaluation Harness Roadmap

The planned evaluation harness will compare expected outputs against actual pipeline outputs.

Evaluation dimensions:

```text
row count accuracy
field-level accuracy
amount validation
weight reconciliation result
validation flag count
failure reason classification
schema completeness
```

Planned artifacts:

```text
evaluation/evaluation-metrics.md
evaluation/expected-output-schema.md
evaluation/sample-evaluation-report.md
src/evaluate-pipeline-output.js
```

---

## Local AI and RAG Roadmap

The architecture can support private/local AI extension points for difficult cases.

Potential use cases:

```text
damaged OCR repair
layout ambiguity
field alias mapping
vendor-specific rule interpretation
exception explanation
review recommendation
schema-guided correction suggestions
```

Potential components:

```text
Qwen
local embeddings
RAG over SOP/vendor rules
private inference
local API service
human approval workflow
```

Important design rule:

```text
AI suggestions should not silently overwrite validated business records.

Final outputs should be controlled by deterministic validation, explicit rules, or human approval.
```

---

## Security and Privacy Positioning

The architecture is designed around private/local processing principles.

Design priorities:

```text
private document handling
local-first processing
limited exposure of source documents
auditability
validation before export
review queue for unresolved issues
clear separation of generated outputs from source inputs
controlled downstream integration
```

Public demo data is synthetic and sanitized.

Production implementations should apply client-specific security, retention, access control, and compliance requirements.

---

## Portfolio Value

This project demonstrates practical capability in:

```text
document automation
private AI systems architecture
OCR pipeline design
schema-guided extraction
deterministic validation
invoice reconciliation
exception handling
Power Platform integration design
API/custom connector planning
Dataverse modeling
workflow automation
ALM planning
```

It is designed to show both engineering implementation and business automation architecture.

---

## Roadmap

Next planned improvements:

```text
1. Fill Dataverse schema documentation.
2. Fill Power Platform table and app design documentation.
3. Add OpenAPI specification for pipeline service integration.
4. Add custom connector design.
5. Add evaluation harness design and sample evaluation report.
6. Add local AI fallback architecture.
7. Add RAG rules layer architecture.
8. Add ALM/deployment documentation.
9. Add screenshots of demo pipeline run and generated outputs.
10. Add architecture diagram.
```

---

## Run and Review Checklist

After cloning:

```powershell
npm run demo
```

Then inspect generated outputs:

```text
outputs/master-canonical-invoice-lines.json
outputs/master-canonical-invoice-lines.csv
outputs/master-validation-flags.csv
outputs/master-pipeline-run-summary.json
```

Expected demo result:

```text
Rows: 3
Line amount grand total USD: 2236.97
Total validation flags: 0
Has validation errors: false
```

---

## Notes

This repository is intentionally scoped as a public portfolio implementation.

Production deployments require:

```text
client-specific document families
real validation requirements
secure intake design
access control
environment-specific integration mapping
review workflow configuration
data retention rules
monitoring
maintenance
```

The public demo proves the architecture pattern without exposing private production implementation details.