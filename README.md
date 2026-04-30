# Private Document Intelligence Pipeline for Logistics and Customs Invoice Automation

## Project Summary

This repository demonstrates a local-first document intelligence architecture for logistics, customs, commercial, and proforma invoice automation.

The system converts semi-structured PDF invoice data into canonical JSON and CSV outputs using local OCR, deterministic invoice-family parsers, schema normalization, validation rules, and invoice-level reconciliation.

The project is designed as a private AI systems architecture core that can support downstream integration with Dataverse, Power Automate, Power Apps, ERP systems, customs workflows, and finance operations.

---

## Problem Solved

Logistics and customs invoice workflows often require manual extraction of repeated line-item data from PDFs, including:

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

Manual extraction is slow, error-prone, and difficult to validate at scale.

This project demonstrates how to build a local processing pipeline that:

```text
1. Converts invoices to images.
2. Runs OCR locally.
3. Detects invoice-family structure.
4. Extracts canonical invoice rows.
5. Normalizes field values.
6. Validates arithmetic and required fields.
7. Reconciles line-item weights against invoice totals.
8. Produces master JSON and CSV outputs.
9. Produces validation flags for human review.
```

---

## Current Pipeline

```text
PDF invoices
→ Poppler page rendering
→ Tesseract OCR
→ OCR text output
→ invoice-family recognition
→ item segmentation
→ header metadata extraction
→ deterministic canonical row building
→ special-family parsing
→ field normalization
→ validation
→ weight-total reconciliation
→ individual JSON output
→ individual CSV output
→ master JSON output
→ master CSV output
→ master validation flags CSV
→ master pipeline summary
```

Short form:

```text
PDFs
→ OCR
→ segmentation
→ canonical row extraction
→ special-family parsing
→ weight-total reconciliation
→ master JSON/CSV output
→ validation flags
→ review-ready structured data
```

---

## Current Verified Results

The current local benchmark processes:

```text
5 invoice PDFs
3 invoice families
58 expected canonical rows
58 extracted canonical rows
343420.71 USD line amount grand total
3 weight reconciliation jobs
5 source validation flags carried into the master output
```

Latest verified run behavior:

```text
Pipeline status: completed
Canonical jobs: 5
Weight reconciliation jobs: 3
Expected rows: 58
Extracted rows: 58
All row counts matched: true
Master validation flags CSV created: true
Weight reconciliation summary created: true
```

Important interpretation:

```text
Extraction success and reconciliation truth are separate.

The system can extract all expected rows while still correctly reporting unresolved invoice-level weight mismatches for review.
```

---

## Why This Architecture Matters

A basic OCR script only extracts text.

A production-grade document intelligence pipeline needs more:

```text
OCR
+ layout-aware parsing
+ invoice-family detection
+ canonical schema mapping
+ deterministic validation
+ reconciliation against source totals
+ review flags
+ downstream automation integration
```

This repository focuses on the architectural core needed for real business automation:

```text
private processing
repeatable parsing
schema-guided outputs
reconciliation checks
human review queue support
Power Platform integration readiness
```

---

## Technology Stack

```text
Node.js
PowerShell
Poppler pdftoppm
Tesseract OCR
JSON
CSV
Git/GitHub
Windows 11 local development
```

Planned/extendable architecture:

```text
Dataverse
Power Automate
Power Apps
local AI fallback
Qwen
RAG
embeddings
private inference
human review workflows
ERP/customs/finance integration
```

---

## Main Scripts

```text
src/ocr-pdf-with-tesseract.js
src/segment-ocr-invoice-items.js
src/build-canonical-rows-from-segments.js
src/build-canonical-rows-for-special-families.js
src/reconcile-invoice-weight-totals.js
src/build-master-canonical-output.js
src/run-private-document-pipeline.js
```

---

## Main Command

```powershell
cd H:\DataHermetica\private-ai-sys-architecture-core-portfolio
node src\run-private-document-pipeline.js
```

Expected runner steps:

```text
STEP 1: OCR PDF invoices with Tesseract
STEP 2: Segment OCR invoice items
STEP 3: Build deterministic canonical rows from segmented invoices
STEP 4: Build canonical rows for special invoice families
STEP 5: Reconcile invoice weight totals
STEP 6: Build master canonical JSON and CSV output
```

---

## Important Outputs

Generated locally:

```text
outputs\master-canonical-invoice-lines.json
outputs\master-canonical-invoice-lines.csv
outputs\master-validation-flags.csv
outputs\master-pipeline-run-summary.json
outputs\weight-reconciliation-summary.json
```

These files are generated outputs and are not committed to the public repository.

---

## Canonical Output Schema

Master canonical row fields:

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

---

## Validation Model

The pipeline validates:

```text
Expected row count
Required columns
Missing product numbers
Missing line numbers
Missing quantities
Missing unit prices
Missing line amounts
Duplicate line numbers
Quantity × UnitPriceUSD versus LineAmountUSD
NetWeightKG greater than GrossWeightKG
Invoice bottom Total Net weight versus sum(line NetWeightKG)
Invoice bottom Total Gross weight versus sum(line GrossWeightKG)
Source validation flags carried forward into master output
```

---

## Weight Reconciliation

The system includes invoice-level weight reconciliation.

Example numeric normalization rules:

```text
23,580 KG → 23.580 KG
2.495,934 KG → 2495.934 KG
2.268 KG → ambiguous: 2.268 KG or 2268 KG
```

Ambiguous values are only corrected when invoice totals prove the correction.

The system does not invent fake line weights to force totals. If line-item totals do not reconcile with invoice bottom totals, the system emits validation flags for review.

---

## Repository Structure

```text
private-ai-sys-architecture-core-portfolio
├── README.md
├── CHANGELOG.md
├── package.json
├── .gitignore
├── docs
│   ├── architecture.md
│   ├── validation-rules.md
│   ├── weight-reconciliation.md
│   ├── portfolio-summary.md
│   └── power-platform-extension.md
├── src
│   ├── ocr-pdf-with-tesseract.js
│   ├── segment-ocr-invoice-items.js
│   ├── build-canonical-rows-from-segments.js
│   ├── build-canonical-rows-for-special-families.js
│   ├── reconcile-invoice-weight-totals.js
│   ├── build-master-canonical-output.js
│   └── run-private-document-pipeline.js
├── samples
│   ├── sanitized-commercial-invoice-001-clean.txt
│   └── sanitized-commercial-invoice-001-raw-ocr.txt
├── expected
│   └── sanitized-commercial-invoice-001-ground-truth.json
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
generated OCR text
generated page images
generated outputs
private business notes
internal workbench files
```

It includes:

```text
system architecture
source code
sanitized samples
validation model
weight reconciliation design
Power Platform extension design
```

---

## Roadmap

Next planned layers:

```text
1. Add sanitized generated example outputs.
2. Add architecture diagram.
3. Add Dataverse table schema.
4. Add Power Automate approval workflow design.
5. Add Power Apps review console design.
6. Add expected-value regression fixtures.
7. Add local AI fallback layer for unresolved extraction ambiguity.
8. Add RAG-based vendor rule lookup.
```

---

## Portfolio Positioning

This project demonstrates:

```text
local document automation
private AI systems architecture
OCR pipeline design
schema-guided extraction
deterministic validation
invoice reconciliation
Power Platform integration readiness
logistics/customs workflow automation
```