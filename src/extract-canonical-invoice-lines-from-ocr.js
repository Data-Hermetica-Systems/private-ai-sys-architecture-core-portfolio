const fs = require("fs");
const path = require("path");

const MODEL_NAME = "qwen2.5:7b";
const OUTPUT_SCHEMA = "canonical_invoice_line_items_v2026";
const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";

const projectRoot = path.resolve(__dirname, "..");
const promptPath = path.join(
  projectRoot,
  "prompts",
  "canonical-invoice-line-extraction-prompt.md"
);

const extractionJobs = [
  {
    name: "sample-commercial-invoice-001-tesseract-canonical-lines",
    inputFile: path.join("ocr", "sample-commercial-invoice-001-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-001-tesseract-canonical-lines.json",
    inputQuality: "tesseract-ocr",
    expectedMinimumRows: 1
  },
  {
    name: "sample-commercial-invoice-002-tesseract-canonical-lines",
    inputFile: path.join("ocr", "sample-commercial-invoice-002-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-002-tesseract-canonical-lines.json",
    inputQuality: "tesseract-ocr",
    expectedMinimumRows: 2
  },
  {
    name: "sample-commercial-invoice-003-tesseract-canonical-lines",
    inputFile: path.join("ocr", "sample-commercial-invoice-003-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-003-tesseract-canonical-lines.json",
    inputQuality: "tesseract-ocr",
    expectedMinimumRows: 1
  },
  {
    name: "sample-commercial-invoice-004-tesseract-canonical-lines",
    inputFile: path.join("ocr", "sample-commercial-invoice-004-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-004-tesseract-canonical-lines.json",
    inputQuality: "tesseract-ocr",
    expectedMinimumRows: 1
  },
  {
    name: "sample-commercial-invoice-005-tesseract-canonical-lines",
    inputFile: path.join("ocr", "sample-commercial-invoice-005-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-005-tesseract-canonical-lines.json",
    inputQuality: "tesseract-ocr",
    expectedMinimumRows: 1
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

function readTextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function truncateText(text, maxCharacters) {
  if (text.length <= maxCharacters) {
    return text;
  }

  return text.slice(0, maxCharacters);
}

function buildPrompt(promptTemplate, documentText, job) {
  const maxCharacters = 6000;
  const truncatedText = truncateText(documentText, maxCharacters);

  return `${promptTemplate}

Input quality classification:
${job.inputQuality}

Extraction job name:
${job.name}

Expected minimum rows:
${job.expectedMinimumRows}

Important:
This input is real local Tesseract OCR output. It may contain OCR mistakes, repeated headers, footers, broken table columns, page markers, and noisy text. Extract the canonical invoice line rows from the best available text.

Document text:
${truncatedText}`;
}

function extractJsonFromModelText(modelText) {
  const trimmed = modelText.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model did not return JSON object text.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
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

function normalizeNumberOrNA(value) {
  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const raw = value.trim();

    if (raw.toUpperCase() === "N/A") {
      return "N/A";
    }

    const withoutUnits = raw.replace(/USD|KG|EA|\$/gi, "").trim();

    let normalized = withoutUnits;

    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(withoutUnits)) {
      normalized = withoutUnits.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+,\d+$/.test(withoutUnits)) {
      normalized = withoutUnits.replace(",", ".");
    } else {
      normalized = withoutUnits.replace(/,/g, "");
    }

    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return "N/A";
}

function normalizeLineNo(value) {
  const normalized = normalizeNumberOrNA(value);

  if (typeof normalized === "number") {
    return normalized;
  }

  return "N/A";
}

function normalizeCanonicalRow(row) {
  return {
    LineNo: normalizeLineNo(row.LineNo),
    ProductNumber: normalizeStringOrNA(row.ProductNumber),
    Description: normalizeStringOrNA(row.Description),
    Unit: normalizeStringOrNA(row.Unit),
    Quantity: normalizeNumberOrNA(row.Quantity),
    UnitPriceUSD: normalizeNumberOrNA(row.UnitPriceUSD),
    LineAmountUSD: normalizeNumberOrNA(row.LineAmountUSD),
    CommodityCode: normalizeStringOrNA(row.CommodityCode),
    CountryOfOrigin: normalizeStringOrNA(row.CountryOfOrigin),
    DeliveryNote: normalizeStringOrNA(row.DeliveryNote),
    ShipmentNumber: normalizeStringOrNA(row.ShipmentNumber),
    OrderNumber: normalizeStringOrNA(row.OrderNumber),
    NetWeightKG: normalizeNumberOrNA(row.NetWeightKG),
    GrossWeightKG: normalizeNumberOrNA(row.GrossWeightKG)
  };
}

function validateCanonicalRows(canonicalRows, job) {
  const validationFlags = [];

  if (!Array.isArray(canonicalRows)) {
    validationFlags.push({
      field: "canonicalRows",
      row: 0,
      issue: "canonicalRows must be an array.",
      severity: "error"
    });

    return validationFlags;
  }

  if (canonicalRows.length === 0) {
    validationFlags.push({
      field: "canonicalRows",
      row: 0,
      issue: "No line items were extracted.",
      severity: "error"
    });
  }

  if (canonicalRows.length < job.expectedMinimumRows) {
    validationFlags.push({
      field: "canonicalRows",
      row: 0,
      issue: `Extracted row count ${canonicalRows.length} is below expected minimum ${job.expectedMinimumRows}.`,
      severity: "warning"
    });
  }

  canonicalRows.forEach((row, index) => {
    const rowNumber = index + 1;

    for (const column of canonicalColumns) {
      if (!(column in row)) {
        validationFlags.push({
          field: column,
          row: rowNumber,
          issue: "Required canonical column is missing from row.",
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
        issue: "Product/material number is missing.",
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
        issue: "Quantity is missing or not numeric.",
        severity: "error"
      });
    }

    if (row.UnitPriceUSD === "N/A") {
      validationFlags.push({
        field: "UnitPriceUSD",
        row: rowNumber,
        issue: "Unit price is missing or not numeric.",
        severity: "error"
      });
    }

    if (row.LineAmountUSD === "N/A") {
      validationFlags.push({
        field: "LineAmountUSD",
        row: rowNumber,
        issue: "Line amount is missing or not numeric.",
        severity: "error"
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

      if (difference > 0.05) {
        validationFlags.push({
          field: "LineAmountUSD",
          row: rowNumber,
          issue: `Line amount ${actualLineAmount} does not match Quantity × UnitPriceUSD ${expectedLineAmount}.`,
          severity: "warning"
        });
      }
    }
  });

  const seenLineNumbers = new Set();

  canonicalRows.forEach((row, index) => {
    if (row.LineNo !== "N/A") {
      if (seenLineNumbers.has(row.LineNo)) {
        validationFlags.push({
          field: "LineNo",
          row: index + 1,
          issue: `Duplicate LineNo detected: ${row.LineNo}.`,
          severity: "error"
        });
      }

      seenLineNumbers.add(row.LineNo);
    }
  });

  validationFlags.push({
    field: "inputQuality",
    row: 0,
    issue: "Input came from real local Tesseract OCR text. Review row boundaries and field assignment.",
    severity: "info"
  });

  return validationFlags;
}

async function callOllama(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_ctx: 8192
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  return await response.json();
}

function buildJobPaths(job) {
  return {
    inputPath: path.join(projectRoot, job.inputFile),
    outputPath: path.join(projectRoot, "outputs", job.outputFile)
  };
}

async function runExtractionJob(job, promptTemplate) {
  const { inputPath, outputPath } = buildJobPaths(job);

  const documentText = readTextFile(inputPath);
  const prompt = buildPrompt(promptTemplate, documentText, job);

  console.log("------------------------------------------------------------");
  console.log(`Running Tesseract OCR canonical line extraction job: ${job.name}`);
  console.log(`Input quality: ${job.inputQuality}`);
  console.log(`Input file: ${inputPath}`);
  console.log(`Expected minimum rows: ${job.expectedMinimumRows}`);
  console.log("Calling local Ollama model...");

  const startedAt = Date.now();
  const ollamaResult = await callOllama(prompt);
  const finishedAt = Date.now();

  if (!ollamaResult.response) {
    throw new Error("Ollama response did not include a response field.");
  }

  const jsonText = extractJsonFromModelText(ollamaResult.response);
  const parsedResult = JSON.parse(jsonText);

  const rawRows = Array.isArray(parsedResult.canonicalRows)
    ? parsedResult.canonicalRows
    : [];

  const canonicalRows = rawRows.map(normalizeCanonicalRow);

  const modelValidationFlags = Array.isArray(parsedResult.validationFlags)
    ? parsedResult.validationFlags
    : [];

  const systemValidationFlags = validateCanonicalRows(canonicalRows, job);

  const finalOutput = {
    metadata: {
      modelName: MODEL_NAME,
      outputSchema: OUTPUT_SCHEMA,
      sourceFile: job.inputFile,
      outputFile: job.outputFile,
      inputQuality: job.inputQuality,
      extractionJobName: job.name,
      documentClass: normalizeStringOrNA(parsedResult.documentClass),
      expectedMinimumRows: job.expectedMinimumRows,
      sourceCharacterCount: documentText.length,
      promptCharacterCount: prompt.length,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      durationMs: finishedAt - startedAt,
      ollamaDoneReason: ollamaResult.done_reason || null,
      promptEvalCount: ollamaResult.prompt_eval_count || null,
      evalCount: ollamaResult.eval_count || null
    },
    canonicalColumns,
    canonicalRows,
    validation: {
      rowCount: canonicalRows.length,
      duplicateProductNumbersAllowed: true,
      modelValidationFlags,
      systemValidationFlags,
      validationFlagCount: modelValidationFlags.length + systemValidationFlags.length
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2), "utf8");

  console.log("Tesseract OCR canonical line extraction complete.");
  console.log(`Output saved to: ${outputPath}`);
  console.log(`Rows extracted: ${canonicalRows.length}`);
  console.log(`Validation flags: ${finalOutput.validation.validationFlagCount}`);

  return finalOutput;
}

async function main() {
  try {
    const outputDirectory = path.join(projectRoot, "outputs");
    ensureDirectoryExists(outputDirectory);

    const promptTemplate = readTextFile(promptPath);
    const results = [];

    for (const job of extractionJobs) {
      const result = await runExtractionJob(job, promptTemplate);
      results.push(result);
    }

    const summaryPath = path.join(
      projectRoot,
      "outputs",
      "tesseract-canonical-line-extraction-summary.json"
    );

    const summary = {
      modelName: MODEL_NAME,
      outputSchema: OUTPUT_SCHEMA,
      runCompletedAt: new Date().toISOString(),
      jobCount: results.length,
      jobs: results.map((result) => {
        return {
          extractionJobName: result.metadata.extractionJobName,
          inputQuality: result.metadata.inputQuality,
          sourceFile: result.metadata.sourceFile,
          outputFile: result.metadata.outputFile,
          durationMs: result.metadata.durationMs,
          sourceCharacterCount: result.metadata.sourceCharacterCount,
          promptCharacterCount: result.metadata.promptCharacterCount,
          expectedMinimumRows: result.metadata.expectedMinimumRows,
          rowCount: result.validation.rowCount,
          validationFlagCount: result.validation.validationFlagCount,
          outputSchema: result.metadata.outputSchema
        };
      })
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

    console.log("------------------------------------------------------------");
    console.log("All Tesseract OCR canonical line extraction jobs complete.");
    console.log(`Summary saved to: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("Tesseract OCR canonical line extraction failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();