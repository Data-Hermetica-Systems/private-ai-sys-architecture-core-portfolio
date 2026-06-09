# Power Platform Layer

## Purpose

This folder documents how the document automation pipeline connects to Microsoft Power Platform.

```text
extraction output
→ API contract
→ Power Automate flow
→ Dataverse records
→ Power Apps review console
→ approval and export workflow
```

## Components

| Component | Role |
|---|---|
| Dataverse | Stores runs, batches, lines, validation issues, rules, and review actions |
| Power Apps | Provides review screens for extracted rows and exceptions |
| Power Automate | Imports payloads, routes exceptions, sends approvals, and exports approved records |
| Custom connector | Calls the API described in `api/openapi.yaml` |
| Security roles | Separates service account, reviewer, manager, and admin permissions |
| ALM | Packages tables, apps, flows, connector references, and environment variables |

## Build Sequence

| Step | Build Item | Output |
|---:|---|---|
| 1 | Create Dataverse solution | Data Hermetica Document Automation |
| 2 | Create tables | Processing Run, Invoice Batch, Invoice Line, Validation Issue, Review Action, Vendor Rule |
| 3 | Create connector | Import `api/openapi.yaml` |
| 4 | Create import flow | API payload creates Dataverse rows |
| 5 | Create review app | Model-driven app with queue views and forms |
| 6 | Create approval flow | Approved records can export only after issues are closed |
| 7 | Create export flow | Send approved records to a downstream system or CSV/API output |
| 8 | Add security roles | Reviewer, automation service, admin |
| 9 | Add environment variables | API base URL, document storage path, notification channel |
| 10 | Package solution | Dev/test/prod deployment plan |

## Review Workflow

```text
processing run created
→ invoice batch created
→ invoice lines created
→ validation issues created
→ clean batch moves to approval
→ flagged batch moves to review
→ reviewer approves, corrects, rejects, escalates, or requests information
→ review action is stored
→ approved batch exports
```

## Flow Inventory

| Flow | Start | Main Work |
|---|---|---|
| Import Pipeline Payload | Manual, HTTP, scheduled, or file event | Call API, parse payload, create Dataverse rows |
| Route Validation Exceptions | Validation Issue row created | Assign reviewer, notify team, update batch status |
| Approve Invoice Batch | Review Action row created | Check unresolved issues, mark approved, write audit record |
| Export Approved Batch | Batch approved | Gather lines, create export package, send to downstream system |
| Daily Processing Summary | Scheduled | Count runs, issues, approvals, failures, and aging review items |

## Power Apps Review Console

Recommended navigation:

```text
Processing Runs
Invoice Batches
Invoice Lines
Validation Issues
Review Actions
Vendor Rules
```

Recommended views:

```text
Batches Needing Review
Batches Ready for Approval
Critical Validation Issues
Unresolved Validation Issues
Recently Processed Batches
Approved Batches Ready for Export
```

## Capabilities Demonstrated

- Dataverse table and relationship design
- Power Automate workflow architecture
- Custom connector planning from OpenAPI
- Human review and approval routing
- Exception handling before export
- Audit history through Review Action records
- ALM and environment-variable planning
