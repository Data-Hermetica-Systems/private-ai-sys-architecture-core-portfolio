const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const ocrJobs = [
  {
    name: "sample-commercial-invoice-001",
    inputFile: path.join("ocr", "sample-commercial-invoice-001-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-001-segmented-items.json"
  },
  {
    name: "sample-commercial-invoice-002",
    inputFile: path.join("ocr", "sample-commercial-invoice-002-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-002-segmented-items.json"
  },
  {
    name: "sample-commercial-invoice-003",
    inputFile: path.join("ocr", "sample-commercial-invoice-003-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-003-segmented-items.json"
  },
  {
    name: "sample-commercial-invoice-004",
    inputFile: path.join("ocr", "sample-commercial-invoice-004-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-004-segmented-items.json"
  },
  {
    name: "sample-commercial-invoice-005",
    inputFile: path.join("ocr", "sample-commercial-invoice-005-tesseract-ocr.txt"),
    outputFile: "sample-commercial-invoice-005-segmented-items.json"
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

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractHeaderMetadata(text) {
  const metadata = {
    invoiceNumber: "N/A",
    invoiceDate: "N/A",
    shipmentNumber: "N/A",
    customerNumber: "N/A",
    orderNumber: "N/A",
    trackingNumber: "N/A",
    deliveryTerms: "N/A",
    vessel: "N/A",
    container: "N/A"
  };

  const invoiceNumberMatch =
    text.match(/Invoice Number\s*:\s*([A-Z0-9-]+)/i) ||
    text.match(/Invoice No\.\s+Invoice Date[\s\S]{0,120}?\n\s*([A-Z0-9-]+)/i);

  if (invoiceNumberMatch) {
    metadata.invoiceNumber = invoiceNumberMatch[1].trim();
  }

  const invoiceDateMatch =
    text.match(/Date\s*:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i) ||
    text.match(/Invoice Number \/ Date:\s*[A-Z0-9-]+\/\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i) ||
    text.match(/Invoice No\.\s+Invoice Date[\s\S]{0,120}?[A-Z0-9-]+\s+([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);

  if (invoiceDateMatch) {
    metadata.invoiceDate = invoiceDateMatch[1].trim();
  }

  const shipmentNumberMatch =
    text.match(/Shipment No\.\s*:\s*([0-9]+)/i) ||
    text.match(/Shipment\s*:\s*([0-9, ]+)/i);

  if (shipmentNumberMatch) {
    metadata.shipmentNumber = shipmentNumberMatch[1].trim();
  }

  const customerNumberMatch =
    text.match(/Customer No\.\s*:\s*([A-Z0-9$]+)/i) ||
    text.match(/Customer Number:\s*([A-Z0-9$]+)/i);

  if (customerNumberMatch) {
    metadata.customerNumber = customerNumberMatch[1].replace("$", "S").trim();
  }

  const orderNumberMatch =
    text.match(/Order No\.\/Date\s*:\s*([0-9]+)/i) ||
    text.match(/Order\s+([0-9]{6,})/i);

  if (orderNumberMatch) {
    metadata.orderNumber = orderNumberMatch[1].trim();
  }

  const trackingNumberMatch = text.match(/Tracking No\.\s*:\s*([A-Z0-9-]+)/i);

  if (trackingNumberMatch) {
    metadata.trackingNumber = trackingNumberMatch[1].trim();
  }

  const deliveryTermsMatch = text.match(/Delivery Terms:\s*([^\n]+)/i);

  if (deliveryTermsMatch) {
    metadata.deliveryTerms = deliveryTermsMatch[1].trim();
  }

  const vesselMatch = text.match(/VESSEL:\s*([^\n]+)/i);

  if (vesselMatch) {
    metadata.vessel = vesselMatch[1].trim();
  }

  const containerMatch = text.match(/CONTAINER:\s*([A-Z0-9]+)/i);

  if (containerMatch) {
    metadata.container = containerMatch[1].trim();
  }

  return metadata;
}

function isLikelyItemStart(line) {
  const normalized = line.trim();

  const patterns = [
    /^\d{1,3}\s*\(?R\)?\s+[0-9]{7,9}\s+[A-Z]{1,3}\s+[\d,.]+\s+[\d,.]+\s*\/\s*[A-Z]{1,3}\s+[\d,.]+/i,
    /^\d{1,3}\s*\{R\)?\s+[0-9]{7,9}\s+[A-Z]{1,3}\s+[\d,.]+\s+[\d,.]+\s*\/\s*[A-Z]{1,3}\s+[\d,.]+/i,
    /^\d{1,3}\s*\(R\)\s+[0-9]{7,9}\s+[A-Z]{1,3}/i,
    /^\d{1,3}\(R\)\s+[0-9]{7,9}\s+[A-Z]{1,3}/i,
    /^\d{1,3}\s+[0-9]{7,9}\s+[A-Z]{1,3}\s+[\d,.]+\s+[\d,.]+\s*\/\s*[A-Z]{1,3}\s+[\d,.]+/i
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

function parseItemStartLine(line) {
  const normalized = line.trim();

  const match = normalized.match(
    /^(\d{1,3})\s*[\(\{]?\s*R\s*[\)\}]?\s+([0-9]{7,9})\s+([A-Z]{1,3})\s+([\d,.]+)\s+([\d,.]+)\s*\/\s*([A-Z]{1,3})\s+([\d,.]+)/i
  ) || normalized.match(
    /^(\d{1,3})\s+([0-9]{7,9})\s+([A-Z]{1,3})\s+([\d,.]+)\s+([\d,.]+)\s*\/\s*([A-Z]{1,3})\s+([\d,.]+)/i
  );

  if (!match) {
    return {
      LineNo: "N/A",
      ProductNumber: "N/A",
      Unit: "N/A",
      Quantity: "N/A",
      UnitPriceUSD: "N/A",
      LineAmountUSD: "N/A"
    };
  }

  if (match.length === 8) {
    return {
      LineNo: match[1],
      ProductNumber: match[2],
      Unit: match[3],
      Quantity: match[4],
      UnitPriceUSD: match[5],
      LineAmountUSD: match[7]
    };
  }

  return {
    LineNo: "N/A",
    ProductNumber: "N/A",
    Unit: "N/A",
    Quantity: "N/A",
    UnitPriceUSD: "N/A",
    LineAmountUSD: "N/A"
  };
}

function extractFieldFromBlock(blockText, patterns, fallback = "N/A") {
  for (const pattern of patterns) {
    const match = blockText.match(pattern);

    if (match) {
      return match[1].trim();
    }
  }

  return fallback;
}

function removeNoiseLines(lines) {
  return lines.filter((line) => {
    const text = line.trim();

    if (text.length === 0) {
      return false;
    }

    const noisePatterns = [
      /^Honeywell Specialty Chemicals/i,
      /^Wunstorfer Stra/i,
      /^Tel:/i,
      /^VAT-No/i,
      /^Customer Number:/i,
      /^Solstice AM US Inc/i,
      /^General Manager:/i,
      /^Gerald Talhoff/i,
      /^Supervisory Board/i,
      /^Monika Stamer/i,
      /^StNr/i,
      /^IBAN:/i,
      /^Deutsche Bank/i,
      /^Comm\. register/i,
      /^Account No\./i,
      /^-{5,}/,
      /^\d+$/,
      /^\*?\{?MOD/i,
      /^\*?\{?NAP/i,
      /^Item Material Description/i,
      /^USD USD/i
    ];

    return !noisePatterns.some((pattern) => pattern.test(text));
  });
}

function extractDescriptionFromBlock(blockLines) {
  const cleanedLines = removeNoiseLines(blockLines);

  const descriptionLines = [];

  for (const line of cleanedLines) {
    const text = line.trim();

    if (isLikelyItemStart(text)) {
      continue;
    }

    if (/^Commodity Code:/i.test(text)) {
      break;
    }

    if (/^Country of Origin:/i.test(text)) {
      break;
    }

    if (/^Delivery Note:/i.test(text)) {
      break;
    }

    if (/^Shipment:/i.test(text)) {
      break;
    }

    if (/^Order\s+[0-9]/i.test(text)) {
      break;
    }

    if (/^Net weight/i.test(text)) {
      break;
    }

    if (/^Gross weight/i.test(text)) {
      break;
    }

    descriptionLines.push(text);
  }

  return descriptionLines.join(" ").replace(/\s+/g, " ").trim() || "N/A";
}

function segmentInvoiceItems(text) {
  const normalized = normalizeWhitespace(text);
  const lines = normalized.split("\n");

  const metadata = extractHeaderMetadata(normalized);
  const itemStarts = [];

  lines.forEach((line, index) => {
    if (isLikelyItemStart(line)) {
      itemStarts.push(index);
    }
  });

  const segments = [];

  itemStarts.forEach((startIndex, itemIndex) => {
    const endIndex =
      itemIndex + 1 < itemStarts.length
        ? itemStarts[itemIndex + 1]
        : lines.length;

    const blockLines = lines.slice(startIndex, endIndex);
    const blockText = blockLines.join("\n");
    const parsedStart = parseItemStartLine(blockLines[0]);

    const commodityCode = extractFieldFromBlock(blockText, [
      /Commodity Code:\s*([0-9]+)/i
    ]);

    const countryOfOrigin = extractFieldFromBlock(blockText, [
      /Country of Origin:\s*([^\n]+)/i
    ]);

    const deliveryNote = extractFieldFromBlock(blockText, [
      /Delivery Note:\s*([0-9]+)/i
    ]);

    const shipmentNumber = extractFieldFromBlock(blockText, [
      /Shipment:\s*([0-9, ]+)/i
    ], metadata.shipmentNumber);

    const orderNumber = extractFieldFromBlock(blockText, [
      /Order\s+([0-9]{6,})/i
    ], metadata.orderNumber);

    const netWeightKG = extractFieldFromBlock(blockText, [
      /Net weight\s+([\d.,]+)\s*KG/i,
      /Nett Wt\.\s*([\d.,]+)/i
    ]);

    const grossWeightKG = extractFieldFromBlock(blockText, [
      /Gross weight\s+([\d.,]+)\s*KG/i,
      /Gross Wt\.\s*([\d.,]+)/i
    ]);

    const description = extractDescriptionFromBlock(blockLines.slice(1));

    segments.push({
      segmentIndex: itemIndex + 1,
      sourceStartLine: startIndex + 1,
      sourceEndLine: endIndex,
      parsedFields: {
        ...parsedStart,
        Description: description,
        CommodityCode: commodityCode,
        CountryOfOrigin: countryOfOrigin,
        DeliveryNote: deliveryNote,
        ShipmentNumber: shipmentNumber,
        OrderNumber: orderNumber,
        NetWeightKG: netWeightKG,
        GrossWeightKG: grossWeightKG
      },
      blockText
    });
  });

  return {
    metadata,
    itemStartCount: itemStarts.length,
    segments
  };
}

function runSegmentationJob(job) {
  const inputPath = path.join(projectRoot, job.inputFile);
  const outputPath = path.join(projectRoot, "ocr", job.outputFile);

  const text = readTextFile(inputPath);
  const result = segmentInvoiceItems(text);

  const finalOutput = {
    jobName: job.name,
    inputFile: job.inputFile,
    outputFile: path.join("ocr", job.outputFile),
    sourceCharacterCount: text.length,
    generatedAt: new Date().toISOString(),
    metadata: result.metadata,
    itemStartCount: result.itemStartCount,
    segments: result.segments
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2), "utf8");

  console.log("------------------------------------------------------------");
  console.log(`Segmented OCR invoice: ${job.name}`);
  console.log(`Input file: ${inputPath}`);
  console.log(`Output file: ${outputPath}`);
  console.log(`Detected item starts: ${result.itemStartCount}`);

  return finalOutput;
}

function main() {
  try {
    const results = [];

    for (const job of ocrJobs) {
      const result = runSegmentationJob(job);
      results.push(result);
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      jobCount: results.length,
      jobs: results.map((result) => {
        return {
          jobName: result.jobName,
          inputFile: result.inputFile,
          outputFile: result.outputFile,
          sourceCharacterCount: result.sourceCharacterCount,
          invoiceNumber: result.metadata.invoiceNumber,
          invoiceDate: result.metadata.invoiceDate,
          shipmentNumber: result.metadata.shipmentNumber,
          itemStartCount: result.itemStartCount
        };
      })
    };

    const summaryPath = path.join(projectRoot, "ocr", "segmented-items-summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

    console.log("------------------------------------------------------------");
    console.log("All OCR invoice segmentation jobs complete.");
    console.log(`Summary saved to: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("OCR item segmentation failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();