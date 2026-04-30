const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const canonicalInputPath = path.join(projectRoot, "outputs", "synthetic-commercial-invoice-001-canonical-lines.json");
const weightInputPath = path.join(projectRoot, "outputs", "synthetic-commercial-invoice-001-weight-reconciliation.json");

const masterJsonOutputPath = path.join(projectRoot, "outputs", "master-canonical-invoice-lines.json");
const masterCsvOutputPath = path.join(projectRoot, "outputs", "master-canonical-invoice-lines.csv");
const masterValidationCsvOutputPath = path.join(projectRoot, "outputs", "master-validation-flags.csv");

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

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function validationFlagsToCsv(flags) {
  const columns = [
    "sourceFile",
    "sourceParser",
    "invoiceFamily",
    "invoiceNumber",
    "invoiceDate",
    "shipmentNumber",
    "field",
    "row",
    "severity",
    "issue"
  ];

  const header = columns.join(",");
  const body = flags
    .map((flag) => columns.map((column) => escapeCsvValue(flag[column])).join(","))
    .join("\n");

  return `${header}\n${body}\n`;
}

function main() {
  try {
    const canonicalData = readJson(canonicalInputPath);
    const weightData = readJson(weightInputPath);

    const masterRows = canonicalData.canonicalRows;

    const sourceValidationFlags = weightData.validation.validationFlags.map((flag) => {
      return {
        sourceFile: "synthetic-commercial-invoice-001",
        sourceParser: "public_demo_parser",
        invoiceFamily: masterRows[0]?.InvoiceFamily || "N/A",
        invoiceNumber: masterRows[0]?.InvoiceNumber || "N/A",
        invoiceDate: masterRows[0]?.InvoiceDate || "N/A",
        shipmentNumber: masterRows[0]?.ShipmentNumber || "N/A",
        field: flag.field,
        row: flag.row,
        severity: flag.severity,
        issue: flag.issue
      };
    });

    const lineAmountGrandTotalUSD = Number(
      masterRows
        .reduce((sum, row) => {
          return typeof row.LineAmountUSD === "number" ? sum + row.LineAmountUSD : sum;
        }, 0)
        .toFixed(2)
    );

    const netWeightGrandTotalKG = Number(
      masterRows
        .reduce((sum, row) => {
          return typeof row.NetWeightKG === "number" ? sum + row.NetWeightKG : sum;
        }, 0)
        .toFixed(3)
    );

    const grossWeightGrandTotalKG = Number(
      masterRows
        .reduce((sum, row) => {
          return typeof row.GrossWeightKG === "number" ? sum + row.GrossWeightKG : sum;
        }, 0)
        .toFixed(3)
    );

    const masterOutput = {
      outputSchema: "public_demo_master_canonical_output_v1",
      generatedAt: new Date().toISOString(),
      metadata: {
        sourceJobCount: 1,
        invoiceCount: 1,
        rowCount: masterRows.length,
        lineAmountGrandTotalUSD,
        netWeightGrandTotalKG,
        grossWeightGrandTotalKG,
        sourceValidationFlagCount: sourceValidationFlags.length,
        masterValidationFlagCount: 0,
        totalValidationFlagCount: sourceValidationFlags.length,
        hasValidationErrors: sourceValidationFlags.length > 0
      },
      canonicalColumns,
      masterRows,
      validation: {
        sourceValidationFlagCount: sourceValidationFlags.length,
        masterValidationFlagCount: 0,
        totalValidationFlagCount: sourceValidationFlags.length,
        validationFlags: sourceValidationFlags
      }
    };

    fs.writeFileSync(masterJsonOutputPath, JSON.stringify(masterOutput, null, 2), "utf8");
    fs.writeFileSync(masterCsvOutputPath, rowsToCsv(masterRows), "utf8");
    fs.writeFileSync(masterValidationCsvOutputPath, validationFlagsToCsv(sourceValidationFlags), "utf8");

    console.log("------------------------------------------------------------");
    console.log("Synthetic master output created.");
    console.log(`Rows: ${masterRows.length}`);
    console.log(`Line amount grand total USD: ${lineAmountGrandTotalUSD}`);
    console.log(`Source validation flags carried forward: ${sourceValidationFlags.length}`);
    console.log(`Master JSON: ${masterJsonOutputPath}`);
    console.log(`Master CSV: ${masterCsvOutputPath}`);
    console.log(`Validation CSV: ${masterValidationCsvOutputPath}`);
  } catch (error) {
    console.error("Synthetic master output build failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();