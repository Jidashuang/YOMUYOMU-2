// Reading position is persisted in ReadingProgress.last_position as "page:<index>".
// Pure helpers so the format has one source of truth and is unit-testable.
const PAGE_PREFIX = "page:";

export function formatReadingPosition(pageIndex: number): string {
  return `${PAGE_PREFIX}${Math.max(0, Math.floor(pageIndex))}`;
}

export function parseReadingPosition(value: string | null | undefined): number | null {
  if (!value || !value.startsWith(PAGE_PREFIX)) {
    return null;
  }
  const parsed = Number.parseInt(value.slice(PAGE_PREFIX.length), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export function pageFromProgressPercent(progressPercent: number | null | undefined, totalPages: number): number | null {
  if (progressPercent === null || progressPercent === undefined || !Number.isFinite(progressPercent) || totalPages <= 0) {
    return null;
  }
  const pct = Math.min(100, Math.max(0, progressPercent));
  if (pct === 0) {
    return 0;
  }
  return Math.min(totalPages - 1, Math.max(0, Math.ceil((pct / 100) * totalPages) - 1));
}
