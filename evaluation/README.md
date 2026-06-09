# Evaluation Harness

## Purpose

This folder documents the evaluation layer for the public document automation portfolio.

The goal is to prove that the system does not only extract text. It checks whether extracted structured data is complete, mathematically consistent, and ready for workflow automation.

---

## Public Evaluation Script

Run:

```powershell
node src/evaluate-pipeline-output.js
```

The script reads:

```text
outputs/master-canonical-invoice-lines.json
```

and writes:

```text
outputs/pipeline-evaluation-report.json
```

---

## Current Metrics

| Metric | What It Checks | Why It Matters |
|---|---|---|
| Row count consistency | Metadata row count equals actual records length | Prevents missing or extra records |
| Required field completeness | Required canonical fields are present | Prevents unusable downstream rows |
| Line amount accuracy | Quantity times unit price equals line amount | Catches business-critical extraction errors |
| Grand total consistency | Metadata total equals sum of lines | Catches aggregation or output errors |

---

## Evaluation Output

The evaluation report contains:

```text
schema
generatedAt
demoRun
score
evaluations
recommendation
```

The score block contains:

```text
totalChecks
passedChecks
failedChecks
scorePercent
passed
```

---

## Why This Matters for AI Automation

A document AI system is not production-ready just because it returns structured JSON.

It must be evaluated against deterministic checks:

```text
required fields
math consistency
schema consistency
row count consistency
source-total reconciliation
review routing behavior
```

This is the difference between an AI demo and a workflow automation system that can be trusted enough to connect to Power Automate, Dataverse, review queues, and downstream business systems.

---

## Future Evaluation Additions

| Future Metric | Purpose |
|---|---|
| Expected-vs-actual field accuracy | Compare extracted fields against ground truth |
| Document-family classification accuracy | Measure layout/parser routing quality |
| Validation issue precision | Verify that flags are correct and useful |
| Validation issue recall | Verify that known problems are not missed |
| Review turnaround time | Measure human-in-the-loop efficiency |
| Automation rate | Percent of records routed without manual correction |
| Exception reason distribution | Identify which rules cause most review work |
| Cost per processed document | Track economic viability |
