# Power Platform Extension Design

## Purpose

This document describes the planned Power Platform extension for the local document intelligence pipeline.

The local pipeline produces structured invoice outputs:

```text
outputs\master-canonical-invoice-lines.csv
outputs\master-validation-flags.csv
outputs\master-pipeline-run-summary.json
```

The Power Platform layer should import, review, route, and approve these outputs using:

```text
Dataverse
Power Apps
Power Automate
Power BI or dashboard views
```

---

## Target Workflow

```text
Local invoice pipeline run completes
→ master CSV generated
→ validation flags CSV generated
→ Dataverse import or ingestion flow
→ Invoice Batch record created
→ Invoice Line records created
→ Validation Issue records created
→ Power Apps review console displays batch
→ reviewer resolves issues
→ Power Automate routes approval/export
→ downstream ERP/customs/finance integration
```

---

## Core Dataverse Tables

Recommended tables:

```text
Invoice Batch
Invoice Line
Validation Issue
Processing Run
Vendor Rule
Review Action
```

---

## Table 1: Invoice Batch

Purpose:

```text
Represents one processed invoice or invoice processing batch.
```

Recommended columns:

```text
Batch ID
Invoice Number
Invoice Date
Source File
Invoice Family
Source Parser
Shipment Number
Total Line Amount USD
Net Weight Total KG
Gross Weight Total KG
Row Count
Validation Flag Count
Processing Status
Created On
Processed On
Reviewed On
Approved On
Reviewer
Export Status
```

Recommended choices for `Processing Status`:

```text
New
Extracted
Validation Failed
Needs Review
In Review
Approved
Rejected
Exported
Archived
```

---

## Table 2: Invoice Line

Purpose:

```text
Stores normalized canonical line-item rows.
```

Recommended columns:

```text
Invoice Batch lookup
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
ShipmentNumber
OrderNumber
NetWeightKG
GrossWeightKG
ReviewStatus
ReviewerNote
CorrectedProductNumber
CorrectedQuantity
CorrectedUnitPriceUSD
CorrectedLineAmountUSD
CorrectedNetWeightKG
CorrectedGrossWeightKG
```

Recommended choices for `ReviewStatus`:

```text
Not Required
Needs Review
Reviewed
Corrected
Accepted
Rejected
```

---

## Table 3: Validation Issue

Purpose:

```text
Stores validation flags from the local pipeline.
```

Recommended columns:

```text
Invoice Batch lookup
Invoice Line lookup
Source File
Source Parser
Invoice Family
Invoice Number
Invoice Date
Shipment Number
Field
Row
Severity
Issue
Resolved
Resolution Note
Resolved By
Resolved On
```

Recommended choices for `Severity`:

```text
Info
Warning
Error
Critical
```

Recommended choices for `Resolved`:

```text
No
Yes
Not Applicable
```

---

## Table 4: Processing Run

Purpose:

```text
Stores metadata about each pipeline execution.
```

Recommended columns:

```text
Run ID
Pipeline Version
Started At
Finished At
DurationMs
PDF Job Count
Segmentation Job Count
Canonical Job Count
Weight Reconciliation Job Count
Expected Rows
Extracted Rows
Source Validation Flags
Master Validation Flags
Total Validation Flags
Has Validation Errors
All Row Counts Matched
All Validation Clear
Status
Error Message
```

Recommended choices for `Status`:

```text
Completed
Completed With Flags
Failed
Partially Completed
```

---

## Table 5: Vendor Rule

Purpose:

```text
Stores vendor-specific, invoice-family-specific, or document-family-specific parsing and review rules.
```

Recommended columns:

```text
Vendor Name
Invoice Family
Field Target
Rule Type
Rule Text
Priority
Effective Date
Expiration Date
Active
Created By
Approved By
```

Recommended choices for `Rule Type`:

```text
Field Mapping
Validation
Normalization
Review Instruction
Exception Handling
Export Mapping
```

---

