# Portfolio Summary

## Project Title

```text
Private Document Intelligence Pipeline for Logistics and Customs Invoice Automation
```

## Short Portfolio Description

Built a local-first document intelligence pipeline that extracts structured line-item data from logistics and customs invoice PDFs into canonical JSON and CSV outputs.

The system uses OCR, deterministic parsing, invoice-family-specific extraction, schema normalization, validation rules, and invoice-level weight reconciliation to prepare invoice data for downstream automation.

---

## Resume Summary

```text
Built a local private document intelligence pipeline for logistics and customs invoices using Node.js, Poppler, Tesseract OCR, deterministic segmentation, invoice-family-specific parsers, canonical JSON/CSV generation, validation logic, and invoice-level weight reconciliation. The pipeline processes multiple invoice formats locally and generates Excel-ready master outputs with validation flags for review.
```

---

## Strong Resume Bullet

```text
Built a local-first invoice automation pipeline that processed 5 logistics/customs PDF invoices across 3 invoice families into 58 canonical line items, generating per-invoice and master JSON/CSV outputs with row-count validation, arithmetic checks, field normalization, and invoice-level weight reconciliation.
```

---

## Recruiter-Friendly Description

This project demonstrates applied automation architecture for document-heavy business operations.

It converts semi-structured invoice PDFs into standardized machine-readable records that can be reviewed, validated, and integrated into operational systems.

The project shows practical capability in:

```text
document automation
OCR pipelines
data normalization
invoice parsing
schema design
validation logic
exception handling
local-first processing
Power Platform integration planning
```

---

## Business Problem

Many logistics, customs, and finance workflows still rely on manual PDF review and spreadsheet entry.

Common problems include:

```text
manual line-item extraction
copy/paste errors
inconsistent vendor invoice formats
missing weights or identifiers
incorrect unit conversions
hard-to-audit spreadsheet edits
slow exception handling
lack of structured review workflow
```

This project addresses those problems by creating a repeatable extraction and validation pipeline.

---

## Technical Problem

PDF invoices are not clean databases.

They contain:

```text
multi-page line items
OCR artifacts
European number formats
mixed quantity and weight fields
vendor-specific layouts
line descriptions spread across multiple rows
special invoice families
ambiguous decimal/thousand separators
invoice totals that must reconcile with line-level fields
```

The system handles these problems through layered processing rather than a single extraction step.

---

## Architecture Skills Demonstrated

```text
local-first system design
Node.js file-processing orchestration
OCR integration
PDF rendering pipeline
invoice-family detection
deterministic parsing
schema normalization
CSV/JSON output generation
data validation
numeric normalization
weight reconciliation
exception reporting
Git/GitHub project hygiene
Power Platform integration planning
```

---

## Current Verified Results

```text
5 invoice PDFs processed
3 invoice families handled
58 expected canonical rows
58 extracted canonical rows
343420.71 USD line amount grand total
3 weight reconciliation jobs
5 source validation flags carried into master output
master JSON output generated
master CSV output generated
master validation flags CSV generated
```

---

## Why Validation Flags Matter

A weaker extraction system tries to make output look clean.

This project separates:

```text
successful extraction
from
verified source truth
```

That means the system can say:

```text
All rows were extracted.
Some invoice-level totals do not reconcile.
These issues require review.
```

This is closer to production behavior because real document automation must preserve uncertainty and route exceptions instead of hiding them.

---

## Portfolio Screenshot Ideas

Recommended screenshots:

```text
VS Code project structure
terminal full pipeline run
master CSV opened in Excel
master-validation-flags.csv opened in Excel
architecture diagram
sample sanitized input OCR
sample canonical JSON row
GitHub repository README
```

---

## Public Demo Framing

A strong demo narrative:

```text
1. Start with a PDF invoice.
2. Run the local pipeline.
3. Show OCR and segmentation.
4. Show canonical extracted rows.
5. Show master CSV.
6. Show validation flags.
7. Explain how flags become human review tasks.
8. Explain the future Dataverse/Power Automate layer.
```

---

## Professional Positioning

This project can be described as:

```text
private AI systems architecture
document intelligence automation
logistics invoice extraction
customs invoice processing
validation-first automation
Power Platform-ready document pipeline
local-first data processing
```

---

## Future Portfolio Extensions

Recommended next extensions:

```text
Dataverse table schema
Power Apps review console
Power Automate exception workflow
sanitized demo dataset
architecture diagram
unit/regression tests
local AI fallback layer
RAG vendor rules
human-in-the-loop review dashboard
```