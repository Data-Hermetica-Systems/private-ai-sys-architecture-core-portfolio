const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const WEIGHT_RECONCILIATION_SCHEMA = "invoice_weight_reconciliation_v2026_001";
const EPSILON_KG = 0.001;

const jobs = [
  {
    name: "sample-commercial-invoice-001",
    ocrFile: path.join("ocr", "sample-commercial-invoice-001-tesseract-ocr.txt"),
    jsonFile: path.join("outputs", "sample-commercial-invoice-001-deterministic-canonical-lines.json"),
    csvFile: path.join("outputs", "sample-commercial-invoice-001-deterministic-canonical-lines.csv"),
    diagnosticsFile: path.join("outputs", "sample-commercial-invoice-001-weight-reconciliation.json")
  },
  {
    name: "sample-commercial-invoice-002",
    ocrFile: path.join("ocr", "sample-commercial-invoice-002-tesseract-ocr.txt"),
    jsonFile: path.join("outputs", "sample-commercial-invoice-002-deterministic-canonical-lines.json"),
    csvFile: path.join("outputs", "sample-commercial-invoice-002-deterministic-canonical-lines.csv"),
    diagnosticsFile: path.join("outputs", "sample-commercial-invoice-002-weight-reconciliation.json")
  },
  {
    name: "sample-commercial-invoice-003",
    ocrFile: path.join("ocr", "sample-commercial-invoice-003-tesseract-ocr.txt"),
    jsonFile: path.join("outputs", "sample-commercial-invoice-003-deterministic-canonical-lines.json"),
    csvFile: path.join("outputs", "sample-commercial-invoice-003-deterministic-canonical-lines.csv"),
    diagnosticsFile: path.join("outputs", "sample-commercial-invoice-003-weight-reconciliation.json")
  }
];

function readTextFile(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJsonFile(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJsonFile(relativePath, data) {
  const fullPath = path.join(projectRoot, relativePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
}

function ensureBackupFile(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  const backupPath = `${fullPath}.before-weight-reconciliation`;

  if (fs.existsSync(fullPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(fullPath, backupPath);
  }
}

function normalizeValue(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return value;
}

function isNumeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "" || value === "N/A") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function roundKg(value) {
  return Number(value.toFixed(3));
}

function differenceKg(left, right) {
  return roundKg(left - right);
}

function isCloseKg(left, right) {
  return Math.abs(left - right) <= EPSILON_KG;
}

function cleanWeightRaw(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const cleaned = String(rawValue)
    .replace(/KG/gi, "")
    .replace(/KGS/gi, "")
    .replace(/[{}\[\]]/g, "")
    .trim();

  if (cleaned.length === 0) {
    return null;
  }

  return cleaned;
}

function parseInvoiceTotalNumber(rawValue) {
  const cleaned = cleanWeightRaw(rawValue);

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned.replace(/,/g, ""));

  return Number.isFinite(parsed) ? roundKg(parsed) : null;
}

function parseEuropeanLineWeightDefault(rawValue) {
  const cleaned = cleanWeightRaw(rawValue);

  if (!cleaned) {
    return null;
  }

  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
    return roundKg(Number(cleaned.replace(/\./g, "").replace(",", ".")));
  }

  if (/^\d+,\d+$/.test(cleaned)) {
    return roundKg(Number(cleaned.replace(",", ".")));
  }

  const parsed = Number(cleaned.replace(/,/g, ""));

  return Number.isFinite(parsed) ? roundKg(parsed) : null;
}

function generateLineWeightCandidates(rawValue, currentValue) {
  const cleaned = cleanWeightRaw(rawValue);
  const candidates = new Set();

  const currentNumber = toNumberOrNull(currentValue);

  if (currentNumber !== null) {
    candidates.add(roundKg(currentNumber));
  }

  if (!cleaned) {
    return Array.from(candidates);
  }

  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(cleaned)) {
    candidates.add(roundKg(Number(cleaned.replace(/\./g, "").replace(",", "."))));
  } else if (/^\d+,\d+$/.test(cleaned)) {
    candidates.add(roundKg(Number(cleaned.replace(",", "."))));
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    candidates.add(roundKg(Number(cleaned)));
    candidates.add(roundKg(Number(cleaned.replace(/\./g, ""))));
  } else {
    const parsed = Number(cleaned.replace(/,/g, ""));

    if (Number.isFinite(parsed)) {
      candidates.add(roundKg(parsed));
    }
  }

  return Array.from(candidates).filter((candidate) => {
    return typeof candidate === "number" && Number.isFinite(candidate);
  });
}

