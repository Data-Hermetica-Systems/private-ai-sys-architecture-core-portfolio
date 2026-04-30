const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const canonicalInputPath = path.join(projectRoot, "outputs", "synthetic-commercial-invoice-001-canonical-lines.json");
const ocrInputPath = path.join(projectRoot, "ocr", "synthetic-commercial-invoice-001-ocr.txt");
const diagnosticsOutputPath = path.join(projectRoot, "outputs", "synthetic-commercial-invoice-001-weight-reconciliation.json");
const summaryOutputPath = path.join(projectRoot, "outputs", "demo-weight-reconciliation-summary.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function parseEuropeanNumber(value) {
  if (!value) {
    return null;
  }

  const raw = value.trim();

  if (raw.includes(",") && !raw.includes(".")) {
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (raw.includes(".") && raw.includes(",")) {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractInvoiceTotal(text, label) {
  const pattern = new RegExp(`${label}\\s+([0-9.,]+)\\s*KG`, "i");
  const match = text.match(pattern);

  if (!match) {
    return null;
  }

  return parseEuropeanNumber(match[1]);
}

function sumNumericField(rows, fieldName) {
  return Number(
    rows
      .reduce((sum, row) => {
        if (typeof row[fieldName] === "number") {
          return sum + row[fieldName];
        }

        return sum;
      }, 0)
      .toFixed(3)
  );
}

function almostEqual(a, b, tolerance = 0.001) {
  return Math.abs(a - b) <= tolerance;
}

function main() {
  try {
    const canonicalData = readJson(canonicalInputPath);
    const ocrText = readText(ocrInputPath);

    const rows = canonicalData.canonicalRows;

    const invoiceTotalNetWeightKG = extractInvoiceTotal(ocrText, "Total Net weight");
    const invoiceTotalGrossWeightKG = extractInvoiceTotal(ocrText, "Total Gross weight");

    const lineNetWeightSumKG = sumNumericField(rows, "NetWeightKG");
    const lineGrossWeightSumKG = sumNumericField(rows, "GrossWeightKG");

    const validationFlags = [];

    const netStatus =
      invoiceTotalNetWeightKG !== null && almostEqual(invoiceTotalNetWeightKG, lineNetWeightSumKG)
        ? "matched"
        : "failed_no_valid_candidate_match";

    const grossStatus =
      invoiceTotalGrossWeightKG !== null && almostEqual(invoiceTotalGrossWeightKG, lineGrossWeightSumKG)
        ? "matched"
        : "failed_no_valid_candidate_match";

    if (netStatus !== "matched") {
      validationFlags.push({
        field: "NetWeightKG",
        row: "N/A",
        severity: "error",
        issue: `Line-item NetWeightKG sum ${lineNetWeightSumKG} does not match invoice total net weight ${invoiceTotalNetWeightKG}.`
      });
    }

    if (grossStatus !== "matched") {
      validationFlags.push({
        field: "GrossWeightKG",
        row: "N/A",
        severity: "error",
        issue: `Line-item GrossWeightKG sum ${lineGrossWeightSumKG} does not match invoice total gross weight ${invoiceTotalGrossWeightKG}.`
      });
    }

    const diagnostics = {
      outputSchema: "public_demo_weight_reconciliation_v1",
      generatedAt: new Date().toISOString(),
      jobName: "synthetic-commercial-invoice-001",
      invoiceTotals: {
        invoiceTotalNetWeightKG,
        invoiceTotalGrossWeightKG
      },
      lineItemSums: {
        lineNetWeightSumKG,
        lineGrossWeightSumKG
      },
      status: {
        net: netStatus,
        gross: grossStatus
      },
      validation: {
        validationFlagCount: validationFlags.length,
        validationFlags
      }
    };

    fs.writeFileSync(diagnosticsOutputPath, JSON.stringify(diagnostics, null, 2), "utf8");

    const summary = {
      outputSchema: "public_demo_weight_reconciliation_summary_v1",
      generatedAt: new Date().toISOString(),
      jobCount: 1,
      jobs: [
        {
          jobName: "synthetic-commercial-invoice-001",
          netStatus,
          grossStatus,
          validationFlagCount: validationFlags.length,
          diagnosticsOutputFile: "synthetic-commercial-invoice-001-weight-reconciliation.json"
        }
      ]
    };

    fs.writeFileSync(summaryOutputPath, JSON.stringify(summary, null, 2), "utf8");

    console.log("------------------------------------------------------------");
    console.log("Synthetic weight reconciliation complete.");
    console.log(`Invoice total net KG: ${invoiceTotalNetWeightKG}`);
    console.log(`Line net sum KG: ${lineNetWeightSumKG}`);
    console.log(`Net reconciliation: ${netStatus}`);
    console.log(`Invoice total gross KG: ${invoiceTotalGrossWeightKG}`);
    console.log(`Line gross sum KG: ${lineGrossWeightSumKG}`);
    console.log(`Gross reconciliation: ${grossStatus}`);
    console.log(`Validation flags: ${validationFlags.length}`);
  } catch (error) {
    console.error("Synthetic weight reconciliation failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();