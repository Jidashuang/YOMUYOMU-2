import { describe, expect, it } from "vitest";

import { computeReaderPaging } from "./reader-paging";

describe("computeReaderPaging", () => {
  it("derives the page count from the total block count", () => {
    const paging = computeReaderPaging({
      totalBlockCount: 40,
      processedBlockCount: 0,
      loadedBlockCount: 18,
      currentPageIndex: 0,
      blocksPerPage: 18,
    });
    expect(paging.visibleBlockCount).toBe(40);
    expect(paging.totalReaderPages).toBe(3); // ceil(40 / 18)
    expect(paging.currentReaderPage).toBe(0);
  });

  it("never returns fewer than one page", () => {
    const paging = computeReaderPaging({
      totalBlockCount: 0,
      processedBlockCount: 0,
      loadedBlockCount: 0,
      currentPageIndex: 0,
      blocksPerPage: 18,
    });
    expect(paging.totalReaderPages).toBe(1);
  });

  it("clamps the current page into range", () => {
    const paging = computeReaderPaging({
      totalBlockCount: 20,
      processedBlockCount: 0,
      loadedBlockCount: 18,
      currentPageIndex: 9,
      blocksPerPage: 18,
    });
    expect(paging.totalReaderPages).toBe(2);
    expect(paging.currentReaderPage).toBe(1);
  });

  it("uses processed/loaded counts as a floor when total is unknown", () => {
    const paging = computeReaderPaging({
      totalBlockCount: null,
      processedBlockCount: 30,
      loadedBlockCount: 18,
      currentPageIndex: 0,
      blocksPerPage: 18,
    });
    expect(paging.visibleBlockCount).toBe(30);
    expect(paging.totalReaderPages).toBe(2);
  });
});
