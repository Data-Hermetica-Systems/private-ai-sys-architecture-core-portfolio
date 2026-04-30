const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const OUTPUT_SCHEMA = "canonical_invoice_line_items_v2026_deterministic_segments";

const segmentJobs = [
  {
    name: "sample-commercial-invoice-001",
    inputFile: path.join("ocr", "sample-commercial-invoice-001-segmented-items.json"),
    jsonOutputFile: "sample-commercial-invoice-001-deterministic-canonical-lines.json",
    csvOutputFile: "sample-commercial-invoice-001-deterministic-canonical-lines.csv",
    expectedRows: 47
  },
  {
    name: "sample-commercial-invoice-002",
    inputFile: path.join("ocr", "sample-commercial-invoice-002-segmented-items.json"),
    jsonOutputFile: "sample-commercial-invoice-002-deterministic-canonical-lines.json",
    csvOutputFile: "sample-commercial-invoice-002-deterministic-canonical-lines.csv",
    expectedRows: 2
  },
  {
    name: "sample-commercial-invoice-003",
    inputFile: path.join("ocr", "sample-commercial-invoice-003-segmented-items.json"),
    jsonOutputFile: "sample-commercial-invoice-003-deterministic-canonical-lines.json",
    csvOutputFile: "sample-commercial-invoice-003-deterministic-canonical-lines.csv",
    expectedRows: 6
  }
];

const canonicalColumns = [
  "LineNo",
  "ProductNumber",
  "Description",
  "Unit",
  "Quantity",
  "UnitPriceUSD",
  "LineAmountUSD",
  "CommodityCode",
  "CountryOfOrigin",
  "DeliveryNote",
  "ShipmentNumber",
  "OrderNumber",
  "NetWeightKG",
  "GrossWeightKG"
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeStringOrNA(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  const text = String(value).trim();

  if (text.length === 0) {
    return "N/A";
  }

  return text;
}

function normalizeEuropeanNumberString(value) {
  const raw = String(value)
    .replace(/USD/gi, "")
    .replace(/KG/gi, "")
    .replace(/EA/gi, "")
    .replace(/\$/g, "")
    .trim();

  if (raw.toUpperCase() === "N/A" || raw.length === 0) {
    return "N/A";
  }

  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(raw)) {
    return raw.replace(/\./g, "").replace(",", ".");
  }

  if (/^\d+,\d+$/.test(raw)) {
    return raw.replace(",", ".");
  }

  return raw.replace(/,/g, "");
}

function normalizeNumberOrNA(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeEuropeanNumberString(value);

  if (normalized === "N/A") {
    return "N/A";
  }

  const parsed = Number(normalized);

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return "N/A";
}

function normalizeIntegerOrNA(value) {
  const normalized = normalizeNumberOrNA(value);

  if (typeof normalized === "number") {
    return Number.parseInt(normalized, 10);
  }

  return "N/A";
}

function cleanDescription(description) {
  const text = normalizeStringOrNA(description);

  if (text === "N/A") {
    return "N/A";
  }

  return text
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .trim();
}

function buildCanonicalRow(segment) {
  const fields = segment.parsedFields || {};

  return {
    LineNo: normalizeIntegerOrNA(fields.LineNo),
    ProductNumber: normalizeStringOrNA(fields.ProductNumber),
    Description: cleanDescription(fields.Description),
    Unit: normalizeStringOrNA(fields.Unit),
    Quantity: normalizeNumberOrNA(fields.Quantity),
    UnitPriceUSD: normalizeNumberOrNA(fields.UnitPriceUSD),
    LineAmountUSD: normalizeNumberOrNA(fields.LineAmountUSD),
    CommodityCode: normalizeStringOrNA(fields.CommodityCode),
    CountryOfOrigin: normalizeStringOrNA(fields.CountryOfOrigin),
    DeliveryNote: normalizeStringOrNA(fields.DeliveryNote),
    ShipmentNumber: normalizeStringOrNA(fields.ShipmentNumber),
    OrderNumber: normalizeStringOrNA(fields.OrderNumber),
    NetWeightKG: normalizeNumberOrNA(fields.NetWeightKG),
    GrossWeightKG: normalizeNumberOrNA(fields.GrossWeightKG)
  };
}

