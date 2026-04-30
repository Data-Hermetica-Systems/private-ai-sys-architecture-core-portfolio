const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const inputPath = path.join(projectRoot, "ocr", "synthetic-commercial-invoice-001-segments.json");
const jsonOutputPath = path.join(projectRoot, "outputs", "synthetic-commercial-invoice-001-canonical-lines.json");
const csvOutputPath = path.join(projectRoot, "outputs", "synthetic-commercial-invoice-001-canonical-lines.csv");
const summaryPath = path.join(projectRoot, "outputs", "demo-canonical-lines-summary.json");

const canonicalColumns = [
  "SourceInvoiceFile",
  "SourceParser",
  "InvoiceNumber",
  "InvoiceDate",
  "ShipmentNumber",
  "InvoiceFamily",
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
  "OrderNumber",
  "NetWeightKG",
  "GrossWeightKG"
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractField(block, label) {
  const pattern = new RegExp(`${label}:\\s*(.+)`, "i");
  const match = block.match(pattern);
  return match ? match[1].trim() : "N/A";
}

function parseMoney(value) {
  if (value === "N/A") {
    return "N/A";
  }

  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : "N/A";
}

function parseNumber(value) {
  if (value === "N/A") {
    return "N/A";
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : "N/A";
}

function parseEuropeanKg(block, label) {
  const pattern = new RegExp(`${label}\\s+([0-9.,]+)\\s*KG`, "i");
  const match = block.match(pattern);

  if (!match) {
    return "N/A";
  }

  const raw = match[1].trim();

  if (raw.includes(",") && !raw.includes(".")) {
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : "N/A";
  }

  if (raw.includes(".") && raw.includes(",")) {
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : "N/A";
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : "N/A";
}

function buildCanonicalRow(segmentData, segment) {
  const block = segment.rawBlock;
  const metadata = segmentData.invoiceMetadata;

  return {
    SourceInvoiceFile: "synthetic-commercial-invoice-001",
    SourceParser: "public_demo_parser",
    InvoiceNumber: metadata.invoiceNumber,
    InvoiceDate: metadata.invoiceDate,
    ShipmentNumber: metadata.shipmentNumber,
    InvoiceFamily: metadata.invoiceFamily,
    LineNo: segment.lineNo,
    ProductNumber: extractField(block, "Product No"),
    Description: extractField(block, "Description"),
    Unit: extractField(block, "Unit"),
    Quantity: parseNumber(extractField(block, "Quantity")),
    UnitPriceUSD: parseMoney(extractField(block, "Unit Price USD")),
    LineAmountUSD: parseMoney(extractField(block, "Line Amount USD")),
    CommodityCode: extractField(block, "Commodity Code"),
    CountryOfOrigin: extractField(block, "Country of Origin"),
    DeliveryNote: extractField(block, "Delivery Note"),
    OrderNumber: "N/A",
    NetWeightKG: parseEuropeanKg(block, "Net weight"),
    GrossWeightKG: parseEuropeanKg(block, "Gross weight")
  };
}

function validateRows(rows, expectedRows) {
  const validationFlags = [];

  if (rows.length !== expectedRows) {
    validationFlags.push({
      field: "rowCount",
      row: "N/A",
      severity: "error",
      issue: `Expected ${expectedRows} rows but found ${rows.length}.`
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    if (row.ProductNumber === "N/A") {
      validationFlags.push({
        field: "ProductNumber",
        row: rowNumber,
        severity: "error",
        issue: "Product number is missing."
      });
    }

    if (typeof row.Quantity === "number" && typeof row.UnitPriceUSD === "number" && typeof row.LineAmountUSD === "number") {
      const expectedAmount = Number((row.Quantity * row.UnitPriceUSD).toFixed(2));
      const difference = Math.abs(expectedAmount - row.LineAmountUSD);

      if (difference > 0.5) {
        validationFlags.push({
          field: "LineAmountUSD",
          row: rowNumber,
          severity: "warning",
          issue: `Line amount ${row.LineAmountUSD} does not match Quantity × UnitPriceUSD ${expectedAmount}.`
        });
      }
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

function rowsToCsv(rows) {
  const header = canonicalColumns.join(",");
  const body = rows
    .map((row) => canonicalColumns.map((column) => escapeCsvValue(row[column])).join(","))
    .join("\n");

  return `${header}\n${body}\n`;
}

function main() {
  try {
    ensureDirectoryExists(path.join(projectRoot, "outputs"));

    const segmentData = readJson(inputPath);
    const canonicalRows = segmentData.segments.map((segment) => buildCanonicalRow(segmentData, segment));

    const validationFlags = validateRows(canonicalRows, 3);

    const output = {
      outputSchema: "public_demo_canonical_invoice_lines_v1",
      generatedAt: new Date().toISOString(),
      metadata: {
        jobName: "synthetic-commercial-invoice-001",
        invoiceNumber: segmentData.invoiceMetadata.invoiceNumber,
        invoiceDate: segmentData.invoiceMetadata.invoiceDate,
        shipmentNumber: segmentData.invoiceMetadata.shipmentNumber,
        expectedRows: 3,
        actualRows: canonicalRows.length,
        validationFlagCount: validationFlags.length
      },
      canonicalColumns,
      canonicalRows,
      validation: {
        validationFlagCount: validationFlags.length,
        validationFlags
      }
    };

    fs.writeFileSync(jsonOutputPath, JSON.stringify(output, null, 2), "utf8");
    fs.writeFileSync(csvOutputPath, rowsToCsv(canonicalRows), "utf8");

    const summary = {
      outputSchema: "public_demo_canonical_lines_summary_v1",
      generatedAt: new Date().toISOString(),
      jobCount: 1,
      jobs: [
        {
          jobName: "synthetic-commercial-invoice-001",
          expectedRows: 3,
          actualRows: canonicalRows.length,
          validationFlagCount: validationFlags.length,
          jsonOutputFile: "synthetic-commercial-invoice-001-canonical-lines.json",
          csvOutputFile: "synthetic-commercial-invoice-001-canonical-lines.csv"
        }
      ]
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

    console.log("------------------------------------------------------------");
    console.log("Synthetic canonical rows created.");
    console.log(`Rows: ${canonicalRows.length}`);
    console.log(`Validation flags: ${validationFlags.length}`);
    console.log(`JSON output: ${jsonOutputPath}`);
    console.log(`CSV output: ${csvOutputPath}`);
  } catch (error) {
    console.error("Synthetic canonical row build failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();