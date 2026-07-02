import { describe, it, expect } from "vitest";
import { toCsv, type Cell } from "@/lib/export/csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("prefixes the output with a UTF-8 BOM", () => {
    const csv = toCsv(["a"], [["1"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("joins rows with CRLF", () => {
    const csv = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe(`${BOM}a,b\r\n1,2\r\n3,4`);
  });

  it("leaves simple fields unquoted", () => {
    const csv = toCsv(["name"], [["Yasmine"]]);
    expect(csv).toBe(`${BOM}name\r\nYasmine`);
  });

  it("quotes fields containing a comma", () => {
    const csv = toCsv(["v"], [["a,b"]]);
    expect(csv).toBe(`${BOM}v\r\n"a,b"`);
  });

  it("quotes fields containing a newline or carriage return", () => {
    expect(toCsv(["v"], [["line1\nline2"]])).toBe(`${BOM}v\r\n"line1\nline2"`);
    expect(toCsv(["v"], [["line1\rline2"]])).toBe(`${BOM}v\r\n"line1\rline2"`);
  });

  it("quotes and doubles embedded quotes", () => {
    const csv = toCsv(["v"], [['say "hi"']]);
    expect(csv).toBe(`${BOM}v\r\n"say ""hi"""`);
  });

  it("renders null and undefined cells as empty fields", () => {
    const row: Cell[] = [null, undefined, "x"];
    const csv = toCsv(["a", "b", "c"], [row]);
    expect(csv).toBe(`${BOM}a,b,c\r\n,,x`);
  });

  it("stringifies numeric cells", () => {
    const csv = toCsv(["n"], [[42], [0]]);
    expect(csv).toBe(`${BOM}n\r\n42\r\n0`);
  });

  it("escapes header cells too", () => {
    const csv = toCsv(["a,b"], []);
    expect(csv).toBe(`${BOM}"a,b"`);
  });
});