function validateCanonicalRows(canonicalRows, expectedRows) {
  const validationFlags = [];
  const seenLineNumbers = new Set();

  if (canonicalRows.length !== expectedRows) {
    validationFlags.push({
      field: "rowCount",
      row: 0,
      issue: `Expected ${expectedRows} rows but found ${canonicalRows.length}.`,
      severity: "warning"
    });
  }

  canonicalRows.forEach((row, index) => {
    const rowIndex = index + 1;

    for (const column of canonicalColumns) {
      if (!(column in row)) {
        validationFlags.push({
          field: column,
          row: rowIndex,
          issue: "Required canonical column is missing.",
          severity: "error"
        });
      }
    }

    if (row.LineNo === "N/A") {
      validationFlags.push({
        field: "LineNo",
        row: rowIndex,
        issue: "Line number is missing.",
        severity: "error"
      });
    }

    if (row.LineNo !== "N/A") {
      if (seenLineNumbers.has(row.LineNo)) {
        validationFlags.push({
          field: "LineNo",
          row: rowIndex,
          issue: `Duplicate line number detected: ${row.LineNo}.`,
          severity: "error"
        });
      }

      seenLineNumbers.add(row.LineNo);
    }

    if (row.ProductNumber === "N/A") {
      validationFlags.push({
        field: "ProductNumber",
        row: rowIndex,
        issue: "Product number is missing.",
        severity: "error"
      });
    }

    if (row.Description === "N/A") {
      validationFlags.push({
        field: "Description",
        row: rowIndex,
        issue: "Description is missing.",
        severity: "warning"
      });
    }

    if (row.Unit === "N/A") {
      validationFlags.push({
        field: "Unit",
        row: rowIndex,
        issue: "Unit is missing.",
        severity: "warning"
      });
    }

    if (row.Quantity === "N/A") {
      validationFlags.push({
        field: "Quantity",
        row: rowIndex,
        issue: "Quantity is missing.",
        severity: "error"
      });
    }

    if (row.UnitPriceUSD === "N/A") {
      validationFlags.push({
        field: "UnitPriceUSD",
        row: rowIndex,
        issue: "Unit price is missing.",
        severity: "error"
      });
    }

    if (row.LineAmountUSD === "N/A") {
      validationFlags.push({
        field: "LineAmountUSD",
        row: rowIndex,
        issue: "Line amount is missing.",
        severity: "error"
      });
    }

    if (row.CommodityCode === "N/A") {
      validationFlags.push({
        field: "CommodityCode",
        row: rowIndex,
        issue: "Commodity code is missing.",
        severity: "warning"
      });
    }

    if (row.CountryOfOrigin === "N/A") {
      validationFlags.push({
        field: "CountryOfOrigin",
        row: rowIndex,
        issue: "Country of origin is missing.",
        severity: "warning"
      });
    }

    if (
  typeof row.Quantity === "number" &&
  typeof row.UnitPriceUSD === "number" &&
  typeof row.LineAmountUSD === "number"
) {
  const expectedLineAmount = Number((row.Quantity * row.UnitPriceUSD).toFixed(2));
  const actualLineAmount = Number(row.LineAmountUSD.toFixed(2));
  const difference = Math.abs(expectedLineAmount - actualLineAmount);

  const absoluteToleranceUSD = 0.5;
  const relativeTolerancePercent = 0.0005;
  const relativeToleranceUSD = Math.abs(actualLineAmount) * relativeTolerancePercent;
  const allowedToleranceUSD = Math.max(absoluteToleranceUSD, relativeToleranceUSD);

  if (difference > allowedToleranceUSD) {
    validationFlags.push({
      field: "LineAmountUSD",
      row: rowIndex,
      issue: `LineAmountUSD ${actualLineAmount} does not match Quantity × UnitPriceUSD ${expectedLineAmount}. Difference ${difference.toFixed(2)} exceeds allowed tolerance ${allowedToleranceUSD.toFixed(2)}.`,
      severity: "warning"
    });
  }
}

    if (
      typeof row.NetWeightKG === "number" &&
      typeof row.GrossWeightKG === "number" &&
      row.NetWeightKG > row.GrossWeightKG
    ) {
      validationFlags.push({
        field: "GrossWeightKG",
        row: rowIndex,
        issue: `NetWeightKG ${row.NetWeightKG} is greater than GrossWeightKG ${row.GrossWeightKG}.`,
        severity: "error"
      });
    }
  });

  return validationFlags;
}

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function convertRowsToCsv(rows) {
  const header = canonicalColumns.join(",");

  const body = rows
    .map((row) => {
      return canonicalColumns
        .map((column) => escapeCsvValue(row[column]))
        .join(",");
    })
    .join("\n");

  return `${header}\n${body}\n`;
}

