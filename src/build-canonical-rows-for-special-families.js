const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const OUTPUT_SCHEMA = "canonical_invoice_line_items_v2026_special_family_parsers";

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

const jobs = [
  {
    name: "sample-commercial-invoice-004",
    family: "solstice_customs_invoice_iso_tank",
    inputFile: path.join("ocr", "sample-commercial-invoice-004-tesseract-ocr.txt"),
    jsonOutputFile: "sample-commercial-invoice-004-special-family-canonical-lines.json",
    csvOutputFile: "sample-commercial-invoice-004-special-family-canonical-lines.csv",
    expectedRows: 2
  },
  {
    name: "sample-commercial-invoice-005",
    family: "navin_india_commercial_invoice_kg_rate",
    inputFile: path.join("ocr", "sample-commercial-invoice-005-tesseract-ocr.txt"),
    jsonOutputFile: "sample-commercial-invoice-005-special-family-canonical-lines.json",
    csvOutputFile: "sample-commercial-invoice-005-special-family-canonical-lines.csv",
    expectedRows: 1
  }
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readTextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    .replace(/KGS\./gi, "")
    .replace(/KGS/gi, "")
    .replace(/KG/gi, "")
    .replace(/EA/gi, "")
    .replace(/\$/g, "")
    .replace(/[{}\[\]]/g, "")
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

function extractFirstMatch(text, patterns, fallback = "N/A") {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match && match[1] !== undefined && match[1] !== null) {
      return String(match[1]).trim();
    }
  }

  return fallback;
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