function extractInvoiceWeightTotals(ocrText) {
  const totalGrossMatch = ocrText.match(/Total\s+Gross\s+weight\s+([0-9][0-9.,]*)\s*KG/i);
  const totalNetMatch = ocrText.match(/Total\s+Net\s+weight\s+([0-9][0-9.,]*)\s*KG/i);

  return {
    totalGrossWeightRaw: totalGrossMatch ? totalGrossMatch[1] : "N/A",
    totalNetWeightRaw: totalNetMatch ? totalNetMatch[1] : "N/A",
    totalGrossWeightKG: totalGrossMatch ? parseInvoiceTotalNumber(totalGrossMatch[1]) : null,
    totalNetWeightKG: totalNetMatch ? parseInvoiceTotalNumber(totalNetMatch[1]) : null
  };
}

function extractLineWeightsFromOcr(ocrText) {
  const lines = ocrText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const lineStartPattern = /^\s*(\d{1,3})\s*[\(\{\[]?\s*R\s*[\)\}\]]?\s+\d{6,}/i;
  const netWeightPattern = /\bNet\s+weight\s+([0-9][0-9.,]*)\s*KG/i;
  const grossWeightPattern = /\bGross\s+weight\s+([0-9][0-9.,]*)\s*KG/i;

  const lineWeights = {};
  let currentLineNo = null;

  for (const line of lines) {
    const lineStartMatch = line.match(lineStartPattern);

    if (lineStartMatch) {
      currentLineNo = Number(lineStartMatch[1]);

      if (!lineWeights[currentLineNo]) {
        lineWeights[currentLineNo] = {
          lineNo: currentLineNo,
          rawNetWeight: null,
          rawGrossWeight: null
        };
      }
    }

    if (currentLineNo === null) {
      continue;
    }

    if (/Total\s+(Gross|Net)\s+weight/i.test(line)) {
      continue;
    }

    const netWeightMatch = line.match(netWeightPattern);

    if (netWeightMatch) {
      if (!lineWeights[currentLineNo]) {
        lineWeights[currentLineNo] = {
          lineNo: currentLineNo,
          rawNetWeight: null,
          rawGrossWeight: null
        };
      }

      lineWeights[currentLineNo].rawNetWeight = netWeightMatch[1];
    }

    const grossWeightMatch = line.match(grossWeightPattern);

    if (grossWeightMatch) {
      if (!lineWeights[currentLineNo]) {
        lineWeights[currentLineNo] = {
          lineNo: currentLineNo,
          rawNetWeight: null,
          rawGrossWeight: null
        };
      }

      lineWeights[currentLineNo].rawGrossWeight = grossWeightMatch[1];
    }
  }

  return lineWeights;
}

function sumField(rows, fieldName) {
  return roundKg(
    rows.reduce((sum, row) => {
      const value = toNumberOrNull(row[fieldName]);

      return sum + (value === null ? 0 : value);
    }, 0)
  );
}

