# Dataverse Schema

## Purpose

This schema turns extracted invoice data into a Power Platform data model that can support review queues, exception routing, approvals, audit history, analytics, and downstream Power Automate flows.

The public demo writes JSON and CSV locally. The Power Platform extension maps those same outputs into Dataverse tables.

---

## Entity Relationship Model

```text
Processing Run 1 -> many Invoice Batches
Invoice Batch 1 -> many Invoice Lines
Invoice Batch 1 -> many Validation Issues
Invoice Line 1 -> many Validation Issues
Invoice Batch 1 -> many Review Actions
Vendor Rule 1 -> many Invoice Batches
Document Family Rule 1 -> many Invoice Batches
```

---

## Table 1: Processing Run

Logical purpose: one execution of the extraction and validation pipeline.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| ProcessingRunId | Autonumber/Text | Yes | RUN-20260608-0001 | Primary run identifier |
| RunStatus | Choice | Yes | Completed | New, Running, Completed, Failed, Needs Review |
| PipelineVersion | Text | Yes | demo-v1 | Version of the pipeline logic |
| StartedAt | DateTime | Yes | 2026-06-08T09:00:00Z | Run start time |
| FinishedAt | DateTime | No | 2026-06-08T09:00:06Z | Run finish time |
| SourceType | Choice | Yes | Local Demo | Email, SharePoint, Upload, API, Local Demo |
| SourceLocation | Text | No | ocr/synthetic-commercial-invoice-001-ocr.txt | Original source path or reference |
| TotalInvoiceCount | Whole Number | Yes | 1 | Count of invoices processed |
| TotalLineCount | Whole Number | Yes | 3 | Count of invoice lines processed |
| TotalValidationIssueCount | Whole Number | Yes | 0 | Count of validation issues |
| HasValidationErrors | Yes/No | Yes | No | Fast filter for exception queue |
| RunSummaryJson | Multiline Text | No | {...} | Optional raw summary payload |

---

## Table 2: Invoice Batch

Logical purpose: one invoice document or invoice packet processed by the pipeline.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| InvoiceBatchId | Autonumber/Text | Yes | INV-BATCH-000001 | Primary batch identifier |
| ProcessingRun | Lookup | Yes | RUN-20260608-0001 | Parent run |
| InvoiceNumber | Text | Yes | CI-2026-001 | Source invoice number |
| InvoiceDate | Date Only | No | 2026-06-08 | Source invoice date |
| ShipmentNumber | Text | No | SHP-7000332022 | Shipment reference |
| InvoiceFamily | Text | Yes | generalized-commercial-invoice | Parser/document family |
| VendorName | Text | No | Synthetic Vendor LLC | Vendor or shipper |
| SourceInvoiceFile | Text | Yes | synthetic-commercial-invoice-001 | Source file name or document id |
| ExtractedLineCount | Whole Number | Yes | 3 | Number of rows extracted |
| ExpectedLineCount | Whole Number | No | 3 | Expected count if known |
| LineAmountGrandTotalUSD | Currency | No | 2236.97 | Sum of line amounts |
| NetWeightGrandTotalKG | Decimal | No | 2495.934 | Sum or declared total net weight |
| GrossWeightGrandTotalKG | Decimal | No | 2680.000 | Sum or declared total gross weight |
| BatchStatus | Choice | Yes | Ready For Review | Extracted, Validated, Needs Review, Approved, Rejected, Posted |
| RequiresHumanReview | Yes/No | Yes | No | Review queue flag |

---

## Table 3: Invoice Line

Logical purpose: one normalized line item from the invoice.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| InvoiceLineId | Autonumber/Text | Yes | INV-LINE-000001 | Primary line identifier |
| InvoiceBatch | Lookup | Yes | INV-BATCH-000001 | Parent invoice batch |
| SourceInvoiceFile | Text | Yes | synthetic-commercial-invoice-001 | Source traceability |
| SourceParser | Text | Yes | demo-generalized-parser | Parser used |
| InvoiceNumber | Text | Yes | CI-2026-001 | Denormalized fast filter |
| ShipmentNumber | Text | No | SHP-7000332022 | Shipment reference |
| LineNo | Whole Number | Yes | 10 | Source line number |
| ProductNumber | Text | Yes | ABC-100 | Product/material number |
| Description | Multiline Text | No | Synthetic product line | Source description |
| Unit | Text | No | EA | Unit of measure |
| Quantity | Decimal | Yes | 3 | Normalized quantity |
| UnitPriceUSD | Currency | Yes | 25.00 | Normalized unit price |
| LineAmountUSD | Currency | Yes | 75.00 | Normalized line amount |
| ExpectedLineAmountUSD | Currency | No | 75.00 | Calculated quantity times price |
| CommodityCode | Text | No | 0000.00.0000 | Commodity or HTS field if provided |
| CountryOfOrigin | Text | No | US | Country of origin |
| DeliveryNote | Text | No | DN-100 | Delivery note reference |
| OrderNumber | Text | No | PO-100 | Purchase order or sales order |
| NetWeightKG | Decimal | No | 23.580 | Line net weight |
| GrossWeightKG | Decimal | No | 25.000 | Line gross weight |
| LineValidationStatus | Choice | Yes | Valid | Valid, Warning, Error, Needs Review |