function validateCanonicalRows(rows, expectedRows) {
  const validationFlags = [];

  if (rows.length !== expectedRows) {
    validationFlags.push({
      field: "rowCount",
      row: 0,
      issue: `Expected ${expectedRows} rows but found ${rows.length}.`,
      severity: "warning"
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    for (const column of canonicalColumns) {
      if (!(column in row)) {
        validationFlags.push({
          field: column,
          row: rowNumber,
          issue: "Required canonical column is missing.",
          severity: "error"
        });
      }
    }

    if (row.LineNo === "N/A") {
      validationFlags.push({
        field: "LineNo",
        row: rowNumber,
        issue: "Line number is missing.",
        severity: "error"
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

    if (row.Description === "N/A") {
      validationFlags.push({
        field: "Description",
        row: rowNumber,
        issue: "Description is missing.",
        severity: "warning"
      });
    }

    if (row.Unit === "N/A") {
      validationFlags.push({
        field: "Unit",
        row: rowNumber,
        issue: "Unit is missing.",
        severity: "warning"
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

    if (row.UnitPriceUSD === "N/A") {
      validationFlags.push({
        field: "UnitPriceUSD",
        row: rowNumber,
        issue: "Unit price is missing.",
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
          row: rowNumber,
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
        row: rowNumber,
        issue: `NetWeightKG ${row.NetWeightKG} is greater than GrossWeightKG ${row.GrossWeightKG}.`,
        severity: "error"
      });
    }
  });

  return validationFlags;
}

function parseSolsticeCustomsInvoice(text) {
  const normalized = normalizeText(text);

  const invoiceNumber = extractFirstMatch(normalized, [
    /Invoice No\.\s+Invoice Date\s+Solstice Ref\.No\s+Customer PO No\.\s*\n\s*([A-Z0-9-]+)/i
  ]);

  const invoiceDate = extractFirstMatch(normalized, [
    /Invoice No\.\s+Invoice Date\s+Solstice Ref\.No\s+Customer PO No\.\s*\n\s*[A-Z0-9-]+\s+([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})/i
  ]);

  const customerPo = extractFirstMatch(normalized, [
    /Invoice No\.\s+Invoice Date\s+Solstice Ref\.No\s+Customer PO No\.\s*\n\s*[A-Z0-9-]+\s+[0-9.]+\s+([A-Z0-9-]+)/i
  ]);

  const orderNumber = extractFirstMatch(normalized, [
    /Payment Terms\s+Customer No\.\s+Solstice Order No\.\s+Order Date\s+Pro Number\s*\n\s*[A-Za-z]+\s+[0-9]+\s+([0-9]+)/i
  ]);

  const orderDate = extractFirstMatch(normalized, [
    /Payment Terms\s+Customer No\.\s+Solstice Order No\.\s+Order Date\s+Pro Number\s*\n\s*[A-Za-z]+\s+[0-9]+\s+[0-9]+\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i
  ]);

  const countryOfOrigin = extractFirstMatch(
    normalized,
    [
      /\ncoo\s+Freight Terms\s+Truck\/Car No\.\s+Shipped From\s*\n\s*([A-Z]{2,3})\s+/i
    ],
    "USA"
  );

  const shippedFrom = extractFirstMatch(normalized, [
    /\ncoo\s+Freight Terms\s+Truck\/Car No\.\s+Shipped From\s*\n\s*[A-Z]{2,3}\s+FOB\s+\(Int'l Ocean\)\s+([^\n]+)/i
  ]);

  const containerNumber = extractFirstMatch(normalized, [
    /Package Type\s*\n\s*([A-Z]{4}[0-9]{7})/i
  ]);

  const totalAmount = normalizeNumberOrNA(
    extractFirstMatch(normalized, [
      /Total\s+\$?([\d,.]+)/i
    ])
  );

  const rows = [];

  const customsValueMatch = normalized.match(/\n1\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i);
  const isoTankLineMatch = normalized.match(/\n(10305599)\s+(T50\s+ISO\s+TANK)/i);

  if (customsValueMatch || isoTankLineMatch) {
    rows.push({
      LineNo: 1,
      ProductNumber: isoTankLineMatch ? isoTankLineMatch[1] : "10305599",
      Description: isoTankLineMatch ? isoTankLineMatch[2] : "T50 ISO TANK",
      Unit: "EA",
      Quantity: 1,
      UnitPriceUSD: customsValueMatch ? normalizeNumberOrNA(customsValueMatch[1]) : "N/A",
      LineAmountUSD: customsValueMatch ? normalizeNumberOrNA(customsValueMatch[2]) : "N/A",
      CommodityCode: "N/A",
      CountryOfOrigin: countryOfOrigin,
      DeliveryNote: "N/A",
      ShipmentNumber: containerNumber,
      OrderNumber: orderNumber,
      NetWeightKG: "N/A",
      GrossWeightKG: "N/A"
    });
  }

  const residualMatch = normalized.match(
    /(10641585)\s+(GENETRON\s+125\s+ISO\s+TANK[^\n]*?)\s*([0-9,.\}\]]+)\s*KG\s+\$?([\d,.]+)\s+\$?([\d,.]+)/i
  );

  if (residualMatch) {
    const rawQuantity = residualMatch[3].replace(/[}\]]/g, "");

    rows.push({
      LineNo: 2,
      ProductNumber: residualMatch[1],
      Description: residualMatch[2].replace(/[}\]]/g, "").trim(),
      Unit: "KG",
      Quantity: normalizeNumberOrNA(rawQuantity),
      UnitPriceUSD: normalizeNumberOrNA(residualMatch[4]),
      LineAmountUSD: normalizeNumberOrNA(residualMatch[5]),
      CommodityCode: "N/A",
      CountryOfOrigin: countryOfOrigin,
      DeliveryNote: "N/A",
      ShipmentNumber: containerNumber,
      OrderNumber: orderNumber,
      NetWeightKG: normalizeNumberOrNA(rawQuantity),
      GrossWeightKG: "N/A"
    });
  }

  return {
    invoiceMetadata: {
      invoiceNumber,
      invoiceDate,
      customerPo,
      orderNumber,
      orderDate,
      countryOfOrigin,
      shippedFrom,
      containerNumber,
      totalAmount
    },
    rows
  };
}

function parseNavinIndiaCommercialInvoice(text) {
  const normalized = normalizeText(text);

  const invoiceNumber = extractFirstMatch(normalized, [
    /CIN No\.[^\n]*\s+([A-Z]{2}[0-9]{10})\s*\/\s*[0-9.]+/i,
    /Invoice No\.?\s*&?\s*Date[\s\S]{0,160}?([A-Z]{2}[0-9]{10})\s*\/\s*[0-9.]+/i
  ]);

  const invoiceDate = extractFirstMatch(normalized, [
    /CIN No\.[^\n]*\s+[A-Z]{2}[0-9]{10}\s*\/\s*([0-9.]+)/i,
    /Invoice No\.?\s*&?\s*Date[\s\S]{0,160}?[A-Z]{2}[0-9]{10}\s*\/\s*([0-9.]+)/i
  ]);

  const salesOrderNumber = extractFirstMatch(normalized, [
    /CIN No\.[^\n]*\s+[A-Z]{2}[0-9]{10}\s*\/\s*[0-9.]+\s+([0-9]{6,})\s*\/\s*[0-9.]+/i
  ]);

  const buyerOrderNumber = extractFirstMatch(normalized, [
    /Buyer's Order No\s*&\s*Date\s*\n?.*?([0-9]{8,})\s*\/\s*[0-9.]+/i,
    /Navin Fluorine Advanced Sciences Limited\s+([0-9]{8,})\s*\/\s*[0-9.]+/i
  ]);

  const countryOfOrigin = extractFirstMatch(
    normalized,
    [
      /Country of Origin of Goods\s+Country of Final Destination\s*\n\s*([A-Z]+)/i
    ],
    "INDIA"
  );

  const containerNumber = extractFirstMatch(normalized, [
    /\n([A-Z]{4}[0-9]{7})\s+\d+\s+X\s+[\d,.]+\s+KGS/i
  ]);

  const hsnCode = extractFirstMatch(normalized, [
    /HSN\.?CODE\s*:\s*([0-9]+)/i
  ]);

  const vessel = extractFirstMatch(normalized, [
    /Vessel \/ Flight No\s+Port of Loading[^\n]*\n\s*([A-Z0-9\s/.-]+?)\s+HAZIRA PORT/i
  ]);

  const totalAmount = normalizeNumberOrNA(
    extractFirstMatch(normalized, [
      /FCA Total USD\s*([\d,.]+)/i,
      /Total USD\s*([\d,.]+)/i
    ])
  );

  const rowMatch = normalized.match(
    /\n([A-Z]{4}[0-9]{7})\s+(\d+)\s+X\s+([\d,.]+)\s+KGS\.?\s*\|?\s*(.+?)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s*\n/i
  );

  const netWeight = extractFirstMatch(normalized, [
    /Nett Wt\.\s*\n?\s*([0-9,.]+)/i,
    /Nett Wt\.\s*([0-9,.]+)/i
  ]);

  const grossWeight = extractFirstMatch(normalized, [
    /Gross Wt\.\s*\n?\s*([0-9,.]+)/i,
    /Gross Wt\.\s*([0-9,.]+)/i
  ]);

  const rows = [];

  if (rowMatch) {
    const descriptionLineOne = rowMatch[4]
      .replace(/\[\]/g, "")
      .replace(/\|/g, "")
      .trim();

    const descriptionLineTwo = /FILLED IN ISO TANK/i.test(normalized)
      ? "FILLED IN ISO TANK"
      : "";

    const descriptionLineThree = vessel !== "N/A" ? vessel : "";

    const descriptionParts = [
      descriptionLineOne,
      descriptionLineTwo,
      hsnCode !== "N/A" ? `HSN.CODE: ${hsnCode}` : "",
      descriptionLineThree
    ].filter((part) => part && part.trim().length > 0);

    rows.push({
      LineNo: 1,
      ProductNumber: containerNumber,
      Description: descriptionParts.join(" ").replace(/\s+/g, " ").trim(),
      Unit: "KG",
      Quantity: normalizeNumberOrNA(rowMatch[5]),
      UnitPriceUSD: normalizeNumberOrNA(rowMatch[6]),
      LineAmountUSD: normalizeNumberOrNA(rowMatch[7]),
      CommodityCode: hsnCode,
      CountryOfOrigin: countryOfOrigin,
      DeliveryNote: "N/A",
      ShipmentNumber: containerNumber,
      OrderNumber: buyerOrderNumber,
      NetWeightKG: normalizeNumberOrNA(netWeight),
      GrossWeightKG: normalizeNumberOrNA(grossWeight)
    });
  }

  return {
    invoiceMetadata: {
      invoiceNumber,
      invoiceDate,
      salesOrderNumber,
      buyerOrderNumber,
      countryOfOrigin,
      containerNumber,
      hsnCode,
      vessel,
      totalAmount
    },
    rows
  };
}

function runJob(job) {
  const inputPath = path.join(projectRoot, job.inputFile);
  const jsonOutputPath = path.join(projectRoot, "outputs", job.jsonOutputFile);
  const csvOutputPath = path.join(projectRoot, "outputs", job.csvOutputFile);

  const text = readTextFile(inputPath);

  let parsed;

  if (job.family === "solstice_customs_invoice_iso_tank") {
    parsed = parseSolsticeCustomsInvoice(text);
  } else if (job.family === "navin_india_commercial_invoice_kg_rate") {
    parsed = parseNavinIndiaCommercialInvoice(text);
  } else {
    throw new Error(`Unsupported family: ${job.family}`);
  }

  const validationFlags = validateCanonicalRows(parsed.rows, job.expectedRows);

  const output = {
    metadata: {
      outputSchema: OUTPUT_SCHEMA,
      jobName: job.name,
      family: job.family,
      inputFile: job.inputFile,
      jsonOutputFile: job.jsonOutputFile,
      csvOutputFile: job.csvOutputFile,
      expectedRows: job.expectedRows,
      actualRows: parsed.rows.length,
      generatedAt: new Date().toISOString(),
      invoiceMetadata: parsed.invoiceMetadata
    },
    canonicalColumns,
    canonicalRows: parsed.rows,
    validation: {
      rowCount: parsed.rows.length,
      expectedRows: job.expectedRows,
      validationFlagCount: validationFlags.length,
      validationFlags
    }
  };

  writeJsonFile(jsonOutputPath, output);
  fs.writeFileSync(csvOutputPath, convertRowsToCsv(parsed.rows), "utf8");

  console.log("------------------------------------------------------------");
  console.log(`Built special-family canonical rows: ${job.name}`);
  console.log(`Family: ${job.family}`);
  console.log(`Input: ${inputPath}`);
  console.log(`JSON output: ${jsonOutputPath}`);
  console.log(`CSV output: ${csvOutputPath}`);
  console.log(`Expected rows: ${job.expectedRows}`);
  console.log(`Actual rows: ${parsed.rows.length}`);
  console.log(`Validation flags: ${validationFlags.length}`);

  return output;
}

function main() {
  try {
    ensureDirectoryExists(path.join(projectRoot, "outputs"));

    const results = [];

    for (const job of jobs) {
      const result = runJob(job);
      results.push(result);
    }

    const summary = {
      outputSchema: OUTPUT_SCHEMA,
      generatedAt: new Date().toISOString(),
      jobCount: results.length,
      jobs: results.map((result) => {
        return {
          jobName: result.metadata.jobName,
          family: result.metadata.family,
          expectedRows: result.metadata.expectedRows,
          actualRows: result.metadata.actualRows,
          validationFlagCount: result.validation.validationFlagCount,
          jsonOutputFile: result.metadata.jsonOutputFile,
          csvOutputFile: result.metadata.csvOutputFile,
          invoiceMetadata: result.metadata.invoiceMetadata
        };
      })
    };

    const summaryPath = path.join(
      projectRoot,
      "outputs",
      "special-family-canonical-lines-summary.json"
    );

    writeJsonFile(summaryPath, summary);

    console.log("------------------------------------------------------------");
    console.log("All special-family canonical row jobs complete.");
    console.log(`Summary saved to: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("Special-family canonical row build failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();