const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const OUTPUT_SCHEMA = "canonical_invoice_line_items_v2026_master_output_with_source_validation";

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

const sourceJobs = [
  {
    sourceParser: "deterministic_segments",
    invoiceFamily: "honeywell_multiline_proforma",
    inputFile: path.join("outputs", "sample-commercial-invoice-001-deterministic-canonical-lines.json")
  },
  {
    sourceParser: "deterministic_segments",
    invoiceFamily: "honeywell_multiline_proforma",
    inputFile: path.join("outputs", "sample-commercial-invoice-002-deterministic-canonical-lines.json")
  },
  {
    sourceParser: "deterministic_segments",
    invoiceFamily: "honeywell_multiline_proforma",
    inputFile: path.join("outputs", "sample-commercial-invoice-003-deterministic-canonical-lines.json")
  },
  {
    sourceParser: "special_family_parser",
    invoiceFamily: "solstice_customs_invoice_iso_tank",
    inputFile: path.join("outputs", "sample-commercial-invoice-004-special-family-canonical-lines.json")
  },
  {
    sourceParser: "special_family_parser",
    invoiceFamily: "navin_india_commercial_invoice_kg_rate",
    inputFile: path.join("outputs", "sample-commercial-invoice-005-special-family-canonical-lines.json")
  }
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readJsonFile(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Input file not found: ${fullPath}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJsonFile(relativePath, data) {
  const fullPath = path.join(projectRoot, relativePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeValue(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return value;
}

function getInvoiceMetadata(sourceData, sourceJob) {
  const metadata = sourceData.metadata || {};
  const invoiceMetadata = metadata.invoiceMetadata || {};

  return {
    sourceInvoiceFile: metadata.inputFile || sourceJob.inputFile,
    sourceParser: sourceJob.sourceParser,
    invoiceFamily: metadata.family || sourceJob.invoiceFamily,
    invoiceNumber: normalizeValue(metadata.invoiceNumber || invoiceMetadata.invoiceNumber),
    invoiceDate: normalizeValue(metadata.invoiceDate || invoiceMetadata.invoiceDate),
    shipmentNumber: normalizeValue(
      metadata.shipmentNumber ||
      invoiceMetadata.containerNumber ||
      invoiceMetadata.shipmentNumber
    )
  };
}

function buildMasterRow(sourceJob, sourceData, row) {
  const invoiceMetadata = getInvoiceMetadata(sourceData, sourceJob);

  return {
    SourceInvoiceFile: invoiceMetadata.sourceInvoiceFile,
    SourceParser: invoiceMetadata.sourceParser,
    InvoiceNumber: invoiceMetadata.invoiceNumber,
    InvoiceDate: invoiceMetadata.invoiceDate,
    ShipmentNumber: invoiceMetadata.shipmentNumber,
    InvoiceFamily: invoiceMetadata.invoiceFamily,
    LineNo: normalizeValue(row.LineNo),
    ProductNumber: normalizeValue(row.ProductNumber),
    Description: normalizeValue(row.Description),
    Unit: normalizeValue(row.Unit),
    Quantity: normalizeValue(row.Quantity),
    UnitPriceUSD: normalizeValue(row.UnitPriceUSD),
    LineAmountUSD: normalizeValue(row.LineAmountUSD),
    CommodityCode: normalizeValue(row.CommodityCode),
    CountryOfOrigin: normalizeValue(row.CountryOfOrigin),
    DeliveryNote: normalizeValue(row.DeliveryNote),
    OrderNumber: normalizeValue(row.OrderNumber),
    NetWeightKG: normalizeValue(row.NetWeightKG),
    GrossWeightKG: normalizeValue(row.GrossWeightKG)
  };
}

function getSourceValidationFlags(sourceJob, sourceData) {
  const metadata = getInvoiceMetadata(sourceData, sourceJob);
  const sourceFlags = Array.isArray(sourceData.validation?.validationFlags)
    ? sourceData.validation.validationFlags
    : [];

  return sourceFlags.map((flag) => {
    return {
      sourceFile: sourceJob.inputFile,
      sourceParser: sourceJob.sourceParser,
      invoiceFamily: metadata.invoiceFamily,
      invoiceNumber: metadata.invoiceNumber,
      invoiceDate: metadata.invoiceDate,
      shipmentNumber: metadata.shipmentNumber,
      field: flag.field || "N/A",
      row: flag.row ?? "N/A",
      issue: flag.issue || "N/A",
      severity: flag.severity || "warning"
    };
  });
}

function validateMasterRows(masterRows) {
  const validationFlags = [];

  if (masterRows.length === 0) {
    validationFlags.push({
      field: "masterRows",
      row: 0,
      issue: "No master canonical rows were generated.",
      severity: "error"
    });
  }

  masterRows.forEach((row, index) => {
    const rowNumber = index + 1;

    for (const column of canonicalColumns) {
      if (!(column in row)) {
        validationFlags.push({
          field: column,
          row: rowNumber,
          issue: "Required master column is missing.",
          severity: "error"
        });
      }
    }

    if (row.InvoiceNumber === "N/A") {
      validationFlags.push({
        field: "InvoiceNumber",
        row: rowNumber,
        issue: "Invoice number is missing.",
        severity: "warning"
      });
    }

    if (row.ProductNumber === "N/A") {
      validationFlags.push({
        field: "ProductNumber",
        row: rowNumber,
        issue: "Product number is missing.",
        severity: "error"
      });
    }

    if (row.LineNo === "N/A") {
      validationFlags.push({
        field: "LineNo",
        row: rowNumber,
        issue: "Line number is missing.",
        severity: "error"
      });
    }

    if (row.Quantity === "N/A") {
      validationFlags.push({
        field: "Quantity",
        row: rowNumber,
        issue: "Quantity is missing.",
        severity: "warning"
      });
    }

    if (row.LineAmountUSD === "N/A") {
      validationFlags.push({
        field: "LineAmountUSD",
        row: rowNumber,
        issue: "Line amount is missing.",
        severity: "warning"
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

function convertValidationFlagsToCsv(flags) {
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
    .map((flag) => {
      return columns.map((column) => escapeCsvValue(flag[column])).join(",");
    })
    .join("\n");

  return `${header}\n${body}\n`;
}

function groupByInvoice(masterRows) {
  const invoiceMap = new Map();

  for (const row of masterRows) {
    const key = `${row.InvoiceNumber}::${row.SourceInvoiceFile}`;

    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, {
        invoiceNumber: row.InvoiceNumber,
        invoiceDate: row.InvoiceDate,
        shipmentNumber: row.ShipmentNumber,
        invoiceFamily: row.InvoiceFamily,
        sourceParser: row.SourceParser,
        sourceInvoiceFile: row.SourceInvoiceFile,
        rowCount: 0,
        lineAmountTotalUSD: 0,
        netWeightTotalKG: 0,
        grossWeightTotalKG: 0
      });
    }

    const invoice = invoiceMap.get(key);
    invoice.rowCount += 1;

    if (typeof row.LineAmountUSD === "number") {
      invoice.lineAmountTotalUSD = Number((invoice.lineAmountTotalUSD + row.LineAmountUSD).toFixed(2));
    }

    if (typeof row.NetWeightKG === "number") {
      invoice.netWeightTotalKG = Number((invoice.netWeightTotalKG + row.NetWeightKG).toFixed(3));
    }

    if (typeof row.GrossWeightKG === "number") {
      invoice.grossWeightTotalKG = Number((invoice.grossWeightTotalKG + row.GrossWeightKG).toFixed(3));
    }
  }

  return Array.from(invoiceMap.values());
}

function main() {
  try {
    ensureDirectoryExists(path.join(projectRoot, "outputs"));

    const masterRows = [];
    const sourceFileSummaries = [];
    const sourceValidationFlags = [];

    for (const sourceJob of sourceJobs) {
      const sourceData = readJsonFile(sourceJob.inputFile);
      const sourceRows = Array.isArray(sourceData.canonicalRows)
        ? sourceData.canonicalRows
        : [];

      sourceRows.forEach((row) => {
        masterRows.push(buildMasterRow(sourceJob, sourceData, row));
      });

      const sourceFlags = getSourceValidationFlags(sourceJob, sourceData);
      sourceValidationFlags.push(...sourceFlags);

      sourceFileSummaries.push({
        inputFile: sourceJob.inputFile,
        sourceParser: sourceJob.sourceParser,
        invoiceFamily: sourceJob.invoiceFamily,
        rowCount: sourceRows.length,
        sourceValidationFlagCount: sourceData.validation?.validationFlagCount || 0,
        carriedForwardValidationFlagCount: sourceFlags.length,
        hasWeightReconciliation: Boolean(sourceData.weightReconciliation),
        weightReconciliationStatus: sourceData.weightReconciliation
          ? {
              net: sourceData.weightReconciliation.net?.status || "N/A",
              gross: sourceData.weightReconciliation.gross?.status || "N/A",
              invoiceTotalNetWeightKG: sourceData.weightReconciliation.invoiceTotals?.totalNetWeightKG ?? "N/A",
              invoiceTotalGrossWeightKG: sourceData.weightReconciliation.invoiceTotals?.totalGrossWeightKG ?? "N/A",
              afterNetWeightSumKG: sourceData.weightReconciliation.after?.netWeightSumKG ?? "N/A",
              afterGrossWeightSumKG: sourceData.weightReconciliation.after?.grossWeightSumKG ?? "N/A"
            }
          : null
      });
    }

    const masterValidationFlags = validateMasterRows(masterRows);
    const allValidationFlags = [
      ...masterValidationFlags.map((flag) => {
        return {
          sourceFile: "master-canonical-invoice-lines",
          sourceParser: "master_output_validator",
          invoiceFamily: "master",
          invoiceNumber: "N/A",
          invoiceDate: "N/A",
          shipmentNumber: "N/A",
          field: flag.field || "N/A",
          row: flag.row ?? "N/A",
          issue: flag.issue || "N/A",
          severity: flag.severity || "warning"
        };
      }),
      ...sourceValidationFlags
    ];

    const invoiceSummaries = groupByInvoice(masterRows);

    const lineAmountGrandTotalUSD = Number(
      masterRows
        .reduce((sum, row) => {
          if (typeof row.LineAmountUSD === "number") {
            return sum + row.LineAmountUSD;
          }

          return sum;
        }, 0)
        .toFixed(2)
    );

    const netWeightGrandTotalKG = Number(
      masterRows
        .reduce((sum, row) => {
          if (typeof row.NetWeightKG === "number") {
            return sum + row.NetWeightKG;
          }

          return sum;
        }, 0)
        .toFixed(3)
    );

    const grossWeightGrandTotalKG = Number(
      masterRows
        .reduce((sum, row) => {
          if (typeof row.GrossWeightKG === "number") {
            return sum + row.GrossWeightKG;
          }

          return sum;
        }, 0)
        .toFixed(3)
    );

    const masterOutput = {
      metadata: {
        outputSchema: OUTPUT_SCHEMA,
        generatedAt: new Date().toISOString(),
        sourceJobCount: sourceJobs.length,
        invoiceCount: invoiceSummaries.length,
        rowCount: masterRows.length,
        lineAmountGrandTotalUSD,
        netWeightGrandTotalKG,
        grossWeightGrandTotalKG,
        masterValidationFlagCount: masterValidationFlags.length,
        sourceValidationFlagCount: sourceValidationFlags.length,
        totalValidationFlagCount: allValidationFlags.length,
        hasValidationErrors: allValidationFlags.some((flag) => flag.severity === "error")
      },
      canonicalColumns,
      sourceFileSummaries,
      invoiceSummaries,
      masterRows,
      validation: {
        rowCount: masterRows.length,
        masterValidationFlagCount: masterValidationFlags.length,
        sourceValidationFlagCount: sourceValidationFlags.length,
        totalValidationFlagCount: allValidationFlags.length,
        validationFlags: allValidationFlags
      }
    };

    const jsonOutputFile = path.join("outputs", "master-canonical-invoice-lines.json");
    const csvOutputFile = path.join("outputs", "master-canonical-invoice-lines.csv");
    const validationCsvOutputFile = path.join("outputs", "master-validation-flags.csv");

    writeJsonFile(jsonOutputFile, masterOutput);
    fs.writeFileSync(path.join(projectRoot, csvOutputFile), convertRowsToCsv(masterRows), "utf8");
    fs.writeFileSync(path.join(projectRoot, validationCsvOutputFile), convertValidationFlagsToCsv(allValidationFlags), "utf8");

    console.log("------------------------------------------------------------");
    console.log("Master canonical invoice output created.");
    console.log(`JSON output: ${path.join(projectRoot, jsonOutputFile)}`);
    console.log(`CSV output: ${path.join(projectRoot, csvOutputFile)}`);
    console.log(`Validation CSV output: ${path.join(projectRoot, validationCsvOutputFile)}`);
    console.log(`Source jobs: ${sourceJobs.length}`);
    console.log(`Invoices: ${invoiceSummaries.length}`);
    console.log(`Rows: ${masterRows.length}`);
    console.log(`Line amount grand total USD: ${lineAmountGrandTotalUSD}`);
    console.log(`Net weight grand total KG: ${netWeightGrandTotalKG}`);
    console.log(`Gross weight grand total KG: ${grossWeightGrandTotalKG}`);
    console.log(`Master validation flags: ${masterValidationFlags.length}`);
    console.log(`Source validation flags carried forward: ${sourceValidationFlags.length}`);
    console.log(`Total validation flags: ${allValidationFlags.length}`);
  } catch (error) {
    console.error("Master canonical output build failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();