---

## Table 4: Validation Issue

Logical purpose: every deterministic validation flag emitted by the pipeline.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| ValidationIssueId | Autonumber/Text | Yes | VAL-000001 | Primary issue identifier |
| ProcessingRun | Lookup | Yes | RUN-20260608-0001 | Parent run |
| InvoiceBatch | Lookup | Yes | INV-BATCH-000001 | Parent batch |
| InvoiceLine | Lookup | No | INV-LINE-000001 | Related line when line-specific |
| Severity | Choice | Yes | Error | Info, Warning, Error, Critical |
| RuleId | Text | Yes | LINE_AMOUNT_MISMATCH | Stable validation rule id |
| RuleName | Text | Yes | Quantity times unit price mismatch | Human-readable rule name |
| FieldName | Text | No | LineAmountUSD | Affected field |
| ExpectedValue | Text | No | 75.00 | Expected value |
| ActualValue | Text | No | 55.00 | Extracted/source value |
| Message | Multiline Text | Yes | Calculated line amount does not match source amount. | Review explanation |
| RequiresHumanReview | Yes/No | Yes | Yes | Routes to review queue |
| IssueStatus | Choice | Yes | Open | Open, Accepted, Corrected, Rejected, Closed |

---

## Table 5: Review Action

Logical purpose: human-in-the-loop review events.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| ReviewActionId | Autonumber/Text | Yes | REV-000001 | Primary action identifier |
| InvoiceBatch | Lookup | Yes | INV-BATCH-000001 | Batch reviewed |
| ValidationIssue | Lookup | No | VAL-000001 | Specific issue reviewed |
| Reviewer | User | Yes | reviewer@company.com | Person who reviewed |
| ReviewActionType | Choice | Yes | Approve | Approve, Reject, Correct, Escalate, Request Info |
| OldValue | Text | No | 55.00 | Before correction |
| NewValue | Text | No | 50.00 | After correction |
| ReviewNotes | Multiline Text | No | Source document confirms corrected value. | Explanation |
| ReviewedAt | DateTime | Yes | 2026-06-08T09:05:00Z | Action time |

---

## Table 6: Vendor Rule

Logical purpose: configurable extraction and validation rules per vendor, shipper, customer, or document family.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| VendorRuleId | Autonumber/Text | Yes | VR-000001 | Primary rule identifier |
| VendorName | Text | Yes | Synthetic Vendor LLC | Vendor/shipper/customer |
| RuleStatus | Choice | Yes | Active | Active, Inactive, Draft |
| AppliesToInvoiceFamily | Text | No | generalized-commercial-invoice | Scope |
| RuleType | Choice | Yes | Validation | Extraction, Validation, Routing, Review |
| RuleName | Text | Yes | Require country of origin | Human-readable rule name |
| RuleExpression | Multiline Text | Yes | CountryOfOrigin must not be blank | Public-safe expression |
| HumanReviewRequiredOnFailure | Yes/No | Yes | Yes | Exception routing behavior |

---

## Table 7: Document Family Rule

Logical purpose: recognizes and routes different invoice/document layouts.

| Column | Type | Required | Example | Purpose |
|---|---|---:|---|---|
| DocumentFamilyRuleId | Autonumber/Text | Yes | DFR-000001 | Primary identifier |
| FamilyName | Text | Yes | generalized-commercial-invoice | Parser family |
| RuleStatus | Choice | Yes | Active | Active, Inactive, Draft |
| DetectionSignals | Multiline Text | Yes | invoice number; shipment number; item; quantity; unit price | Public-safe detection signals |
| RequiredFields | Multiline Text | Yes | InvoiceNumber, LineNo, ProductNumber, Quantity, UnitPriceUSD | Required schema |
| ParserName | Text | Yes | demo-generalized-parser | Parser module name |
| FallbackParserName | Text | No | review-required-parser | Fallback route |

---

## Review Queue View

Recommended Dataverse view for Power Apps:

| View Column | Purpose |
|---|---|
| InvoiceBatchId | Open the case |
| InvoiceNumber | Identify invoice |
| ShipmentNumber | Identify shipment |
| VendorName | Prioritize by source |
| ExtractedLineCount | See extraction scope |
| TotalValidationIssueCount | See error volume |
| RequiresHumanReview | Queue filter |
| BatchStatus | Work state |
| CreatedOn | Aging |

---

## Power Automate Trigger Points

| Trigger | Dataverse Event | Flow Purpose |
|---|---|---|
| New Processing Run created | Processing Run row added | Start monitoring and notify owner |
| Invoice Batch requires review | Invoice Batch updated | Create approval or Teams notification |
| Critical Validation Issue created | Validation Issue row added | Escalate immediately |
| Review Action approved | Review Action row added | Export approved data or call downstream API |
| Batch status posted | Invoice Batch updated | Archive case and write audit summary |

---

## Implementation Notes

- Use alternate keys for InvoiceNumber plus SourceInvoiceFile where possible.
- Keep extracted values separate from reviewer-corrected values when moving beyond the public demo.
- Use security roles to separate pipeline service accounts, reviewers, and administrators.
- Store large source documents in SharePoint or Blob storage, then store references in Dataverse.
- Keep validation issues as first-class records, not just text in a notes field.
