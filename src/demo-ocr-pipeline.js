const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const ocrDirectory = path.join(projectRoot, "ocr");

const syntheticOcrText = `
COMMERCIAL INVOICE
Invoice No: DEMO-INV-1001
Invoice Date: 2026-01-15
Shipment No: DEMO-SHIP-7781
Invoice Family: multi_line_invoice_family

Sold To:
Example Logistics Import Team
100 Demo Harbor Road
Newark, NJ 07114

Line 1
Product No: DEMO-10001
Description: Specialty solvent sample material
Unit: EA
Quantity: 12.000
Unit Price USD: 11.8308
Line Amount USD: 141.97
Commodity Code: 29051200
Country of Origin: Germany
Delivery Note: DEMO-DN-001
Net weight 23,580 KG
Gross weight 40,056 KG

Line 2
Product No: DEMO-10002
Description: Laboratory reagent sample material
Unit: EA
Quantity: 8.000
Unit Price USD: 25.5000
Line Amount USD: 204.00
Commodity Code: 38229000
Country of Origin: United States
Delivery Note: DEMO-DN-002
Net weight 18,750 KG
Gross weight 21,300 KG

Line 3
Product No: DEMO-10003
Description: Bulk tank residual sample
Unit: KG
Quantity: 305.000
Unit Price USD: 6.2000
Line Amount USD: 1891.00
Commodity Code: 38249900
Country of Origin: United States
Delivery Note: DEMO-DN-003
Net weight 305,000 KG
Gross weight 310,000 KG

Invoice Totals
Total Net weight 347,330 KG
Total Gross weight 371,356 KG
Total Amount USD 2236.97
`;

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function writeJson(relativePath, data) {
  const fullPath = path.join(projectRoot, relativePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
}

function main() {
  ensureDirectoryExists(ocrDirectory);

  const outputFile = path.join(ocrDirectory, "synthetic-commercial-invoice-001-ocr.txt");
  fs.writeFileSync(outputFile, syntheticOcrText.trim(), "utf8");

  const summary = {
    outputSchema: "demo_ocr_run_summary_v1",
    generatedAt: new Date().toISOString(),
    jobCount: 1,
    jobs: [
      {
        jobName: "synthetic-commercial-invoice-001",
        sourceType: "synthetic_public_demo",
        outputFile: "synthetic-commercial-invoice-001-ocr.txt",
        status: "completed"
      }
    ]
  };

  writeJson(path.join("ocr", "demo-ocr-run-summary.json"), summary);

  console.log("------------------------------------------------------------");
  console.log("Synthetic OCR demo created.");
  console.log(`OCR output: ${outputFile}`);
  console.log("Summary: ocr\\demo-ocr-run-summary.json");
}

main();