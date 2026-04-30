const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

const pipelineName = "Data Hermetica Private Document Intelligence Pipeline";
const pipelineVersion = "v0.2";

const pipelineSteps = [
  {
    stepNumber: 1,
    name: "OCR PDF invoices with Tesseract",
    script: "ocr-pdf-with-tesseract.js",
    expectedOutputs: [
      path.join("ocr", "tesseract-ocr-run-summary.json"),
      path.join("ocr", "sample-commercial-invoice-001-tesseract-ocr.txt"),
      path.join("ocr", "sample-commercial-invoice-002-tesseract-ocr.txt"),
      path.join("ocr", "sample-commercial-invoice-003-tesseract-ocr.txt"),
      path.join("ocr", "sample-commercial-invoice-004-tesseract-ocr.txt"),
      path.join("ocr", "sample-commercial-invoice-005-tesseract-ocr.txt")
    ]
  },
  {
    stepNumber: 2,
    name: "Segment OCR invoice items",
    script: "segment-ocr-invoice-items.js",
    expectedOutputs: [
      path.join("ocr", "segmented-items-summary.json"),
      path.join("ocr", "sample-commercial-invoice-001-segmented-items.json"),
      path.join("ocr", "sample-commercial-invoice-002-segmented-items.json"),
      path.join("ocr", "sample-commercial-invoice-003-segmented-items.json"),
      path.join("ocr", "sample-commercial-invoice-004-segmented-items.json"),
      path.join("ocr", "sample-commercial-invoice-005-segmented-items.json")
    ]
  },
  {
    stepNumber: 3,
    name: "Build deterministic canonical rows from segmented Honeywell invoices",
    script: "build-canonical-rows-from-segments.js",
    expectedOutputs: [
      path.join("outputs", "deterministic-canonical-lines-summary.json"),
      path.join("outputs", "sample-commercial-invoice-001-deterministic-canonical-lines.json"),
      path.join("outputs", "sample-commercial-invoice-001-deterministic-canonical-lines.csv"),
      path.join("outputs", "sample-commercial-invoice-002-deterministic-canonical-lines.json"),
      path.join("outputs", "sample-commercial-invoice-002-deterministic-canonical-lines.csv"),
      path.join("outputs", "sample-commercial-invoice-003-deterministic-canonical-lines.json"),
      path.join("outputs", "sample-commercial-invoice-003-deterministic-canonical-lines.csv")
    ]
  },
  {
    stepNumber: 4,
    name: "Build canonical rows for special invoice families",
    script: "build-canonical-rows-for-special-families.js",
    expectedOutputs: [
      path.join("outputs", "special-family-canonical-lines-summary.json"),
      path.join("outputs", "sample-commercial-invoice-004-special-family-canonical-lines.json"),
      path.join("outputs", "sample-commercial-invoice-004-special-family-canonical-lines.csv"),
      path.join("outputs", "sample-commercial-invoice-005-special-family-canonical-lines.json"),
      path.join("outputs", "sample-commercial-invoice-005-special-family-canonical-lines.csv")
    ]
  },
  {
    stepNumber: 5,
    name: "Reconcile invoice weight totals",
    script: "reconcile-invoice-weight-totals.js",
    expectedOutputs: [
      path.join("outputs", "weight-reconciliation-summary.json"),
      path.join("outputs", "sample-commercial-invoice-001-weight-reconciliation.json"),
      path.join("outputs", "sample-commercial-invoice-002-weight-reconciliation.json"),
      path.join("outputs", "sample-commercial-invoice-003-weight-reconciliation.json")
    ]
  },
  {
    stepNumber: 6,
    name: "Build master canonical JSON and CSV output",
    script: "build-master-canonical-output.js",
    expectedOutputs: [
      path.join("outputs", "master-canonical-invoice-lines.json"),
      path.join("outputs", "master-canonical-invoice-lines.csv"),
      path.join("outputs", "master-validation-flags.csv")
    ]
  }
];

