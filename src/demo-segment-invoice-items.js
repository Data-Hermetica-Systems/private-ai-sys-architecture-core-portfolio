const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const inputPath = path.join(projectRoot, "ocr", "synthetic-commercial-invoice-001-ocr.txt");
const outputPath = path.join(projectRoot, "ocr", "synthetic-commercial-invoice-001-segments.json");
const summaryPath = path.join(projectRoot, "ocr", "demo-segmentation-summary.json");

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function extractHeaderValue(text, label) {
  const pattern = new RegExp(`${label}:\\s*(.+)`, "i");
  const match = text.match(pattern);
  return match ? match[1].trim() : "N/A";
}

function segmentLineItems(text) {
  const lineBlocks = text
    .split(/\n(?=Line\s+\d+)/g)
    .filter((block) => /^Line\s+\d+/m.test(block.trim()));

  return lineBlocks.map((block) => {
    const lineMatch = block.match(/^Line\s+(\d+)/m);

    return {
      lineNo: lineMatch ? Number(lineMatch[1]) : null,
      rawBlock: block.trim()
    };
  });
}

function main() {
  try {
    const text = readText(inputPath);

    const invoiceMetadata = {
      invoiceNumber: extractHeaderValue(text, "Invoice No"),
      invoiceDate: extractHeaderValue(text, "Invoice Date"),
      shipmentNumber: extractHeaderValue(text, "Shipment No"),
      invoiceFamily: extractHeaderValue(text, "Invoice Family")
    };

    const segments = segmentLineItems(text);

    const output = {
      outputSchema: "demo_invoice_segments_v1",
      generatedAt: new Date().toISOString(),
      jobName: "synthetic-commercial-invoice-001",
      invoiceMetadata,
      segmentCount: segments.length,
      segments
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

    const summary = {
      outputSchema: "demo_segmentation_summary_v1",
      generatedAt: new Date().toISOString(),
      jobCount: 1,
      jobs: [
        {
          jobName: "synthetic-commercial-invoice-001",
          invoiceNumber: invoiceMetadata.invoiceNumber,
          invoiceFamily: invoiceMetadata.invoiceFamily,
          segmentCount: segments.length,
          outputFile: "synthetic-commercial-invoice-001-segments.json"
        }
      ]
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

    console.log("------------------------------------------------------------");
    console.log("Synthetic invoice segmentation complete.");
    console.log(`Segments: ${segments.length}`);
    console.log(`Output: ${outputPath}`);
  } catch (error) {
    console.error("Synthetic invoice segmentation failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();