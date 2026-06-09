const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputsDir = path.join(projectRoot, "outputs");

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

function runDemoPipelineIfNeeded() {
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
    throw new Error(`Demo pipeline failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Demo pipeline exited with code ${result.status}`);
  }

  return {
    status: "completed",
    reason: "Demo pipeline was generated before evaluation"
  };
}

function evaluateRequiredFields(records) {
  const requiredFields = [
    "SourceInvoiceFile",
    "SourceParser",
    "InvoiceNumber",
    "LineNo",
    "ProductNumber",
    "Quantity",
    "UnitPriceUSD",
    "LineAmountUSD"
  ];

  const failures = [];

  records.forEach((record, index) => {
    requiredFields.forEach((field) => {
      if (record[field] === undefined || record[field] === null || record[field] === "") {
        failures.push({
          metric: "required_field_completeness",
          rowIndex: index,
          field,
          message: `${field} is required but missing or blank.`
        });
      }
    });
  });

  return {
    metric: "required_field_completeness",
    passed: failures.length === 0,
    failureCount: failures.length,
    failures
  };
}

function evaluateLineAmountMath(records) {
  const failures = [];

  records.forEach((record, index) => {
    const expectedAmount = Number((record.Quantity * record.UnitPriceUSD).toFixed(2));
    const actualAmount = Number(Number(record.LineAmountUSD).toFixed(2));

    if (expectedAmount !== actualAmount) {
      failures.push({
        metric: "line_amount_accuracy",
        rowIndex: index,
        lineNo: record.LineNo,
        productNumber: record.ProductNumber,
        expectedAmount,
        actualAmount,
        message: "Quantity multiplied by UnitPriceUSD does not match LineAmountUSD."
      });
    }
  });

  return {
    metric: "line_amount_accuracy",
    passed: failures.length === 0,
    failureCount: failures.length,
    failures
  };
}

function evaluateRowCount(masterOutput) {
  const metadataRowCount = masterOutput.metadata.rowCount;
  const actualRowCount = masterOutput.records.length;

  return {
    metric: "row_count_consistency",
    passed: metadataRowCount === actualRowCount,
    expected: metadataRowCount,
    actual: actualRowCount,
    failureCount: metadataRowCount === actualRowCount ? 0 : 1,
    failures: metadataRowCount === actualRowCount
      ? []
      : [
          {
            metric: "row_count_consistency",
            expected: metadataRowCount,
            actual: actualRowCount,
            message: "Metadata row count does not match actual record count."
          }
        ]
  };
}

function evaluateGrandTotal(masterOutput) {
  const expectedGrandTotal = Number(masterOutput.metadata.lineAmountGrandTotalUSD.toFixed(2));
  const actualGrandTotal = Number(masterOutput.records.reduce((sum, record) => {
    return sum + Number(record.LineAmountUSD);
  }, 0).toFixed(2));

  return {
    metric: "grand_total_consistency",
    passed: expectedGrandTotal === actualGrandTotal,
    expected: expectedGrandTotal,
    actual: actualGrandTotal,
    failureCount: expectedGrandTotal === actualGrandTotal ? 0 : 1,
    failures: expectedGrandTotal === actualGrandTotal
      ? []
      : [
          {
            metric: "grand_total_consistency",
            expected: expectedGrandTotal,
            actual: actualGrandTotal,
            message: "Metadata grand total does not match sum of line amounts."
          }
        ]
  };
}

function calculateScore(evaluations) {
  const totalChecks = evaluations.length;
  const passedChecks = evaluations.filter((evaluation) => evaluation.passed).length;

  return {
    totalChecks,
    passedChecks,
    failedChecks: totalChecks - passedChecks,
    scorePercent: Number(((passedChecks / totalChecks) * 100).toFixed(2)),
    passed: passedChecks === totalChecks
  };
}

function main() {
  try {
    ensureDirectoryExists(outputsDir);

    const demoRun = runDemoPipelineIfNeeded();
    const masterOutput = readJson(path.join("outputs", "master-canonical-invoice-lines.json"));

    const evaluations = [
      evaluateRowCount(masterOutput),
      evaluateRequiredFields(masterOutput.records),
      evaluateLineAmountMath(masterOutput.records),
      evaluateGrandTotal(masterOutput)
    ];

    const score = calculateScore(evaluations);

    const report = {
      schema: "pipeline_evaluation_report_v1",
      generatedAt: new Date().toISOString(),
      demoRun,
      score,
      evaluations,
      recommendation: score.passed
        ? "Pipeline output passed all public-demo evaluation checks."
        : "Pipeline output should be reviewed before downstream workflow posting."
    };

    writeJson(path.join("outputs", "pipeline-evaluation-report.json"), report);

    console.log("============================================================");
    console.log("PIPELINE EVALUATION COMPLETE");
    console.log("============================================================");
    console.log(`Passed checks: ${score.passedChecks}/${score.totalChecks}`);
    console.log(`Score: ${score.scorePercent}%`);
    console.log(`Passed: ${score.passed}`);
    console.log("Evaluation report: outputs/pipeline-evaluation-report.json");
    console.log("============================================================");

    if (!score.passed) {
      process.exit(1);
    }
  } catch (error) {
    console.error("============================================================");
    console.error("PIPELINE EVALUATION FAILED");
    console.error("============================================================");
    console.error(error.message);
    console.error("============================================================");
    process.exit(1);
  }
}

main();
