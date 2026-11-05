import { describe, expect, it } from "vitest";

import { formatReadingPosition, pageFromProgressPercent, parseReadingPosition } from "./reading-position";

describe("reading position", () => {
  it("round-trips a page index", () => {
    expect(parseReadingPosition(formatReadingPosition(14))).toBe(14);
    expect(formatReadingPosition(0)).toBe("page:0");
    expect(formatReadingPosition(7)).toBe("page:7");
  });

  it("clamps negative input when formatting", () => {
    expect(formatReadingPosition(-3)).toBe("page:0");
  });

  it("returns null for legacy / invalid values", () => {
    expect(parseReadingPosition(null)).toBeNull();
    expect(parseReadingPosition(undefined)).toBeNull();
    expect(parseReadingPosition("")).toBeNull();
    expect(parseReadingPosition("manual:50")).toBeNull(); // old format must not restore a page
    expect(parseReadingPosition("page:-1")).toBeNull();
    expect(parseReadingPosition("page:abc")).toBeNull();
  });

  it("can restore an approximate page from saved progress percent", () => {
    expect(pageFromProgressPercent(0, 10)).toBe(0);
    expect(pageFromProgressPercent(10, 10)).toBe(0);
    expect(pageFromProgressPercent(50, 10)).toBe(4);
    expect(pageFromProgressPercent(100, 10)).toBe(9);
    expect(pageFromProgressPercent(null, 10)).toBeNull();
    expect(pageFromProgressPercent(50, 0)).toBeNull();
  });
});