const outputDirectories = [
  "outputs",
  "ocr",
  "images"
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readJsonIfExists(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    return {
      error: `Could not parse JSON file: ${relativePath}`,
      detail: error.message
    };
  }
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function getFileSize(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fs.statSync(fullPath).size;
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

  const outputChecks = step.expectedOutputs.map((relativePath) => {
    return {
      path: relativePath,
      exists: fileExists(relativePath),
      sizeBytes: getFileSize(relativePath)
    };
  });

  const missingOutputs = outputChecks.filter((output) => !output.exists);

  if (missingOutputs.length > 0) {
    throw new Error(
      `Step ${step.stepNumber} completed but expected outputs are missing: ${missingOutputs
        .map((output) => output.path)
        .join(", ")}`
    );
  }

  return {
    stepNumber: step.stepNumber,
    name: step.name,
    script: step.script,
    status: "completed",
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    expectedOutputs: outputChecks
  };
}

function normalizeNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return fallback;
}

function collectPipelineMetrics() {
  const ocrSummary = readJsonIfExists(path.join("ocr", "tesseract-ocr-run-summary.json"));
  const segmentationSummary = readJsonIfExists(path.join("ocr", "segmented-items-summary.json"));
  const deterministicSummary = readJsonIfExists(path.join("outputs", "deterministic-canonical-lines-summary.json"));
  const specialFamilySummary = readJsonIfExists(path.join("outputs", "special-family-canonical-lines-summary.json"));
  const weightReconciliationSummary = readJsonIfExists(path.join("outputs", "weight-reconciliation-summary.json"));
  const masterCanonicalOutput = readJsonIfExists(path.join("outputs", "master-canonical-invoice-lines.json"));

  const deterministicJobs = deterministicSummary && Array.isArray(deterministicSummary.jobs)
    ? deterministicSummary.jobs
    : [];

  const specialFamilyJobs = specialFamilySummary && Array.isArray(specialFamilySummary.jobs)
    ? specialFamilySummary.jobs
    : [];

  const weightReconciliationJobs =
    weightReconciliationSummary && Array.isArray(weightReconciliationSummary.jobs)
      ? weightReconciliationSummary.jobs
      : [];

  const allCanonicalJobs = [
    ...deterministicJobs.map((job) => {
      const matchingWeightJob = weightReconciliationJobs.find((weightJob) => {
        return weightJob.jobName === job.jobName;
      });

      return {
        source: "deterministic_segments",
        jobName: job.jobName,
        invoiceNumber: job.invoiceNumber || "N/A",
        invoiceDate: job.invoiceDate || "N/A",
        shipmentNumber: job.shipmentNumber || "N/A",
        expectedRows: job.expectedRows,
        actualRows: job.actualRows,
        validationFlagCount: normalizeNumber(job.validationFlagCount, 0),
        jsonOutputFile: job.jsonOutputFile,
        csvOutputFile: job.csvOutputFile,
        weightReconciliationStatus: matchingWeightJob
          ? {
              net: matchingWeightJob.netStatus || "N/A",
              gross: matchingWeightJob.grossStatus || "N/A"
            }
          : null
      };
    }),
    ...specialFamilyJobs.map((job) => {
      return {
        source: "special_family_parser",
        jobName: job.jobName,
        family: job.family,
        invoiceNumber: job.invoiceMetadata?.invoiceNumber || "N/A",
        invoiceDate: job.invoiceMetadata?.invoiceDate || "N/A",
        shipmentNumber: job.invoiceMetadata?.containerNumber || "N/A",
        expectedRows: job.expectedRows,
        actualRows: job.actualRows,
        validationFlagCount: normalizeNumber(job.validationFlagCount, 0),
        jsonOutputFile: job.jsonOutputFile,
        csvOutputFile: job.csvOutputFile,
        weightReconciliationStatus: null
      };
    })
  ];

  const totalRowsExtracted = allCanonicalJobs.reduce((sum, job) => {
    return sum + normalizeNumber(job.actualRows, 0);
  }, 0);

  const totalExpectedRows = allCanonicalJobs.reduce((sum, job) => {
    return sum + normalizeNumber(job.expectedRows, 0);
  }, 0);

  const sourceValidationFlagCount = allCanonicalJobs.reduce((sum, job) => {
    return sum + normalizeNumber(job.validationFlagCount, 0);
  }, 0);

  const masterValidationFlagCount =
    masterCanonicalOutput?.validation?.masterValidationFlagCount !== undefined
      ? normalizeNumber(masterCanonicalOutput.validation.masterValidationFlagCount, 0)
      : 0;

  const masterSourceValidationFlagCount =
    masterCanonicalOutput?.validation?.sourceValidationFlagCount !== undefined
      ? normalizeNumber(masterCanonicalOutput.validation.sourceValidationFlagCount, 0)
      : sourceValidationFlagCount;

  const totalValidationFlagCount =
    masterCanonicalOutput?.validation?.totalValidationFlagCount !== undefined
      ? normalizeNumber(masterCanonicalOutput.validation.totalValidationFlagCount, 0)
      : sourceValidationFlagCount + masterValidationFlagCount;

  const totalValidationFlags =
    masterCanonicalOutput?.validation?.validationFlags &&
    Array.isArray(masterCanonicalOutput.validation.validationFlags)
      ? masterCanonicalOutput.validation.validationFlags
      : [];

  const hasValidationErrors =
    masterCanonicalOutput?.metadata?.hasValidationErrors === true ||
    totalValidationFlags.some((flag) => flag.severity === "error") ||
    totalValidationFlagCount > 0;

  const allRowCountsMatched = allCanonicalJobs.every((job) => {
    return job.expectedRows === job.actualRows;
  });

  const allValidationClear = totalValidationFlagCount === 0;

  const lineAmountGrandTotalUSD =
    masterCanonicalOutput?.metadata?.lineAmountGrandTotalUSD !== undefined
      ? normalizeNumber(masterCanonicalOutput.metadata.lineAmountGrandTotalUSD, 0)
      : null;

  const netWeightGrandTotalKG =
    masterCanonicalOutput?.metadata?.netWeightGrandTotalKG !== undefined
      ? normalizeNumber(masterCanonicalOutput.metadata.netWeightGrandTotalKG, 0)
      : null;

  const grossWeightGrandTotalKG =
    masterCanonicalOutput?.metadata?.grossWeightGrandTotalKG !== undefined
      ? normalizeNumber(masterCanonicalOutput.metadata.grossWeightGrandTotalKG, 0)
      : null;

  return {
    ocrSummary,
    segmentationSummary,
    deterministicSummary,
    specialFamilySummary,
    weightReconciliationSummary,
    masterCanonicalOutput,
    canonicalExtractionJobs: allCanonicalJobs,
    metrics: {
      pdfJobCount: ocrSummary && Array.isArray(ocrSummary.jobs) ? ocrSummary.jobs.length : null,
      segmentationJobCount: segmentationSummary && Array.isArray(segmentationSummary.jobs) ? segmentationSummary.jobs.length : null,
      canonicalJobCount: allCanonicalJobs.length,
      weightReconciliationJobCount: weightReconciliationJobs.length,
      totalExpectedRows,
      totalRowsExtracted,
      sourceValidationFlagCount,
      masterValidationFlagCount,
      masterSourceValidationFlagCount,
      totalValidationFlagCount,
      hasValidationErrors,
      allRowCountsMatched,
      allValidationClear,
      lineAmountGrandTotalUSD,
      netWeightGrandTotalKG,
      grossWeightGrandTotalKG,
      masterValidationFlagsCsvCreated: fileExists(path.join("outputs", "master-validation-flags.csv")),
      weightReconciliationSummaryCreated: fileExists(path.join("outputs", "weight-reconciliation-summary.json"))
    }
  };
}