function escapeCsvValue(value) {
  const text = value === undefined || value === null ? "" : String(value);

  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function rowsToCsv(columns, rows) {
  const header = columns.join(",");

  const body = rows
    .map((row) => {
      return columns.map((column) => escapeCsvValue(row[column])).join(",");
    })
    .join("\n");

  return `${header}\n${body}\n`;
}

function applyDirectRawWeightPatches(rows, lineWeightsByLineNo) {
  const repairs = [];

  for (const row of rows) {
    const lineNo = Number(row.LineNo);
    const rawWeights = lineWeightsByLineNo[lineNo];

    if (!rawWeights) {
      continue;
    }

    const currentNet = toNumberOrNull(row.NetWeightKG);
    const currentGross = toNumberOrNull(row.GrossWeightKG);

    const defaultNet = parseEuropeanLineWeightDefault(rawWeights.rawNetWeight);
    const defaultGross = parseEuropeanLineWeightDefault(rawWeights.rawGrossWeight);

    if (defaultNet !== null) {
      const shouldPatchNet =
        currentNet === null ||
        (
          rawWeights.rawNetWeight &&
          rawWeights.rawNetWeight.includes(",") &&
          !isCloseKg(currentNet, defaultNet)
        );

      if (shouldPatchNet) {
        repairs.push({
          lineNo,
          field: "NetWeightKG",
          rawValue: rawWeights.rawNetWeight,
          oldValue: normalizeValue(row.NetWeightKG),
          newValue: defaultNet,
          repairType: "direct_raw_weight_patch",
          reason: "Raw OCR line-level net weight was present and normalized from European decimal format."
        });

        row.NetWeightKG = defaultNet;
      }
    }

    if (defaultGross !== null) {
      const shouldPatchGross =
        currentGross === null ||
        (
          rawWeights.rawGrossWeight &&
          rawWeights.rawGrossWeight.includes(",") &&
          !isCloseKg(currentGross, defaultGross)
        );

      if (shouldPatchGross) {
        repairs.push({
          lineNo,
          field: "GrossWeightKG",
          rawValue: rawWeights.rawGrossWeight,
          oldValue: normalizeValue(row.GrossWeightKG),
          newValue: defaultGross,
          repairType: "direct_raw_weight_patch",
          reason: "Raw OCR line-level gross weight was present and normalized from European decimal format."
        });

        row.GrossWeightKG = defaultGross;
      }
    }
  }

  return repairs;
}

function applyTotalReconciliationCandidateRepair(rows, lineWeightsByLineNo, fieldName, rawFieldName, invoiceTotalKG) {
  const repairs = [];

  if (invoiceTotalKG === null) {
    return {
      status: "skipped_no_invoice_total",
      repairs,
      beforeSumKG: sumField(rows, fieldName),
      afterSumKG: sumField(rows, fieldName),
      invoiceTotalKG: null,
      differenceKG: null
    };
  }

  const beforeSumKG = sumField(rows, fieldName);

  if (isCloseKg(beforeSumKG, invoiceTotalKG)) {
    return {
      status: "matched_without_candidate_repair",
      repairs,
      beforeSumKG,
      afterSumKG: beforeSumKG,
      invoiceTotalKG,
      differenceKG: 0
    };
  }

  for (const row of rows) {
    const lineNo = Number(row.LineNo);
    const rawWeights = lineWeightsByLineNo[lineNo];

    if (!rawWeights) {
      continue;
    }

    const rawValue = rawWeights[rawFieldName];
    const currentValue = toNumberOrNull(row[fieldName]);
    const currentForMath = currentValue === null ? 0 : currentValue;
    const candidates = generateLineWeightCandidates(rawValue, row[fieldName]);

    for (const candidate of candidates) {
      if (currentValue !== null && isCloseKg(candidate, currentValue)) {
        continue;
      }

      const candidateSum = roundKg(beforeSumKG - currentForMath + candidate);

      if (isCloseKg(candidateSum, invoiceTotalKG)) {
        repairs.push({
          lineNo,
          field: fieldName,
          rawValue,
          oldValue: normalizeValue(row[fieldName]),
          newValue: candidate,
          repairType: "total_reconciliation_candidate_patch",
          reason: `Candidate value selected because it makes ${fieldName} line total match invoice bottom total exactly.`
        });

        row[fieldName] = candidate;

        return {
          status: "matched_after_candidate_repair",
          repairs,
          beforeSumKG,
          afterSumKG: candidateSum,
          invoiceTotalKG,
          differenceKG: 0
        };
      }
    }
  }

  const afterSumKG = sumField(rows, fieldName);

  return {
    status: "failed_no_valid_candidate_match",
    repairs,
    beforeSumKG,
    afterSumKG,
    invoiceTotalKG,
    differenceKG: differenceKg(invoiceTotalKG, afterSumKG)
  };
}

function removeOldWeightReconciliationFlags(validationFlags) {
  return validationFlags.filter((flag) => {
    return ![
      "TotalNetWeightKG",
      "TotalGrossWeightKG",
      "NetWeightKG",
      "GrossWeightKG"
    ].includes(flag.field) || flag.issue.indexOf("invoice bottom total") === -1;
  });
}

function addWeightTotalValidationFlags(output, reconciliation) {
  const existingFlags = Array.isArray(output.validation?.validationFlags)
    ? output.validation.validationFlags
    : [];

  const validationFlags = removeOldWeightReconciliationFlags(existingFlags);

  if (
    reconciliation.invoiceTotals.totalNetWeightKG !== null &&
    !isCloseKg(reconciliation.net.afterSumKG, reconciliation.invoiceTotals.totalNetWeightKG)
  ) {
    validationFlags.push({
      field: "TotalNetWeightKG",
      row: 0,
      issue: `Line-level NetWeightKG sum ${reconciliation.net.afterSumKG} does not match invoice bottom total ${reconciliation.invoiceTotals.totalNetWeightKG}. Difference ${reconciliation.net.differenceKG} KG.`,
      severity: "error"
    });
  }

  if (
    reconciliation.invoiceTotals.totalGrossWeightKG !== null &&
    !isCloseKg(reconciliation.gross.afterSumKG, reconciliation.invoiceTotals.totalGrossWeightKG)
  ) {
    validationFlags.push({
      field: "TotalGrossWeightKG",
      row: 0,
      issue: `Line-level GrossWeightKG sum ${reconciliation.gross.afterSumKG} does not match invoice bottom total ${reconciliation.invoiceTotals.totalGrossWeightKG}. Difference ${reconciliation.gross.differenceKG} KG.`,
      severity: "error"
    });
  }

  output.validation = output.validation || {};
  output.validation.validationFlags = validationFlags;
  output.validation.validationFlagCount = validationFlags.length;
}

function updateDeterministicSummary(jobResults) {
  const summaryRelativePath = path.join("outputs", "deterministic-canonical-lines-summary.json");
  const summaryFullPath = path.join(projectRoot, summaryRelativePath);

  if (!fs.existsSync(summaryFullPath)) {
    return;
  }

  const summary = JSON.parse(fs.readFileSync(summaryFullPath, "utf8"));

  if (!Array.isArray(summary.jobs)) {
    return;
  }

  for (const summaryJob of summary.jobs) {
    const result = jobResults.find((jobResult) => {
      return jobResult.jobName === summaryJob.jobName;
    });

    if (result) {
      summaryJob.validationFlagCount = result.validationFlagCount;
      summaryJob.weightReconciliationStatus = {
        net: result.netStatus,
        gross: result.grossStatus
      };
    }
  }

  summary.weightReconciliationUpdatedAt = new Date().toISOString();
  fs.writeFileSync(summaryFullPath, JSON.stringify(summary, null, 2), "utf8");
}

function runJob(job) {
  const ocrText = readTextFile(job.ocrFile);
  const output = readJsonFile(job.jsonFile);

  ensureBackupFile(job.jsonFile);
  ensureBackupFile(job.csvFile);

  const canonicalRows = Array.isArray(output.canonicalRows)
    ? output.canonicalRows
    : [];

  const canonicalColumns = Array.isArray(output.canonicalColumns)
    ? output.canonicalColumns
    : [
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

  const invoiceTotals = extractInvoiceWeightTotals(ocrText);
  const lineWeightsByLineNo = extractLineWeightsFromOcr(ocrText);

  const before = {
    netWeightSumKG: sumField(canonicalRows, "NetWeightKG"),
    grossWeightSumKG: sumField(canonicalRows, "GrossWeightKG")
  };

  const directRepairs = applyDirectRawWeightPatches(canonicalRows, lineWeightsByLineNo);

  const afterDirect = {
    netWeightSumKG: sumField(canonicalRows, "NetWeightKG"),
    grossWeightSumKG: sumField(canonicalRows, "GrossWeightKG")
  };

  const netReconciliation = applyTotalReconciliationCandidateRepair(
    canonicalRows,
    lineWeightsByLineNo,
    "NetWeightKG",
    "rawNetWeight",
    invoiceTotals.totalNetWeightKG
  );

  const grossReconciliation = applyTotalReconciliationCandidateRepair(
    canonicalRows,
    lineWeightsByLineNo,
    "GrossWeightKG",
    "rawGrossWeight",
    invoiceTotals.totalGrossWeightKG
  );

  const after = {
    netWeightSumKG: sumField(canonicalRows, "NetWeightKG"),
    grossWeightSumKG: sumField(canonicalRows, "GrossWeightKG")
  };

  const reconciliation = {
    schema: WEIGHT_RECONCILIATION_SCHEMA,
    jobName: job.name,
    generatedAt: new Date().toISOString(),
    invoiceTotals,
    before,
    afterDirect,
    after,
    directRepairs,
    net: netReconciliation,
    gross: grossReconciliation,
    lineWeightsExtractedFromOcr: Object.values(lineWeightsByLineNo).sort((left, right) => {
      return left.lineNo - right.lineNo;
    }),
    interpretationRules: [
      "Comma-only line weights are treated as European decimal weights: 23,580 KG -> 23.580 KG.",
      "Dot+comma line weights are treated as European thousands+decimal weights: 2.495,934 KG -> 2495.934 KG.",
      "Dot-only line weights are ambiguous: 2.268 KG can mean 2.268 KG or 2268 KG.",
      "Dot-only ambiguous values are only patched to thousands interpretation when invoice bottom totals prove the interpretation.",
      "Invoice tare is not used to repair line items.",
      "If line-item net/gross sums still do not match invoice bottom totals after legal candidate repairs, the invoice is flagged as inconsistent or incompletely extracted."
    ]
  };

  output.weightReconciliation = reconciliation;

  if (output.metadata) {
    output.metadata.weightReconciliationAppliedAt = reconciliation.generatedAt;
  }

  addWeightTotalValidationFlags(output, reconciliation);

  writeJsonFile(job.jsonFile, output);
  writeJsonFile(job.diagnosticsFile, reconciliation);
  fs.writeFileSync(
    path.join(projectRoot, job.csvFile),
    rowsToCsv(canonicalColumns, canonicalRows),
    "utf8"
  );

  console.log("------------------------------------------------------------");
  console.log(`Weight reconciliation complete: ${job.name}`);
  console.log(`Invoice total net KG: ${invoiceTotals.totalNetWeightKG}`);
  console.log(`Invoice total gross KG: ${invoiceTotals.totalGrossWeightKG}`);
  console.log(`Before net sum KG: ${before.netWeightSumKG}`);
  console.log(`Before gross sum KG: ${before.grossWeightSumKG}`);
  console.log(`After net sum KG: ${after.netWeightSumKG}`);
  console.log(`After gross sum KG: ${after.grossWeightSumKG}`);
  console.log(`Net reconciliation: ${netReconciliation.status}`);
  console.log(`Gross reconciliation: ${grossReconciliation.status}`);
  console.log(`Direct repairs: ${directRepairs.length}`);
  console.log(`Net candidate repairs: ${netReconciliation.repairs.length}`);
  console.log(`Gross candidate repairs: ${grossReconciliation.repairs.length}`);
  console.log(`Validation flags now: ${output.validation.validationFlagCount}`);
  console.log(`Diagnostics: ${path.join(projectRoot, job.diagnosticsFile)}`);

  return {
    jobName: job.name,
    validationFlagCount: output.validation.validationFlagCount,
    netStatus: netReconciliation.status,
    grossStatus: grossReconciliation.status
  };
}

function main() {
  try {
    const jobResults = [];

    for (const job of jobs) {
      const result = runJob(job);
      jobResults.push(result);
    }

    updateDeterministicSummary(jobResults);

    const summary = {
      schema: WEIGHT_RECONCILIATION_SCHEMA,
      generatedAt: new Date().toISOString(),
      jobCount: jobResults.length,
      jobs: jobResults
    };

    writeJsonFile(path.join("outputs", "weight-reconciliation-summary.json"), summary);

    console.log("------------------------------------------------------------");
    console.log("All invoice weight reconciliation jobs complete.");
    console.log(`Summary: ${path.join(projectRoot, "outputs", "weight-reconciliation-summary.json")}`);
  } catch (error) {
    console.error("Invoice weight reconciliation failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();