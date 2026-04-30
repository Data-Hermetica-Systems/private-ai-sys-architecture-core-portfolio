# Architecture

## System Name

```text
Private Document Intelligence Pipeline for Logistics and Customs Invoice Automation
```

## Purpose

This project demonstrates a local-first private document intelligence pipeline for logistics, customs, commercial, and proforma invoice automation.

The system converts invoice PDFs into validated canonical invoice-line outputs using:

```text
local PDF rendering
local OCR
invoice-family parsing
canonical schema mapping
field normalization
validation rules
weight-total reconciliation
master JSON/CSV generation
```

The architecture is designed to serve as the local/private core for a future enterprise workflow using Dataverse, Power Automate, Power Apps, and ERP/customs/finance integrations.

---

## End-to-End Workflow

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
→ validation
→ reconciliation
→ master structured outputs
→ review flags
```

---

## Script Flow

```text
src/ocr-pdf-with-tesseract.js
→ src/segment-ocr-invoice-items.js
→ src/build-canonical-rows-from-segments.js
→ src/build-canonical-rows-for-special-families.js
→ src/reconcile-invoice-weight-totals.js
→ src/build-master-canonical-output.js
→ src/run-private-document-pipeline.js
```

---

## Main Runner

Main command:

```powershell
node src\run-private-document-pipeline.js
```

Runner steps:

```text
STEP 1: OCR PDF invoices with Tesseract
STEP 2: Segment OCR invoice items
STEP 3: Build deterministic canonical rows from segmented invoices
STEP 4: Build canonical rows for special invoice families
STEP 5: Reconcile invoice weight totals
STEP 6: Build master canonical JSON and CSV output
```

---

## Input Layer

Input documents are PDF invoices.

In a production system, sources could include:

```text
email attachments
shared folders
SFTP drops
Power Automate intake
manual upload
API submission
ERP export folders
```

Current local source folder:

```text
pdfs\
```

The public repository excludes source PDFs.

---

## PDF Rendering Layer

Script:

```text
src/ocr-pdf-with-tesseract.js
```

Tool:

```text
Poppler pdftoppm
```

Purpose:

```text
Convert each PDF page into image files for OCR processing.
```

Generated image folder:

```text
images\
```

This folder is generated locally and ignored by Git except for `.gitkeep`.

---

## OCR Layer

Script:

```text
src/ocr-pdf-with-tesseract.js
```

Tool:

```text
Tesseract OCR
```

Purpose:

```text
Convert rendered invoice page images into raw OCR text.
```

Generated OCR folder:

```text
ocr\
```

Example generated files:

```text
ocr\sample-commercial-invoice-001-tesseract-ocr.txt
ocr\tesseract-ocr-run-summary.json
```

The public repository excludes generated OCR output.

---

## Segmentation Layer

Script:

```text
src/segment-ocr-invoice-items.js
```

Purpose:

```text
Identify invoice line-item boundaries in OCR text.
```

For multiline invoices, a single logical item can span multiple OCR lines. The segmentation layer groups these related lines into item blocks before canonical field extraction.

Example segmented block content can include:

```text
line number
material number
quantity
unit price
line amount
description lines
commodity code
country of origin
delivery note
shipment number
net weight
gross weight
```

---

## Deterministic Canonical Row Builder

Script:

```text
src/build-canonical-rows-from-segments.js
```

Purpose:

```text
Convert segmented item blocks into normalized canonical invoice rows.
```

This layer handles structured invoice families where line patterns are predictable enough for deterministic extraction.

It outputs per-invoice JSON and CSV files.

---

## Special-Family Parser Layer

Script:

```text
src/build-canonical-rows-for-special-families.js
```

Purpose:

```text
Handle invoice layouts that do not follow the primary multiline invoice pattern.
```

Examples of special-family layouts:

```text
customs invoice with ISO tank rows
commercial invoice with KG-rate table structure
single-page international invoice layouts
```

The special-family parser allows each layout family to map into the same master canonical schema.

---

## Field Normalization Layer

Normalization examples:

```text
23,580 KG → 23.580
1.132,560 KG → 1132.560
2.495,934 KG → 2495.934
12.000 → 12
$40,000.00 → 40000
N/A for missing values
```

Purpose:

```text
Convert source-specific invoice formatting into consistent machine-readable values.
```

---

## Validation Layer

Validation checks include:

```text
row count validation
required column validation
missing field detection
duplicate line detection
line amount arithmetic checks
net/gross weight sanity checks
invoice total weight reconciliation
source validation flag carry-forward
```

The pipeline treats extraction and validation as separate layers.

A pipeline can extract all expected rows and still correctly produce validation flags if totals do not reconcile.

---

## Weight Reconciliation Layer

Script:

```text
src/reconcile-invoice-weight-totals.js
```

Purpose:

```text
Compare line-item net/gross weights against invoice bottom total net/gross weights.
```

This layer is designed to catch:

```text
European decimal comma conversion issues
European thousands-dot conversion issues
ambiguous dot-only values
missing line-level weights
OCR/table extraction misses
invoice-level inconsistencies
```

Important rule:

```text
The system does not invent fake line weights to force totals.
If totals cannot be reconciled after valid candidate repairs, it emits validation flags.
```

---

## Master Output Layer

Script:

```text
src/build-master-canonical-output.js
```

Purpose:

```text
Combine all individual invoice outputs into one master JSON file and one master CSV file.
```

Generated files:

```text
outputs\master-canonical-invoice-lines.json
outputs\master-canonical-invoice-lines.csv
outputs\master-validation-flags.csv
```

The master validation flags file is designed to support human review workflows and downstream exception processing.

---

## Master Pipeline Summary

Script:

```text
src/run-private-document-pipeline.js
```

Generated file:

```text
outputs\master-pipeline-run-summary.json
```

Purpose:

```text
Summarize the full pipeline run, including step results, runtime, row counts, validation counts, reconciliation status, and generated output files.
```

---

## Canonical Schema

Master output columns:

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

## Current Verified Benchmark

```text
5 invoice PDFs
3 invoice families
58 expected rows
58 extracted rows
343420.71 USD line amount grand total
3 weight reconciliation jobs
5 source validation flags carried forward
master validation flags CSV created
```

Interpretation:

```text
The extraction pipeline is structurally successful.
The validation layer correctly reports unresolved reconciliation mismatches.
```

---

## Future Target Architecture

```text
PDF / Image / Email
→ local rendering
→ OCR
→ layout and table extraction
→ invoice-family detection
→ deterministic canonical extraction
→ validation
→ weight-total reconciliation
→ RAG vendor rule retrieval
→ local AI fallback for ambiguity
→ final schema enforcement
→ Dataverse
→ Power Automate approval flow
→ Power Apps exception review
→ ERP/customs/finance integration
```

---

## Local AI Extension Points

The architecture can support local AI fallback layers for difficult cases, such as:

```text
layout ambiguity
damaged OCR text
unusual invoice families
field alias mapping
vendor-specific rule interpretation
exception explanation
human review support
```

Possible extension components:

```text
Qwen
local embeddings
RAG
private inference
vendor rule retrieval
schema-guided extraction
```

The deterministic validation layer remains the final authority for arithmetic, required fields, and reconciliation status.