function writeMasterSummary(pipelineStartedAt, pipelineFinishedAt, stepResults, pipelineStatus, errorMessage = null) {
  const collected = collectPipelineMetrics();

  const summary = {
    pipelineName,
    pipelineVersion,
    status: pipelineStatus,
    startedAt: new Date(pipelineStartedAt).toISOString(),
    finishedAt: new Date(pipelineFinishedAt).toISOString(),
    durationMs: pipelineFinishedAt - pipelineStartedAt,
    errorMessage,
    steps: stepResults,
    metrics: collected.metrics,
    canonicalExtractionJobs: collected.canonicalExtractionJobs,
    sourceSummaries: {
      ocrSummaryPath: path.join("ocr", "tesseract-ocr-run-summary.json"),
      segmentationSummaryPath: path.join("ocr", "segmented-items-summary.json"),
      deterministicSummaryPath: path.join("outputs", "deterministic-canonical-lines-summary.json"),
      specialFamilySummaryPath: path.join("outputs", "special-family-canonical-lines-summary.json"),
      weightReconciliationSummaryPath: path.join("outputs", "weight-reconciliation-summary.json"),
      masterCanonicalOutputPath: path.join("outputs", "master-canonical-invoice-lines.json"),
      masterValidationFlagsCsvPath: path.join("outputs", "master-validation-flags.csv")
    },
    generatedOutputFiles: {
      masterSummary: path.join("outputs", "master-pipeline-run-summary.json"),
      masterCanonicalJson: path.join("outputs", "master-canonical-invoice-lines.json"),
      masterCanonicalCsv: path.join("outputs", "master-canonical-invoice-lines.csv"),
      masterValidationFlagsCsv: path.join("outputs", "master-validation-flags.csv"),
      weightReconciliationSummary: path.join("outputs", "weight-reconciliation-summary.json"),
      jsonAndCsvOutputsDirectory: "outputs",
      ocrDirectory: "ocr",
      imagesDirectory: "images"
    }
  };

  const summaryPath = path.join(projectRoot, "outputs", "master-pipeline-run-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return summary;
}

function printFinalSummary(summary) {
  console.log("============================================================");
  console.log(`${pipelineName} ${pipelineVersion}`);
  console.log("PIPELINE RUN COMPLETE");
  console.log("============================================================");
  console.log(`Status: ${summary.status}`);
  console.log(`Duration ms: ${summary.durationMs}`);
  console.log(`Canonical jobs: ${summary.metrics.canonicalJobCount}`);
  console.log(`Weight reconciliation jobs: ${summary.metrics.weightReconciliationJobCount}`);
  console.log(`Expected rows: ${summary.metrics.totalExpectedRows}`);
  console.log(`Rows extracted: ${summary.metrics.totalRowsExtracted}`);
  console.log(`Line amount grand total USD: ${summary.metrics.lineAmountGrandTotalUSD}`);
  console.log(`Net weight grand total KG: ${summary.metrics.netWeightGrandTotalKG}`);
  console.log(`Gross weight grand total KG: ${summary.metrics.grossWeightGrandTotalKG}`);
  console.log(`Source validation flags: ${summary.metrics.sourceValidationFlagCount}`);
  console.log(`Master validation flags: ${summary.metrics.masterValidationFlagCount}`);
  console.log(`Total validation flags: ${summary.metrics.totalValidationFlagCount}`);
  console.log(`Has validation errors: ${summary.metrics.hasValidationErrors}`);
  console.log(`All row counts matched: ${summary.metrics.allRowCountsMatched}`);
  console.log(`All validation clear: ${summary.metrics.allValidationClear}`);
  console.log(`Weight reconciliation summary created: ${summary.metrics.weightReconciliationSummaryCreated}`);
  console.log(`Master validation flags CSV created: ${summary.metrics.masterValidationFlagsCsvCreated}`);
  console.log("Master summary:");
  console.log(path.join(projectRoot, "outputs", "master-pipeline-run-summary.json"));
  console.log("============================================================");
}

function main() {
  const pipelineStartedAt = Date.now();
  const stepResults = [];

  try {
    for (const directory of outputDirectories) {
      ensureDirectoryExists(path.join(projectRoot, directory));
    }

    for (const step of pipelineSteps) {
      const result = runNodeScript(step);
      stepResults.push(result);
    }

    const pipelineFinishedAt = Date.now();
    const summary = writeMasterSummary(
      pipelineStartedAt,
      pipelineFinishedAt,
      stepResults,
      "completed",
      null
    );

    printFinalSummary(summary);
  } catch (error) {
    const pipelineFinishedAt = Date.now();

    const summary = writeMasterSummary(
      pipelineStartedAt,
      pipelineFinishedAt,
      stepResults,
      "failed",
      error.message
    );

    console.error("============================================================");
    console.error(`${pipelineName} ${pipelineVersion}`);
    console.error("PIPELINE RUN FAILED");
    console.error("============================================================");
    console.error(error.message);
    console.error("Partial master summary:");
    console.error(path.join(projectRoot, "outputs", "master-pipeline-run-summary.json"));
    console.error("============================================================");

    process.exit(1);
  }
}

main();