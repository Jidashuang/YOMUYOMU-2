// Reader pagination math, extracted as a pure function so it can be unit-tested without
// rendering the (large) reader page component. The reader fetches one page of blocks at a
// time; total page count is driven by total_block_count (set as soon as text is readable),
// with processed/loaded counts as floors so paging never under-reports while data streams in.
export interface ReaderPagingInput {
  totalBlockCount: number | null;
  processedBlockCount: number;
  loadedBlockCount: number;
  currentPageIndex: number;
  blocksPerPage: number;
}

export interface ReaderPaging {
  visibleBlockCount: number;
  totalReaderPages: number;
  currentReaderPage: number;
}

export function computeReaderPaging(input: ReaderPagingInput): ReaderPaging {
  const blocksPerPage = Math.max(1, input.blocksPerPage);
  const visibleBlockCount = Math.max(
    input.totalBlockCount ?? 0,
    input.processedBlockCount ?? 0,
    input.loadedBlockCount
  );
  const totalReaderPages = Math.max(1, Math.ceil(visibleBlockCount / blocksPerPage));
  const currentReaderPage = Math.min(Math.max(input.currentPageIndex, 0), totalReaderPages - 1);
  return { visibleBlockCount, totalReaderPages, currentReaderPage };
}

// Which reader page a given block index falls on (used to jump from a whole-book search hit).
export function pageForBlockIndex(blockIndex: number, blocksPerPage: number): number {
  if (blocksPerPage <= 0) {
    return 0;
  }
  return Math.max(0, Math.floor(blockIndex / blocksPerPage));
}
