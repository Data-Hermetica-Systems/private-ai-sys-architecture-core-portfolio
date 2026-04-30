const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

const pipelineName = "Private AI Document Automation Platform - Public Demo";
const pipelineVersion = "demo-v1";

const outputDirectories = [
  "ocr",
  "outputs",
  "images"
];

const pipelineSteps = [
  {
    stepNumber: 1,
    name: "Create synthetic OCR input",
    script: "demo-ocr-pipeline.js",
    expectedOutputs: [
      path.join("ocr", "synthetic-commercial-invoice-001-ocr.txt"),
      path.join("ocr", "demo-ocr-run-summary.json")
    ]
  },
  {
    stepNumber: 2,
    name: "Segment invoice items",
    script: "demo-segment-invoice-items.js",
    expectedOutputs: [
      path.join("ocr", "synthetic-commercial-invoice-001-segments.json"),
      path.join("ocr", "demo-segmentation-summary.json")
    ]
  },
  {
    stepNumber: 3,
    name: "Build canonical invoice rows",
    script: "demo-build-canonical-rows.js",
    expectedOutputs: [
      path.join("outputs", "synthetic-commercial-invoice-001-canonical-lines.json"),
      path.join("outputs", "synthetic-commercial-invoice-001-canonical-lines.csv"),
      path.join("outputs", "demo-canonical-lines-summary.json")
    ]
  },
  {
    stepNumber: 4,
    name: "Reconcile invoice weight totals",
    script: "demo-reconcile-weight-totals.js",
    expectedOutputs: [
      path.join("outputs", "synthetic-commercial-invoice-001-weight-reconciliation.json"),
      path.join("outputs", "demo-weight-reconciliation-summary.json")
    ]
  },
  {
    stepNumber: 5,
    name: "Build master JSON, CSV, and validation flag outputs",
    script: "demo-build-master-output.js",
    expectedOutputs: [
      path.join("outputs", "master-canonical-invoice-lines.json"),
      path.join("outputs", "master-canonical-invoice-lines.csv"),
      path.join("outputs", "master-validation-flags.csv")
    ]
  }
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function runNodeScript(step) {
  const scriptPath = path.join(projectRoot, "src", step.script);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }

  console.log("============================================================");
  console.log(`STEP ${step.stepNumber}: ${step.name}`);
  console.log(`Running: node src\\${step.script}`);
  console.log("============================================================");

  const startedAt = Date.now();

  const result = spawnSync(
    process.execPath,
    [scriptPath],
    {
      cwd: projectRoot,
      stdio: "inherit",
      shell: false,
      windowsHide: false
    }
  );

  const finishedAt = Date.now();

  if (result.error) {
    throw new Error(`Failed to run ${step.script}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${step.script} exited with code ${result.status}`);
  }

  const missingOutputs = step.expectedOutputs.filter((relativePath) => !fileExists(relativePath));

  if (missingOutputs.length > 0) {
    throw new Error(`Step ${step.stepNumber} missing expected outputs: ${missingOutputs.join(", ")}`);
  }

  return {
    stepNumber: step.stepNumber,
    name: step.name,
    script: step.script,
    status: "completed",
    durationMs: finishedAt - startedAt,
    expectedOutputs: step.expectedOutputs
  };
}

function readJsonIfExists(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writePipelineSummary(startedAt, finishedAt, stepResults) {
  const masterOutput = readJsonIfExists(path.join("outputs", "master-canonical-invoice-lines.json"));

  const summary = {
    outputSchema: "public_demo_pipeline_run_summary_v1",
    pipelineName,
    pipelineVersion,
    status: "completed",
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    steps: stepResults,
    metrics: {
      invoiceCount: masterOutput?.metadata?.invoiceCount || 0,
      rowCount: masterOutput?.metadata?.rowCount || 0,
      lineAmountGrandTotalUSD: masterOutput?.metadata?.lineAmountGrandTotalUSD || 0,
      netWeightGrandTotalKG: masterOutput?.metadata?.netWeightGrandTotalKG || 0,
      grossWeightGrandTotalKG: masterOutput?.metadata?.grossWeightGrandTotalKG || 0,
      totalValidationFlagCount: masterOutput?.metadata?.totalValidationFlagCount || 0,
      hasValidationErrors: masterOutput?.metadata?.hasValidationErrors || false
    },
    outputs: {
      masterJson: path.join("outputs", "master-canonical-invoice-lines.json"),
      masterCsv: path.join("outputs", "master-canonical-invoice-lines.csv"),
      masterValidationFlagsCsv: path.join("outputs", "master-validation-flags.csv")
    }
  };

  const summaryPath = path.join(projectRoot, "outputs", "master-pipeline-run-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return summary;
}

function main() {
  const startedAt = Date.now();
  const stepResults = [];

  try {
    for (const directory of outputDirectories) {
      ensureDirectoryExists(path.join(projectRoot, directory));
    }

    for (const step of pipelineSteps) {
      const result = runNodeScript(step);
      stepResults.push(result);
    }

    const finishedAt = Date.now();
    const summary = writePipelineSummary(startedAt, finishedAt, stepResults);

    console.log("============================================================");
    console.log(`${pipelineName} ${pipelineVersion}`);
    console.log("PIPELINE RUN COMPLETE");
    console.log("============================================================");
    console.log(`Status: ${summary.status}`);
    console.log(`Rows: ${summary.metrics.rowCount}`);
    console.log(`Line amount grand total USD: ${summary.metrics.lineAmountGrandTotalUSD}`);
    console.log(`Total validation flags: ${summary.metrics.totalValidationFlagCount}`);
    console.log(`Has validation errors: ${summary.metrics.hasValidationErrors}`);
    console.log("Master summary:");
    console.log(path.join(projectRoot, "outputs", "master-pipeline-run-summary.json"));
    console.log("============================================================");
  } catch (error) {
    console.error("============================================================");
    console.error(`${pipelineName} ${pipelineVersion}`);
    console.error("PIPELINE RUN FAILED");
    console.error("============================================================");
    console.error(error.message);
    console.error("============================================================");
    process.exit(1);
  }
}

main();