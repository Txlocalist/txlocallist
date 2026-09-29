import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  createBusinessSpreadsheet,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  parseBusinessSpreadsheet,
} from "@/lib/business-import-file";

const cities = [{ id: "city-a", name: "Austin", slug: "austin" }, { id: "city-b", name: "San Marcos", slug: "san-marcos" }];
const categories = [{ id: "cat-a", name: "Food & Drink", slug: "food-drink" }];
const file = (content, name = "businesses.csv") => new File([content], name);

async function excelFile(rows, { sheetName = "Businesses", extraSheet = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRows(rows);
  if (extraSheet) {
    const ignored = workbook.addWorksheet("Unrelated");
    ignored.addRows([["Not", "business", "headers"], [{ formula: "1+1", result: 2 }]]);
  }
  return file(await workbook.xlsx.writeBuffer(), "businesses.xlsx");
}

// Minimal single-entry ZIP fixture. Inflation-size checks intentionally happen
// before ExcelJS has any opportunity to read its XML or CRC.
function zipFixture(content, { declaredSize = content.length, entryName = "xl/workbook.xml" } = {}) {
  const name = Buffer.from(entryName);
  const compressed = deflateRawSync(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
}

describe("business spreadsheet parsing", () => {
  it("reads reordered, trimmed headers, Unicode, quoted commas and newlines, and skips blank rows", async () => {
    const content = '\ufeff Category , NAME ,City\r\nFood & Drink,"Café, \\"local\\"",Austin';
    // CSV escaping is doubled double quotes, including inside multiline fields.
    const csv = content.replace('\\"local\\"', '""local""') + '\r\n,,\r\nFood & Drink,"Bakery\nAnnex", San Marcos \r\n';
    const result = await parseBusinessSpreadsheet(file(csv));
    expect(result.issues).toEqual([]);
    expect(result.rows).toEqual([
      { row: 2, name: 'Café, "local"', city: "Austin", category: "Food & Drink" },
      { row: 4, name: "Bakery\nAnnex", city: "San Marcos", category: "Food & Drink" },
    ]);
    expect(result.fileHash).toBe(createHash("sha256").update(csv).digest("hex"));
  });

  it("imports only Businesses, ignoring unrelated worksheet contents", async () => {
    const result = await parseBusinessSpreadsheet(await excelFile([
      ["Name", "City", "Category"], [], [" Café Local ", " Austin ", "Food & Drink"],
    ], { extraSheet: true }));
    expect(result.issueCount).toBe(0);
    expect(result.rows).toEqual([{ row: 3, name: "Café Local", city: "Austin", category: "Food & Drink" }]);
  });

  it("requires the Businesses worksheet", async () => {
    await expect(parseBusinessSpreadsheet(await excelFile([["Name", "City", "Category"]], { sheetName: "Sheet1" })))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('"Businesses"') });
  });

  it.each([
    ["Name,City,Kind\nShop,Austin,Food", "category header is required"],
    ["Name,City,Category,Name\nShop,Austin,Food,Other", "name header appears more than once"],
    ["Name,City,Category,Address\nShop,Austin,Food,123 Main", "Unexpected header"],
    ["Name,City,Category\nShop,Austin,Food,123 Main", "extra values"],
    ["Name,City,Category\n,Austin,Food", "Name is required"],
    ["Name,City,Category\nShop,,Food", "City is required"],
    ["Name,City,Category\nShop,Austin,", "Category is required"],
  ])("reports row-specific problems: %s", async (csv, message) => {
    const result = await parseBusinessSpreadsheet(file(csv));
    expect(result.issueCount).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.message.includes(message))).toBe(true);
    expect(result.issues.every((issue) => Number.isInteger(issue.row) && issue.field)).toBe(true);
  });

  it("accepts empty trailing columns without treating them as data", async () => {
    const result = await parseBusinessSpreadsheet(file("Name,City,Category,,\nShop,Austin,Food,,\n,,,,\n"));
    expect(result.issueCount).toBe(0);
    expect(result.rows).toHaveLength(1);
  });

  it("preserves potential duplicates for the database's canonical identity validation", async () => {
    const result = await parseBusinessSpreadsheet(file("Name,City,Category\nShop,Austin,Food\n shop , AUSTIN ,Other\nShop,Dallas,Food"));
    expect(result.issueCount).toBe(0);
    expect(result.rows).toHaveLength(3);
  });

  it("bounds displayed issues while retaining their true count", async () => {
    const result = await parseBusinessSpreadsheet(file(`Name,City,Category\n${Array.from({ length: 150 }, (_, index) => `Business ${index},,`).join("\n")}`));
    expect(result.issueCount).toBe(300);
    expect(result.issues).toHaveLength(100);
    expect(result.rows).toHaveLength(0);
  });

  it("enforces text lengths and rejects embedded control characters", async () => {
    const result = await parseBusinessSpreadsheet(file(`Name,City,Category\n${"N".repeat(201)},${"C".repeat(101)},${"T".repeat(101)}\nBad\u0000Name,Austin,Food`));
    expect(result.issueCount).toBe(4);
    expect(result.issues.map((issue) => issue.field)).toEqual(["name", "city", "category", "name"]);
  });

  it("rejects real Excel formulas, including cached results and shared formulas", async () => {
    const result = await parseBusinessSpreadsheet(await excelFile([
      ["Name", "City", "Category"],
      [{ formula: '"Shop"', result: "Shop", shareType: "shared", ref: "A2:A3" }, "Austin", "Food"],
      [{ sharedFormula: "A2", result: "Shop 2" }, "Austin", "Food"],
    ]));
    expect(result.issues.filter((issue) => issue.message.startsWith("Formulas"))).toHaveLength(2);
    expect(result.rows).toEqual([]);
  });

  it("rejects dates, rich text, hyperlink and error cells rather than silently stringifying objects", async () => {
    const result = await parseBusinessSpreadsheet(await excelFile([
      ["Name", "City", "Category"],
      [new Date("2026-01-01T00:00:00.000Z"), "Austin", "Food"],
      [{ richText: [{ text: "Shop" }] }, "Austin", "Food"],
      [{ text: "Shop", hyperlink: "https://example.com" }, "Austin", "Food"],
      [{ error: "#VALUE!" }, "Austin", "Food"],
    ]));
    expect(result.rows).toHaveLength(0);
    expect(result.issues.filter((issue) => issue.message.startsWith("Use plain text"))).toHaveLength(4);
  });

  it.each(["Name,City,Category\n", "Name,City,Category\n,,\n"]) ("blocks header-only or blank-data replacement", async (csv) => {
    const result = await parseBusinessSpreadsheet(file(csv));
    expect(result.issueCount).toBe(1);
    expect(result.issues[0].message).toContain("cannot clear");
  });

  it.each([
    ["", "empty.csv", "empty"],
    ["\n\n", "blank.csv", "empty"],
    ["Name,City,Category", "old.xls", "Only Excel"],
    ['Name,City,Category\n"unclosed,Austin,Food', "bad.csv", "malformed"],
    [Buffer.from([0x4e, 0x61, 0xff]), "bad.csv", "UTF-8"],
    ["not-a-zip", "bad.xlsx", "valid Excel"],
    [Buffer.alloc(MAX_IMPORT_FILE_BYTES + 1), "huge.csv", "3 MiB"],
  ])("rejects unsupported or malformed files: %s", async (content, name, message) => {
    await expect(parseBusinessSpreadsheet(file(content, name))).rejects.toMatchObject({ status: 400, message: expect.stringContaining(message) });
  });

  it("checks the declared upload size before reading file bytes", async () => {
    await expect(parseBusinessSpreadsheet({ name: "big.xlsx", size: MAX_IMPORT_FILE_BYTES + 1, arrayBuffer() { throw new Error("must not read"); } }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining("3 MiB") });
  });

  it("accepts exactly 10,000 rows and rejects a 10,001st business", async () => {
    const csv = `Name,City,Category\n${Array.from({ length: MAX_IMPORT_ROWS }, (_, index) => `Business ${index},Austin,Food`).join("\n")}`;
    const result = await parseBusinessSpreadsheet(file(csv));
    expect(result.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.issueCount).toBe(0);
    await expect(parseBusinessSpreadsheet(file(`${csv}\nOne more,Austin,Food`))).rejects.toMatchObject({ status: 400, message: expect.stringContaining("10,000") });
  });

  it("bounds actual ZIP inflation even when the archive lies about its expanded size", async () => {
    const archive = zipFixture(Buffer.alloc(32 * 1024 * 1024 + 1, 65), { declaredSize: 1 });
    expect(archive.length).toBeLessThan(MAX_IMPORT_FILE_BYTES);
    await expect(parseBusinessSpreadsheet(file(archive, "bomb.xlsx"))).rejects.toMatchObject({ status: 400, message: expect.stringContaining("32 MiB") });
  });

  it("rejects oversized declared ZIP entries before inflation", async () => {
    const archive = zipFixture(Buffer.from("tiny"), { declaredSize: 33 * 1024 * 1024 });
    await expect(parseBusinessSpreadsheet(file(archive, "bomb.xlsx"))).rejects.toMatchObject({ status: 400, message: expect.stringContaining("32 MiB") });
  });

  it("rejects named ranges that would expand millions of cells", async () => {
    const xml = '<workbook><definedNames><definedName name="Danger">Businesses!&#36;A&#36;1:&#36;A&#36;1048576</definedName></definedNames></workbook>';
    await expect(parseBusinessSpreadsheet(file(zipFixture(Buffer.from(xml)), "ranges.xlsx")))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining("named ranges") });
  });

  it.each([
    '<row><c r="A1"><v>1</v></c></row>',
    '<row r="1"><c><v>1</v></c></row>',
    '<row r="&#49;0000000"><c r="A1"><v>1</v></c></row>',
    '<row r="1"><c r="XFD1"><v>1</v></c></row>',
    '<row r="1"><c r="A&#49;0000000"><v>1</v></c></row>',
  ])("rejects missing or oversized worksheet coordinates before ExcelJS load: %s", async (xml) => {
    const archive = zipFixture(Buffer.from(`<worksheet><sheetData>${xml}</sheetData></worksheet>`), { entryName: "xl/worksheets/sheet1.xml" });
    await expect(parseBusinessSpreadsheet(file(archive, "coordinates.xlsx"))).rejects.toMatchObject({ status: 400 });
  });
});