## Table 6: Review Action

Purpose:

```text
Stores reviewer actions and audit history.
```

Recommended columns:

```text
Invoice Batch lookup
Invoice Line lookup
Validation Issue lookup
Action Type
Field Changed
Previous Value
New Value
Reviewer
Review Timestamp
Review Note
```

Recommended choices for `Action Type`:

```text
Accepted
Corrected
Rejected
Flag Resolved
Flag Reopened
Batch Approved
Batch Rejected
Exported
```

---

## Import Mapping

The file:

```text
outputs\master-canonical-invoice-lines.csv
```

maps primarily to:

```text
Invoice Batch
Invoice Line
```

The file:

```text
outputs\master-validation-flags.csv
```

maps primarily to:

```text
Validation Issue
```

The file:

```text
outputs\master-pipeline-run-summary.json
```

maps primarily to:

```text
Processing Run
```

---

## Power Automate Flow 1: Import Pipeline Outputs

Trigger options:

```text
manual button
file created in folder
file uploaded to SharePoint
scheduled run
HTTP request
```

Flow outline:

```text
Trigger
→ read master pipeline summary
→ create Processing Run row
→ read master canonical CSV
→ create Invoice Batch rows
→ create Invoice Line rows
→ read master validation flags CSV
→ create Validation Issue rows
→ update batch status
```

Status logic:

```text
If Total Validation Flags = 0:
    Processing Status = Extracted

If Total Validation Flags > 0:
    Processing Status = Needs Review
```

---

## Power Automate Flow 2: Exception Review Routing

Trigger:

```text
When Validation Issue row is created
```

Flow outline:

```text
If Severity = Error or Critical
→ assign reviewer
→ send notification
→ create review task
→ update Invoice Batch status to Needs Review
```

Possible notification targets:

```text
email
Teams
Power Apps notification
Planner task
Dataverse queue
```

---

## Power Automate Flow 3: Approval and Export

Trigger:

```text
When Invoice Batch status changes to Approved
```

Flow outline:

```text
Get Invoice Batch
→ get related Invoice Lines
→ get unresolved Validation Issues
→ if unresolved issues exist, block export
→ if no unresolved issues, generate export package
→ send to ERP/customs/finance destination
→ update Export Status
```

---

## Power Apps Model-Driven App

Recommended navigation:

```text
Processing Runs
Invoice Batches
Invoice Lines
Validation Issues
Vendor Rules
Review Actions
```

Recommended Invoice Batch form tabs:

```text
Summary
Invoice Lines
Validation Issues
Review Actions
Export Status
```

Recommended views:

```text
Batches Needing Review
Batches Ready for Export
Critical Validation Issues
Unresolved Weight Reconciliation Issues
Recently Processed Batches
Vendor Rule Library
```

---

## Human Review Queue

Validation flags should become review work.

Example review queue columns:

```text
Invoice Number
Invoice Date
Invoice Family
Shipment Number
Severity
Field
Row
Issue
Assigned Reviewer
Resolved
```

This allows document automation to preserve accuracy while still reducing manual work.

---

## Future RAG and Local AI Extension

The Power Platform layer can later call a private reasoning service for:

```text
vendor rule lookup
field alias explanation
review recommendation
exception explanation
document family suggestion
mapping suggestions
```

Possible private AI architecture:

```text
Dataverse Validation Issue
→ retrieve vendor rules with embeddings
→ pass relevant rules to local model
→ generate suggested correction or review note
→ reviewer approves or rejects
→ deterministic system records final value
```

Important rule:

```text
AI suggestions should not silently overwrite validated business records.
Human approval or deterministic validation should control final output.
```

---

## Production Readiness Checklist

```text
Dataverse tables created
CSV import mapping tested
Validation flags imported correctly
Review queue works
Approval flow blocks unresolved errors
Export flow only runs after approval
Audit trail captures corrections
Vendor rules are versioned
Pipeline run summary is stored
Private data remains local or controlled
```