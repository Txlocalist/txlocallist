import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_FILE_BYTES = 3 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ISSUES = 100;
const HEADERS = ["Name", "City", "Category"];
const FIELD_LIMITS = { name: 200, city: 100, category: 100 };

function invalidFile(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// ExcelJS loads ZIP entries into memory. Bound actual inflation, not only the
// attacker-controlled declared lengths, before handing any archive to ExcelJS.
function inspectWorkbookArchive(buffer) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50 && offset + 22 + buffer.readUInt16LE(offset + 20) === buffer.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw invalidFile("This is not a valid Excel workbook. Upload an .xlsx file.");
  const entries = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryStart = buffer.readUInt32LE(end + 16);
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)
    || entries !== buffer.readUInt16LE(end + 8) || entries === 0 || entries > 256
    || directoryStart + directorySize !== end) {
    throw invalidFile("The Excel workbook archive is invalid or too complex. Save a fresh copy of the template.");
  }

  let cursor = directoryStart;
  let totalBytes = 0;
  let totalCells = 0;
  let namedCells = 0;
  const names = new Set();
  const intervals = [];
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw invalidFile("The Excel workbook archive is malformed.");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameSize = buffer.readUInt16LE(cursor + 28);
    const extraSize = buffer.readUInt16LE(cursor + 30);
    const commentSize = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameSize + extraSize + commentSize;
    if (next > end || !nameSize || flags & 1 || ![0, 8].includes(method)
      || buffer.readUInt16LE(cursor + 34) || local + 30 > directoryStart
      || uncompressedSize > MAX_ARCHIVE_BYTES - totalBytes) {
      throw invalidFile("The Excel workbook is encrypted, malformed, or exceeds the 32 MiB expanded limit.");
    }
    const nameBuffer = buffer.subarray(cursor + 46, cursor + 46 + nameSize);
    const name = nameBuffer.toString("utf8");
    if (names.has(name) || name.startsWith("/") || name.includes("\\") || name.includes("\u0000")
      || name.split("/").some((part) => part === ".." || part === ".")
      || buffer.readUInt32LE(local) !== 0x04034b50
      || buffer.readUInt16LE(local + 6) !== flags || buffer.readUInt16LE(local + 8) !== method
      || buffer.readUInt16LE(local + 26) !== nameSize) {
      throw invalidFile("The Excel workbook archive is malformed.");
    }
    names.add(name);
    const bodyStart = local + 30 + nameSize + buffer.readUInt16LE(local + 28);
    const bodyEnd = bodyStart + compressedSize;
    if (bodyEnd > directoryStart || !nameBuffer.equals(buffer.subarray(local + 30, local + 30 + nameSize))) {
      throw invalidFile("The Excel workbook archive is malformed.");
    }
    intervals.push([local, bodyEnd]);
    let expanded;
    try {
      expanded = method === 0
        ? buffer.subarray(bodyStart, bodyEnd)
        : inflateRawSync(buffer.subarray(bodyStart, bodyEnd), { maxOutputLength: Math.max(1, MAX_ARCHIVE_BYTES - totalBytes) });
    } catch {
      throw invalidFile("The Excel workbook is malformed or exceeds the 32 MiB expanded limit.");
    }
    totalBytes += expanded.length;
    if (expanded.length !== uncompressedSize || totalBytes > MAX_ARCHIVE_BYTES) {
      throw invalidFile("The Excel workbook has invalid expanded lengths or exceeds the 32 MiB expanded limit.");
    }
    if (name.endsWith(".xml")) {
      const xml = expanded.toString("utf8");
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw invalidFile("The Excel workbook contains unsupported XML declarations.");
      if (name === "xl/workbook.xml") {
        // Defined names are expanded into individual cells during ExcelJS load.
        // Decode numeric references before checking so XML escaping cannot hide
        // a huge range. Names and formatting are never needed for import.
        const decoded = decodeNumericXmlReferences(xml);
        for (const match of decoded.matchAll(/<(?:\w+:)?sheet\b[^>]*\bsheetId\s*=\s*["']([^"']+)["']/g)) {
          if (!/^\d+$/.test(match[1]) || Number(match[1]) > 65_535) {
            throw invalidFile("The workbook has unsupported worksheet identifiers. Save a fresh copy of the template.");
          }
        }
        for (const match of decoded.matchAll(/<(?:\w+:)?definedName\b[^>]*>([\s\S]*?)<\//g)) {
          for (const address of match[1].matchAll(/\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?/gi)) {
            const firstColumn = columnNumber(address[1]);
            const lastColumn = columnNumber(address[3] || address[1]);
            const firstRow = Number(address[2]);
            const lastRow = Number(address[4] || address[2]);
            namedCells += (Math.abs(lastColumn - firstColumn) + 1) * (Math.abs(lastRow - firstRow) + 1);
            if (Math.max(firstColumn, lastColumn) > 256 || Math.max(firstRow, lastRow) > 100_001 || namedCells > 150_000) {
              throw invalidFile("The workbook contains oversized named ranges. Save only the business list.");
            }
          }
        }
      }
      if (/xl\/worksheets\/[^/]+\.xml$/.test(name)) {
        for (const match of xml.matchAll(/<(?:\w+:)?row\b([^>]*)/g)) {
          const rowNumber = /\br\s*=\s*["'](\d+)["']/.exec(decodeNumericXmlReferences(match[1]))?.[1];
          if (!rowNumber || Number(rowNumber) < 1 || Number(rowNumber) > 100_001) throw invalidFile("The workbook contains invalid rows or rows far outside the template. Save only the business list.");
        }
        for (const match of xml.matchAll(/<(?:\w+:)?c\b([^>]*)/g)) {
          totalCells++;
          const address = /\br\s*=\s*["']([A-Z]+)(\d+)["']/.exec(decodeNumericXmlReferences(match[1]));
          if (totalCells > 150_000 || !address || columnNumber(address[1]) > 256 || Number(address[2]) < 1 || Number(address[2]) > 100_001) {
            throw invalidFile("The workbook contains too many cells. Save only the business list.");
          }
        }
      }
    }
    cursor = next;
  }
  if (cursor !== end || !names.has("xl/workbook.xml")) throw invalidFile("This is not a valid Excel workbook.");
  intervals.sort((a, b) => a[0] - b[0]);
  if (intervals.some((interval, index) => index > 0 && interval[0] < intervals[index - 1][1])) {
    throw invalidFile("The Excel workbook archive contains overlapping entries.");
  }
}

function columnNumber(letters) {
  return [...letters.toUpperCase()].reduce((result, letter) => result * 26 + letter.charCodeAt(0) - 64, 0);
}

function decodeNumericXmlReferences(xml) {
  return xml.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
    const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
    return point <= 0x10ffff ? String.fromCodePoint(point) : "";
  });
}