function runCanonicalBuildJob(job) {
  const inputPath = path.join(projectRoot, job.inputFile);
  const jsonOutputPath = path.join(projectRoot, "outputs", job.jsonOutputFile);
  const csvOutputPath = path.join(projectRoot, "outputs", job.csvOutputFile);

  const segmentedData = readJsonFile(inputPath);
  const segments = Array.isArray(segmentedData.segments) ? segmentedData.segments : [];

  const canonicalRows = segments.map(buildCanonicalRow);
  const validationFlags = validateCanonicalRows(canonicalRows, job.expectedRows);

  const output = {
    metadata: {
      outputSchema: OUTPUT_SCHEMA,
      jobName: job.name,
      inputFile: job.inputFile,
      jsonOutputFile: job.jsonOutputFile,
      csvOutputFile: job.csvOutputFile,
      expectedRows: job.expectedRows,
      actualRows: canonicalRows.length,
      invoiceNumber: segmentedData.metadata?.invoiceNumber || "N/A",
      invoiceDate: segmentedData.metadata?.invoiceDate || "N/A",
      shipmentNumber: segmentedData.metadata?.shipmentNumber || "N/A",
      generatedAt: new Date().toISOString()
    },
    canonicalColumns,
    canonicalRows,
    validation: {
      rowCount: canonicalRows.length,
      expectedRows: job.expectedRows,
      validationFlagCount: validationFlags.length,
      validationFlags
    }
  };

  writeJsonFile(jsonOutputPath, output);
  fs.writeFileSync(csvOutputPath, convertRowsToCsv(canonicalRows), "utf8");

  console.log("------------------------------------------------------------");
  console.log(`Built deterministic canonical rows: ${job.name}`);
  console.log(`Input: ${inputPath}`);
  console.log(`JSON output: ${jsonOutputPath}`);
  console.log(`CSV output: ${csvOutputPath}`);
  console.log(`Expected rows: ${job.expectedRows}`);
  console.log(`Actual rows: ${canonicalRows.length}`);
  console.log(`Validation flags: ${validationFlags.length}`);

  return output;
}

function main() {
  try {
    ensureDirectoryExists(path.join(projectRoot, "outputs"));

    const results = [];

    for (const job of segmentJobs) {
      const result = runCanonicalBuildJob(job);
      results.push(result);
    }

    const summary = {
      outputSchema: OUTPUT_SCHEMA,
      generatedAt: new Date().toISOString(),
      jobCount: results.length,
      jobs: results.map((result) => {
        return {
          jobName: result.metadata.jobName,
          invoiceNumber: result.metadata.invoiceNumber,
          invoiceDate: result.metadata.invoiceDate,
          shipmentNumber: result.metadata.shipmentNumber,
          expectedRows: result.metadata.expectedRows,
          actualRows: result.metadata.actualRows,
          validationFlagCount: result.validation.validationFlagCount,
          jsonOutputFile: result.metadata.jsonOutputFile,
          csvOutputFile: result.metadata.csvOutputFile
        };
      })
    };

    const summaryPath = path.join(
      projectRoot,
      "outputs",
      "deterministic-canonical-lines-summary.json"
    );

    writeJsonFile(summaryPath, summary);

    console.log("------------------------------------------------------------");
    console.log("All deterministic canonical row jobs complete.");
    console.log(`Summary saved to: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("Deterministic canonical row build failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();