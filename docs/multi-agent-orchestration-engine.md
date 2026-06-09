# Multi-Agent Orchestration Engine

## Purpose

This document describes the portfolio orchestration layer added above the extraction pipeline.

The original public demo proves the extraction and validation pipeline:

```text
synthetic OCR text
→ invoice item segmentation
→ canonical row extraction
→ validation
→ weight reconciliation
→ master JSON/CSV outputs
```

The orchestration layer proves the next job-relevant capability:

```text
validated document data
→ agentic workflow decomposition
→ routing decision
→ Power Platform payload
→ human review packet
→ audit log
```

---

## Design Principle

The system is not designed as an uncontrolled autonomous agent.

It uses a deterministic workflow shell with bounded agents that each perform one clear responsibility.

```text
Deterministic runner
+ named agents
+ explicit state object
+ validation gates
+ review routing
+ audit events
+ downstream payload generation
```

---

## Current Public Demo Agents

| Agent | Responsibility | Input | Output |
|---|---|---|---|
| Intake Agent | Reads generated extraction outputs and captures source/run metadata. | Master JSON and pipeline summary | Intake state and audit event |
| Validation Agent | Re-checks canonical line math and required product fields. | Canonical invoice rows | Validation state and issues |
| Routing Agent | Decides whether the result can move to workflow automation or review. | Validation state and source flags | Recommended next action |
| Power Platform Payload Agent | Builds payload shaped for Dataverse and Power Automate ingestion. | Canonical rows and routing state | `outputs/power-automate-payload.json` |
| Review Packet Agent | Builds human-readable review packet for Power Apps or reviewer handoff. | Validation and routing state | `outputs/human-review-packet.json` |
| Audit Agent | Writes event log of every orchestration step. | Accumulated audit events | `outputs/orchestration-audit-log.json` |

---

## State Object Pattern

The orchestrator passes a single state object between agents.

```text
state = {
  orchestrationRunId,
  status,
  basePipelineRun,
  intake,
  masterOutput,
  pipelineSummary,
  validation,
  routing,
  powerPlatformPayload,
  reviewPacket,
  auditEvents,
  auditLog
}
```

Each agent returns a new enriched state object.

This mirrors a production state-machine design where each node receives state, performs one bounded operation, appends audit metadata, and returns updated state.

---

## Generated Orchestration Outputs

Running:

```powershell
node src/run-orchestration-demo.js
```

creates:

```text
outputs/power-automate-payload.json
outputs/human-review-packet.json
outputs/orchestration-audit-log.json
outputs/orchestration-run-summary.json
```

---

## Power Automate Payload

The payload is designed as the body for a Power Automate HTTP trigger or custom connector action.

It contains:

```text
schema
orchestrationRunId
generatedAt
target system metadata
invoiceBatches
invoiceLines
validationIssues
routing decision
```

This payload can be mapped into Dataverse tables:

```text
Processing Run
Invoice Batch
Invoice Line
Validation Issue
Review Action
```

---

## Human Review Packet

The review packet is designed for a Power Apps screen or reviewer handoff.

It contains:

```text
review status
reviewer instructions
source document count
canonical line count
validation issue count
line amount grand total
issues
sample rows
```

This proves the distinction between extraction and reviewable business truth.

---

## Audit Log

Every agent adds an audit event.

Audit events include:

```text
timestamp
actorType
actor
action
details
```

The audit log supports regulated workflow design by preserving what happened, when it happened, and which bounded agent produced the result.

---

## Interview Explanation

Use this explanation:

```text
The repo has a base extraction pipeline and a second orchestration layer. The extraction pipeline turns invoice-style OCR text into validated canonical rows. The orchestration layer reads those outputs, runs bounded agents for intake, validation, routing, Power Platform payload generation, review packet creation, and audit logging. This demonstrates how I would connect document intelligence into Dataverse, Power Apps review queues, Power Automate approval flows, and downstream systems.
```

---

## Production Extension Path

| Public Demo Component | Production Equivalent |
|---|---|
| Local synthetic OCR text | Email, SharePoint, upload, API, or scanned PDF intake |
| Local JSON/CSV outputs | Dataverse records and file storage references |
| Validation agent | Rule engine plus JSON schema validation |
| Routing agent | Power Automate or queue-based state machine |
| Power Platform payload | Custom connector or Azure Function response |
| Review packet | Power Apps model-driven review form |
| Audit log JSON | Dataverse audit/event table plus platform logging |

---

## Safety Boundary for Public Portfolio

This public repository intentionally avoids:

```text
real client invoices
private source PDFs
private extraction rules
client-specific SOPs
credentials
production connector URLs
internal prompts
vendor-specific business rules
```

It keeps the architecture visible while keeping sensitive implementation details out of the public repo.