describe("business spreadsheet downloads", () => {
  const rows = [
    { name: 'Café, "Local"', city: "Austin", category: "Food & Drink" },
    ...["=SUM(1,1)", "+Local", "-Local", "@Local", "'Local", "'=Local"].map((name) => ({ name, city: "San Marcos", category: "Food & Drink" })),
  ];

  it.each(["csv", "xlsx"])("round-trips %s without changing Unicode or formula-like business names", async (format) => {
    const buffer = await createBusinessSpreadsheet({ format, cities, categories, rows });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const result = await parseBusinessSpreadsheet(file(buffer, `businesses.${format}`));
    expect(result.issueCount).toBe(0);
    expect(result.rows.map(({ row: _row, ...business }) => business)).toEqual(rows);
    if (format === "csv") {
      expect(buffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(buffer.toString("utf8")).toContain('"\'=SUM(1,1)"');
    } else {
      const workbook = await new ExcelJS.Workbook().xlsx.load(buffer);
      expect(workbook.getWorksheet("Businesses").getCell("A3").value).toBe("=SUM(1,1)");
      expect(workbook.getWorksheet("Businesses").getCell("A3").type).toBe(ExcelJS.ValueType.String);
    }
  });

  it("generates a clean, styled template with current taxonomy and dropdowns through row 10,001", async () => {
    const buffer = await createBusinessSpreadsheet({ format: "xlsx", cities, categories });
    const workbook = await new ExcelJS.Workbook().xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Businesses");
    expect(sheet.getRow(1).values.slice(1)).toEqual(["Name", "City", "Category"]);
    expect(sheet.actualRowCount).toBe(1);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.getColumn("A").width).toBeGreaterThanOrEqual(40);
    expect(sheet.getCell("A1").font.bold).toBe(true);
    expect(sheet.getCell("B2").dataValidation.formulae).toEqual(["ImportCities"]);
    expect(sheet.getCell("B10001").dataValidation.formulae).toEqual(["ImportCities"]);
    expect(sheet.getCell("C10001").dataValidation.formulae).toEqual(["ImportCategories"]);
    expect(sheet.getCell("B10002").dataValidation).toBeUndefined();
    expect(workbook.definedNames.getRanges("ImportCities").ranges).toEqual(["Reference!$A$2:$A$3"]);
    expect(workbook.getWorksheet("Reference").getCell("A2").value).toBe("Austin");
    expect(workbook.getWorksheet("Reference").getCell("B2").value).toBe("Food & Drink");
    expect(workbook.getWorksheet("Instructions").getCell("A2").value).toContain("replaces the complete");
  });

  it("generates CSV headers with no example businesses", async () => {
    const buffer = await createBusinessSpreadsheet({ format: "csv", cities, categories });
    expect(buffer.toString("utf8")).toBe('\ufeff"Name","City","Category"\r\n');
  });

  it("exports and parses a full 10,000-business Excel master sheet within the upload limit", async () => {
    const businesses = Array.from({ length: MAX_IMPORT_ROWS }, (_, index) => ({ name: `Business ${index}`, city: "Austin", category: "Food & Drink" }));
    const buffer = await createBusinessSpreadsheet({ format: "xlsx", cities, categories, rows: businesses });
    expect(buffer.length).toBeLessThan(MAX_IMPORT_FILE_BYTES);
    const result = await parseBusinessSpreadsheet(file(buffer, "full.xlsx"));
    expect(result.issueCount).toBe(0);
    expect(result.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.rows.at(-1)).toEqual({ row: 10_001, ...businesses.at(-1) });
  });
});
