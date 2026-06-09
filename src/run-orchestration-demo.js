const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputsDir = path.join(projectRoot, "outputs");

const orchestrationRunId = `ORCH-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readJson(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required file does not exist: ${relativePath}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(relativePath, value) {
  const fullPath = path.join(projectRoot, relativePath);
  ensureDirectoryExists(path.dirname(fullPath));
  fs.writeFileSync(fullPath, JSON.stringify(value, null, 2), "utf8");
}

function runBasePipelineIfNeeded() {
  const masterOutputPath = path.join(outputsDir, "master-canonical-invoice-lines.json");

  if (fs.existsSync(masterOutputPath)) {
    return {
      status: "skipped",
      reason: "Existing master output found"
    };
  }

  const result = spawnSync(process.execPath, [path.join(projectRoot, "src", "run-demo-pipeline.js")], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
    windowsHide: false
  });

  if (result.error) {
    throw new Error(`Base pipeline failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Base pipeline exited with code ${result.status}`);
  }

  return {
    status: "completed",
    reason: "Base pipeline was generated before orchestration"
  };
}

function intakeAgent(state) {
  const masterOutput = readJson(path.join("outputs", "master-canonical-invoice-lines.json"));
  const pipelineSummary = readJson(path.join("outputs", "master-pipeline-run-summary.json"));

  return {
    ...state,
    intake: {
      sourceType: "local_public_demo",
      sourceDocumentCount: masterOutput.metadata.invoiceCount,
      canonicalLineCount: masterOutput.metadata.rowCount,
      sourceFiles: masterOutput.records.map((record) => record.SourceInvoiceFile),
      pipelineSummaryPath: path.join("outputs", "master-pipeline-run-summary.json")
    },
    masterOutput,
    pipelineSummary,
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent("intake_agent", "captured_pipeline_outputs", {
        rowCount: masterOutput.metadata.rowCount,
        validationFlagCount: masterOutput.metadata.totalValidationFlagCount
      })
    ]
  };
}

function validationAgent(state) {
  const validationIssues = [];

  for (const record of state.masterOutput.records) {
    const expectedAmount = Number((record.Quantity * record.UnitPriceUSD).toFixed(2));
    const actualAmount = Number(record.LineAmountUSD.toFixed(2));

    if (expectedAmount !== actualAmount) {
      validationIssues.push({
        severity: "error",
        ruleId: "LINE_AMOUNT_MISMATCH",
        field: "LineAmountUSD",
        lineNo: record.LineNo,
        productNumber: record.ProductNumber,
        expectedValue: expectedAmount,
        actualValue: actualAmount,
        message: "Quantity multiplied by UnitPriceUSD does not equal LineAmountUSD.",
        requiresHumanReview: true
      });
    }

    if (!record.ProductNumber) {
      validationIssues.push({
        severity: "error",
        ruleId: "MISSING_PRODUCT_NUMBER",
        field: "ProductNumber",
        lineNo: record.LineNo,
        productNumber: record.ProductNumber,
        expectedValue: "non-empty product number",
        actualValue: record.ProductNumber,
        message: "Product number is required for downstream invoice automation.",
        requiresHumanReview: true
      });
    }
  }

  const hasValidationErrors = validationIssues.some((issue) => issue.severity === "error" || issue.severity === "critical");

  return {
    ...state,
    validation: {
      status: hasValidationErrors ? "failed" : "passed",
      issueCount: validationIssues.length,
      hasValidationErrors,
      issues: validationIssues
    },
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent("validation_agent", "evaluated_canonical_rows", {
        issueCount: validationIssues.length,
        hasValidationErrors
      })
    ]
  };
}

function routingAgent(state) {
  const requiresHumanReview = state.validation.hasValidationErrors || state.masterOutput.metadata.totalValidationFlagCount > 0;
  const recommendedAction = requiresHumanReview ? "create_review_case" : "prepare_power_automate_payload";

  return {
    ...state,
    routing: {
      requiresHumanReview,
      recommendedAction,
      destination: requiresHumanReview ? "Power Apps review queue" : "Power Automate custom connector",
      reason: requiresHumanReview
        ? "Validation or reconciliation issues require reviewer approval before downstream posting."
        : "No validation issues were found in the public demo output. Data is ready for downstream automation."
    },
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent("routing_agent", "selected_next_workflow_step", {
        recommendedAction,
        requiresHumanReview
      })
    ]
  };
}

function powerPlatformPayloadAgent(state) {
  const invoiceBatches = buildInvoiceBatchPayloads(state);
  const invoiceLines = buildInvoiceLinePayloads(state);
  const validationIssues = buildValidationIssuePayloads(state);

  const payload = {
    schema: "power_platform_document_pipeline_payload_v1",
    orchestrationRunId: state.orchestrationRunId,
    generatedAt: new Date().toISOString(),
    target: {
      system: "Power Platform",
      storage: "Dataverse",
      workflow: "Power Automate",
      reviewUi: "Power Apps"
    },
    invoiceBatches,
    invoiceLines,
    validationIssues,
    routing: state.routing
  };

  writeJson(path.join("outputs", "power-automate-payload.json"), payload);

  return {
    ...state,
    powerPlatformPayload: payload,
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent("power_platform_payload_agent", "created_connector_payload", {
        invoiceBatchCount: invoiceBatches.length,
        invoiceLineCount: invoiceLines.length,
        validationIssueCount: validationIssues.length,
        outputPath: path.join("outputs", "power-automate-payload.json")
      })
    ]
  };
}

function reviewPacketAgent(state) {
  const reviewPacket = {
    schema: "human_review_packet_v1",
    orchestrationRunId: state.orchestrationRunId,
    generatedAt: new Date().toISOString(),
    reviewStatus: state.routing.requiresHumanReview ? "required" : "not_required",
    reviewerInstructions: state.routing.requiresHumanReview
      ? "Review validation issues, compare extracted values against source evidence, then approve or correct before downstream posting."
      : "No blocking issues found. Reviewer can sample-check and approve for downstream posting.",
    summary: {
      sourceDocumentCount: state.intake.sourceDocumentCount,
      canonicalLineCount: state.intake.canonicalLineCount,
      validationIssueCount: state.validation.issueCount,
      sourceValidationFlagCount: state.masterOutput.metadata.totalValidationFlagCount,
      lineAmountGrandTotalUSD: state.masterOutput.metadata.lineAmountGrandTotalUSD
    },
    issues: state.validation.issues,
    sampleRows: state.masterOutput.records.slice(0, 5)
  };

  writeJson(path.join("outputs", "human-review-packet.json"), reviewPacket);

  return {
    ...state,
    reviewPacket,
    auditEvents: [
      ...state.auditEvents,
      buildAuditEvent("review_packet_agent", "created_human_review_packet", {
        reviewStatus: reviewPacket.reviewStatus,
        outputPath: path.join("outputs", "human-review-packet.json")
      })
    ]
  };
}

function auditAgent(state) {
  const auditLog = {
    schema: "orchestration_audit_log_v1",
    orchestrationRunId: state.orchestrationRunId,
    generatedAt: new Date().toISOString(),
    eventCount: state.auditEvents.length,
    events: state.auditEvents
  };

  writeJson(path.join("outputs", "orchestration-audit-log.json"), auditLog);

  return {
    ...state,
    auditLog
  };
}

function buildAuditEvent(actor, action, details) {
  return {
    timestamp: new Date().toISOString(),
    actorType: "agent",
    actor,
    action,
    details
  };
}

function buildInvoiceBatchPayloads(state) {
  const recordsByInvoice = new Map();

  for (const record of state.masterOutput.records) {
    if (!recordsByInvoice.has(record.InvoiceNumber)) {
      recordsByInvoice.set(record.InvoiceNumber, []);
    }

    recordsByInvoice.get(record.InvoiceNumber).push(record);
  }

  return Array.from(recordsByInvoice.entries()).map(([invoiceNumber, records], index) => ({
    externalBatchId: `INV-BATCH-${String(index + 1).padStart(6, "0")}`,
    processingRunId: state.orchestrationRunId,
    invoiceNumber,
    invoiceDate: records[0].InvoiceDate,
    shipmentNumber: records[0].ShipmentNumber,
    invoiceFamily: records[0].InvoiceFamily,
    sourceInvoiceFile: records[0].SourceInvoiceFile,
    extractedLineCount: records.length,
    lineAmountGrandTotalUSD: Number(records.reduce((sum, record) => sum + record.LineAmountUSD, 0).toFixed(2)),
    requiresHumanReview: state.routing.requiresHumanReview,
    batchStatus: state.routing.requiresHumanReview ? "Needs Review" : "Ready For Automation"
  }));
}

function buildInvoiceLinePayloads(state) {
  return state.masterOutput.records.map((record, index) => ({
    externalLineId: `INV-LINE-${String(index + 1).padStart(6, "0")}`,
    invoiceNumber: record.InvoiceNumber,
    sourceInvoiceFile: record.SourceInvoiceFile,
    sourceParser: record.SourceParser,
    shipmentNumber: record.ShipmentNumber,
    lineNo: record.LineNo,
    productNumber: record.ProductNumber,
    description: record.Description,
    unit: record.Unit,
    quantity: record.Quantity,
    unitPriceUSD: record.UnitPriceUSD,
    lineAmountUSD: record.LineAmountUSD,
    commodityCode: record.CommodityCode,
    countryOfOrigin: record.CountryOfOrigin,
    deliveryNote: record.DeliveryNote,
    orderNumber: record.OrderNumber,
    netWeightKG: record.NetWeightKG,
    grossWeightKG: record.GrossWeightKG,
    lineValidationStatus: "Valid"
  }));
}

function buildValidationIssuePayloads(state) {
  return state.validation.issues.map((issue, index) => ({
    externalValidationIssueId: `VAL-${String(index + 1).padStart(6, "0")}`,
    severity: issue.severity,
    ruleId: issue.ruleId,
    fieldName: issue.field,
    lineNo: issue.lineNo,
    productNumber: issue.productNumber,
    expectedValue: String(issue.expectedValue ?? ""),
    actualValue: String(issue.actualValue ?? ""),
    message: issue.message,
    requiresHumanReview: issue.requiresHumanReview,
    issueStatus: "Open"
  }));
}

function main() {
  try {
    ensureDirectoryExists(outputsDir);

    const basePipelineRun = runBasePipelineIfNeeded();

    let state = {
      orchestrationRunId,
      status: "running",
      basePipelineRun,
      auditEvents: [
        buildAuditEvent("orchestrator", "started_orchestration", {
          orchestrationRunId,
          basePipelineRun
        })
      ]
    };

    const agents = [
      intakeAgent,
      validationAgent,
      routingAgent,
      powerPlatformPayloadAgent,
      reviewPacketAgent,
      auditAgent
    ];

    for (const agent of agents) {
      state = agent(state);
    }

    const summary = {
      schema: "orchestration_run_summary_v1",
      orchestrationRunId,
      status: "completed",
      basePipelineRun,
      metrics: {
        sourceDocumentCount: state.intake.sourceDocumentCount,
        canonicalLineCount: state.intake.canonicalLineCount,
        validationIssueCount: state.validation.issueCount,
        requiresHumanReview: state.routing.requiresHumanReview,
        auditEventCount: state.auditLog.eventCount
      },
      outputs: {
        powerAutomatePayload: path.join("outputs", "power-automate-payload.json"),
        humanReviewPacket: path.join("outputs", "human-review-packet.json"),
        auditLog: path.join("outputs", "orchestration-audit-log.json")
      }
    };

    writeJson(path.join("outputs", "orchestration-run-summary.json"), summary);

    console.log("============================================================");
    console.log("MULTI-AGENT ORCHESTRATION RUN COMPLETE");
    console.log("============================================================");
    console.log(`Run ID: ${summary.orchestrationRunId}`);
    console.log(`Rows: ${summary.metrics.canonicalLineCount}`);
    console.log(`Validation issues: ${summary.metrics.validationIssueCount}`);
    console.log(`Requires human review: ${summary.metrics.requiresHumanReview}`);
    console.log(`Power Automate payload: ${summary.outputs.powerAutomatePayload}`);
    console.log(`Human review packet: ${summary.outputs.humanReviewPacket}`);
    console.log(`Audit log: ${summary.outputs.auditLog}`);
    console.log("============================================================");
  } catch (error) {
    console.error("============================================================");
    console.error("MULTI-AGENT ORCHESTRATION RUN FAILED");
    console.error("============================================================");
    console.error(error.message);
    console.error("============================================================");
    process.exit(1);
  }
}

main();