// CSV cannot declare text cell types. The download escapes formula-like values
// with an apostrophe and doubles literal leading apostrophes; undo exactly that
// convention on import so the application's own exports round-trip unchanged.
function unescapeCsvText(value) {
  return /^'(?:\s*[=+\-@]|['\t\r\n])/.test(value) ? value.slice(1) : value;
}

function escapeCsvText(value) {
  return /^(?:\s*[=+\-@]|['\t\r\n])/.test(value) ? `'${value}` : value;
}

function createRowReader(issues) {
  const rows = [];
  let header;
  let issueCount = 0;
  let dataRowCount = 0;
  const addIssue = (row, field, message) => {
    issueCount++;
    if (issues.length < MAX_ISSUES) issues.push({ row, field, message });
  };

  function cellText(value, row, field) {
    if (value == null) return "";
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
      const text = String(value).trim();
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
        addIssue(row, field, "Remove unsupported control characters.");
      }
      return text;
    }
    const formula = typeof value === "object" && ("formula" in value || "sharedFormula" in value);
    addIssue(row, field, formula ? "Formulas are not allowed. Paste the value as plain text." : "Use plain text, without dates, links, errors, or other cell objects.");
    return "";
  }

  function read(values, row) {
    if (values.every((value) => value == null || (typeof value === "string" && !value.trim()))) return;
    if (!header) {
      header = {};
      values.forEach((value, index) => {
        const label = cellText(value, row, "Headers").toLowerCase();
        if (!label) return;
        if (!Object.hasOwn(FIELD_LIMITS, label)) addIssue(row, "Headers", `Unexpected header "${label}". Use only Name, City, Category.`);
        else if (Object.hasOwn(header, label)) addIssue(row, "Headers", `The ${label} header appears more than once.`);
        else header[label] = index;
      });
      for (const label of Object.keys(FIELD_LIMITS)) {
        if (!Object.hasOwn(header, label)) addIssue(row, "Headers", `The ${label} header is required.`);
      }
      return;
    }
    dataRowCount++;
    if (dataRowCount > MAX_IMPORT_ROWS) throw invalidFile(`Upload no more than ${MAX_IMPORT_ROWS.toLocaleString("en-US")} businesses at a time.`);
    const before = issueCount;
    const output = { row };
    for (const [field, maxLength] of Object.entries(FIELD_LIMITS)) {
      const value = cellText(values[header[field]], row, field);
      output[field] = value;
      if (!value) addIssue(row, field, `${HEADERS.find((label) => label.toLowerCase() === field)} is required.`);
      else if (value.length > maxLength) addIssue(row, field, `Use ${maxLength} characters or fewer.`);
    }
    const knownColumns = new Set(Object.values(header));
    values.forEach((value, index) => {
      if (!knownColumns.has(index) && value != null && !(typeof value === "string" && !value.trim())) {
        addIssue(row, "Columns", "Remove extra values outside the Name, City, Category columns.");
      }
    });
    if (before === issueCount) rows.push(output);
  }

  return {
    read,
    finish() {
      if (!header) throw invalidFile("The file is empty. Add Name, City, Category headers and at least one business.");
      if (!dataRowCount) addIssue(1, "Rows", "Add at least one business. An empty file cannot clear the directory.");
      return { rows, issues, issueCount };
    },
  };
}

export async function parseBusinessSpreadsheet(file) {
  if (!file || typeof file.arrayBuffer !== "function" || typeof file.name !== "string") {
    throw invalidFile("Choose an Excel (.xlsx) or CSV (.csv) file.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "csv"].includes(extension)) throw invalidFile("Only Excel (.xlsx) and UTF-8 CSV (.csv) files are supported.");
  if (file.size > MAX_IMPORT_FILE_BYTES) throw invalidFile("The file exceeds the 3 MiB upload limit.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_IMPORT_FILE_BYTES) throw invalidFile("The file exceeds the 3 MiB upload limit.");
  if (!buffer.length) throw invalidFile("The file is empty. Add at least one business before uploading.");
  const reader = createRowReader([]);
  if (extension === "csv") {
    let input;
    try {
      input = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw invalidFile("Save the CSV using UTF-8 encoding and try again.");
    }
    let row = 0;
    try {
      parse(input, {
        bom: true,
        relax_column_count: true,
        max_record_size: 8192,
        on_record(record) {
          row++;
          reader.read(record.map((value) => unescapeCsvText(value.trim())), row);
          return null;
        },
      });
    } catch (error) {
      if (error.status === 400) throw error;
      throw invalidFile(`The CSV is malformed near row ${row + 1}. Check its quotes and column separators.`);
    }
  } else {
    inspectWorkbookArchive(buffer);
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer, {
        maxRows: 100_001,
        maxCols: 256,
        // Avoid expanding formatting/validation ranges into potentially millions
        // of cells. Import reads explicit cell values, never these workbook UI features.
        ignoreNodes: ["cols", "mergeCells", "dataValidations", "conditionalFormatting", "extLst", "drawing", "picture", "tableParts"],
      });
    } catch {
      throw invalidFile("The Excel workbook could not be read. Save a fresh .xlsx copy of the template.");
    }
    const sheet = workbook.getWorksheet("Businesses");
    if (!sheet) throw invalidFile('The workbook must have a worksheet named "Businesses".');
    sheet.eachRow((row) => reader.read(Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).value), row.number));
  }
  return { fileHash: createHash("sha256").update(buffer).digest("hex"), ...reader.finish() };
}

export async function createBusinessSpreadsheet({ format, cities = [], categories = [], rows = [] }) {
  const values = rows.map((row) => [row.name, row.city, row.category].map((value) => String(value ?? "")));
  if (format === "csv") {
    return Buffer.from(stringify([HEADERS, ...values.map((row) => row.map(escapeCsvText))], { bom: true, quoted: true, record_delimiter: "\r\n" }), "utf8");
  }
  if (format !== "xlsx") throw invalidFile("Choose xlsx or csv for the download format.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TX Localist";
  const businesses = workbook.addWorksheet("Businesses", { views: [{ state: "frozen", ySplit: 1 }] });
  businesses.columns = HEADERS.map((header, index) => ({ header, width: index === 0 ? 44 : 30, style: { numFmt: "@" } }));
  businesses.addRows(values);
  businesses.autoFilter = "A1:C1";
  businesses.getRow(1).height = 26;
  businesses.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFAF5ED" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF594334" } };
    cell.alignment = { vertical: "middle" };
  });

  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 110 }];
  [
    "TX Localist — Other businesses",
    "Enter businesses on the Businesses worksheet. Uploading and publishing replaces the complete imported directory across every city.",
    "Use the Name, City, Category headers. Each business must have one city and one category from the Reference worksheet.",
    "Use the City and Category dropdowns. Names are matched without regard to case and surrounding whitespace is removed.",
    "Include no more than 10,000 businesses. File uploads must be 3 MiB or smaller. Blank rows are ignored.",
    "Use plain text. Paste formula results as values. Do not include duplicate business names within the same city.",
    "Preview the additions, changes, and removals before selecting Publish list. The preview does not change the public directory.",
    "Businesses that already have a public full listing remain in this master sheet but are hidden in Other businesses.",
    "Only Businesses is imported. This Instructions worksheet and the Reference worksheet are not imported.",
    "CSV exports use UTF-8. To prevent spreadsheet formulas, values starting = + - @ are prefixed with an apostrophe; literal leading apostrophes are doubled. Import reverses that escape.",
    "Keep a complete master copy. An empty spreadsheet cannot clear the public directory.",
  ].forEach((text) => instructions.addRow([text]));
  instructions.getRow(1).font = { bold: true, size: 16 };
  instructions.eachRow((row) => { row.alignment = { wrapText: true, vertical: "top" }; row.height = 34; });

  const reference = workbook.addWorksheet("Reference", { views: [{ state: "frozen", ySplit: 1 }] });
  reference.columns = [{ header: "Cities", width: 34 }, { header: "Categories", width: 34 }];
  const cityNames = [...cities].map((city) => city.name).sort((a, b) => a.localeCompare(b));
  const categoryNames = [...categories].map((category) => category.name).sort((a, b) => a.localeCompare(b));
  for (let index = 0; index < Math.max(cityNames.length, categoryNames.length); index++) {
    reference.addRow([cityNames[index] ?? "", categoryNames[index] ?? ""]);
  }
  reference.getRow(1).font = { bold: true };
  for (const [column, rangeName, count, target] of [
    ["A", "ImportCities", cityNames.length, "B"],
    ["B", "ImportCategories", categoryNames.length, "C"],
  ]) {
    if (!count) continue;
    workbook.definedNames.add(`Reference!$${column}$2:$${column}$${count + 1}`, rangeName);
    businesses.dataValidations.add(`${target}2:${target}${MAX_IMPORT_ROWS + 1}`, {
      type: "list", allowBlank: false, formulae: [rangeName], showErrorMessage: true,
      errorStyle: "stop", errorTitle: "Choose a current directory value", error: "Select a value from the dropdown or copy it from Reference.",
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
