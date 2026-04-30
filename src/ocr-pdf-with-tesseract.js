const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");

const pdfJobs = [
  {
    name: "sample-commercial-invoice-001",
    inputPdfFile: "sample-commercial-invoice-001.pdf"
  },
  {
    name: "sample-commercial-invoice-002",
    inputPdfFile: "sample-commercial-invoice-002.pdf"
  },
  {
    name: "sample-commercial-invoice-003",
    inputPdfFile: "sample-commercial-invoice-003.pdf"
  },
  {
    name: "sample-commercial-invoice-004",
    inputPdfFile: "sample-commercial-invoice-004.pdf"
  },
  {
    name: "sample-commercial-invoice-005",
    inputPdfFile: "sample-commercial-invoice-005.pdf"
  }
];

const tesseractCandidates = [
  "tesseract",
  "H:\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
];

const pdftoppmCandidates = [
  "pdftoppm",
  "H:\\Poppler\\poppler-25.12.0\\Library\\bin\\pdftoppm.exe",
  "H:\\Poppler\\Library\\bin\\pdftoppm.exe",
  "H:\\Poppler\\bin\\pdftoppm.exe",
  "C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe",
  "C:\\Program Files\\poppler\\bin\\pdftoppm.exe"
];

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function commandWorks(command, args) {
  try {
    execFileSync(command, args, {
      stdio: "ignore",
      windowsHide: true
    });

    return true;
  } catch {
    return false;
  }
}

function findWorkingCommand(candidates, testArgs, toolName) {
  for (const candidate of candidates) {
    if (commandWorks(candidate, testArgs)) {
      return candidate;
    }
  }

  throw new Error(`Could not find working ${toolName}. Check install path and PATH variable.`);
}

function cleanOldFiles(directoryPath, allowedExtensions) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  const files = fs.readdirSync(directoryPath);

  for (const file of files) {
    const fullPath = path.join(directoryPath, file);
    const extension = path.extname(file).toLowerCase();

    if (allowedExtensions.includes(extension)) {
      fs.unlinkSync(fullPath);
    }
  }
}

function convertPdfToPngPages(pdftoppmPath, job) {
  const inputPdfPath = path.join(projectRoot, "pdfs", job.inputPdfFile);
  const imagesDir = path.join(projectRoot, "images", job.name);

  ensureDirectoryExists(imagesDir);
  cleanOldFiles(imagesDir, [".png"]);

  if (!fs.existsSync(inputPdfPath)) {
    throw new Error(`Input PDF not found: ${inputPdfPath}`);
  }

  const outputPrefix = path.join(imagesDir, "page");

  console.log("------------------------------------------------------------");
  console.log(`Converting PDF to PNG pages for job: ${job.name}`);
  console.log(`PDF: ${inputPdfPath}`);
  console.log(`Output prefix: ${outputPrefix}`);

  execFileSync(
    pdftoppmPath,
    [
      "-png",
      "-r",
      "300",
      inputPdfPath,
      outputPrefix
    ],
    {
      stdio: "inherit",
      windowsHide: true
    }
  );

  const pageImages = fs
    .readdirSync(imagesDir)
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => path.join(imagesDir, file));

  if (pageImages.length === 0) {
    throw new Error(`No PNG pages were created from PDF: ${inputPdfPath}`);
  }

  return pageImages;
}

function runTesseractOnImage(tesseractPath, imagePath, job, pageIndex) {
  const ocrDir = path.join(projectRoot, "ocr", job.name);
  ensureDirectoryExists(ocrDir);

  const outputBaseName = path.join(
    ocrDir,
    `${job.name}-page-${String(pageIndex + 1).padStart(3, "0")}`
  );

  console.log(`Running OCR on ${job.name}, page ${pageIndex + 1}: ${imagePath}`);

  execFileSync(
    tesseractPath,
    [
      imagePath,
      outputBaseName,
      "-l",
      "eng",
      "--psm",
      "6"
    ],
    {
      stdio: "inherit",
      windowsHide: true
    }
  );

  const pageTextPath = `${outputBaseName}.txt`;

  if (!fs.existsSync(pageTextPath)) {
    throw new Error(`Tesseract did not create expected text file: ${pageTextPath}`);
  }

  return fs.readFileSync(pageTextPath, "utf8");
}

function runOcrJob(tesseractPath, pdftoppmPath, job) {
  const ocrDir = path.join(projectRoot, "ocr", job.name);
  ensureDirectoryExists(ocrDir);
  cleanOldFiles(ocrDir, [".txt"]);

  const pageImages = convertPdfToPngPages(pdftoppmPath, job);
  const allPageTexts = [];

  pageImages.forEach((imagePath, index) => {
    const pageText = runTesseractOnImage(tesseractPath, imagePath, job, index);

    allPageTexts.push([
      `----- ${job.name} PAGE ${index + 1} START -----`,
      pageText.trim(),
      `----- ${job.name} PAGE ${index + 1} END -----`
    ].join("\n"));
  });

  const finalText = allPageTexts.join("\n\n");
  const finalOcrTextPath = path.join(
    projectRoot,
    "ocr",
    `${job.name}-tesseract-ocr.txt`
  );

  fs.writeFileSync(finalOcrTextPath, finalText, "utf8");

  console.log(`OCR complete for ${job.name}.`);
  console.log(`Final OCR text saved to: ${finalOcrTextPath}`);
  console.log("Preview:");
  console.log(finalText.slice(0, 2000));

  return {
    name: job.name,
    inputPdfFile: job.inputPdfFile,
    pageCount: pageImages.length,
    outputTextFile: finalOcrTextPath,
    preview: finalText.slice(0, 500)
  };
}

function main() {
  try {
    ensureDirectoryExists(path.join(projectRoot, "images"));
    ensureDirectoryExists(path.join(projectRoot, "ocr"));

    console.log("Finding Tesseract...");
    const tesseractPath = findWorkingCommand(
      tesseractCandidates,
      ["--version"],
      "Tesseract"
    );
    console.log(`Using Tesseract: ${tesseractPath}`);

    console.log("Finding Poppler pdftoppm...");
    const pdftoppmPath = findWorkingCommand(
      pdftoppmCandidates,
      ["-h"],
      "Poppler pdftoppm"
    );
    console.log(`Using pdftoppm: ${pdftoppmPath}`);

    const results = [];

    for (const job of pdfJobs) {
      const result = runOcrJob(tesseractPath, pdftoppmPath, job);
      results.push(result);
    }

    const summaryPath = path.join(projectRoot, "ocr", "tesseract-ocr-run-summary.json");

    const summary = {
      completedAt: new Date().toISOString(),
      tesseractPath,
      pdftoppmPath,
      jobCount: results.length,
      jobs: results
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

    console.log("------------------------------------------------------------");
    console.log("All OCR jobs complete.");
    console.log(`Summary saved to: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("OCR extraction failed:");
    console.error(error.message);
    process.exit(1);
  }
}

main();