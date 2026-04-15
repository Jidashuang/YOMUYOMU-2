import type { ArticleToken, HighlightResponse } from "@yomuyomu/shared-types";
import type { SentenceContext } from "./types";

export function isSentenceDelimiter(char: string): boolean {
  return /[。！？!?]/.test(char);
}

export function sentenceContextFromBlock(blockText: string, startOffset: number, endOffset: number): SentenceContext {
  let sentenceStart = Math.max(0, startOffset);
  while (sentenceStart > 0 && !isSentenceDelimiter(blockText[sentenceStart - 1])) {
    sentenceStart -= 1;
  }

  let sentenceEnd = Math.min(blockText.length, endOffset);
  while (sentenceEnd < blockText.length && !isSentenceDelimiter(blockText[sentenceEnd])) {
    sentenceEnd += 1;
  }
  if (sentenceEnd < blockText.length) {
    sentenceEnd += 1;
  }

  let previousEnd = sentenceStart - 1;
  while (previousEnd >= 0 && /\s/.test(blockText[previousEnd])) {
    previousEnd -= 1;
  }
  let previousStart = previousEnd;
  while (previousStart > 0 && !isSentenceDelimiter(blockText[previousStart - 1])) {
    previousStart -= 1;
  }

  let nextStart = sentenceEnd;
  while (nextStart < blockText.length && /\s/.test(blockText[nextStart])) {
    nextStart += 1;
  }
  let nextEnd = nextStart;
  while (nextEnd < blockText.length && !isSentenceDelimiter(blockText[nextEnd])) {
    nextEnd += 1;
  }
  if (nextEnd < blockText.length) {
    nextEnd += 1;
  }

  return {
    sentence: blockText.slice(sentenceStart, sentenceEnd).trim() || blockText.slice(startOffset, endOffset).trim(),
    previousSentence: previousEnd >= previousStart ? blockText.slice(previousStart, previousEnd + 1).trim() : "",
    nextSentence: nextStart < blockText.length ? blockText.slice(nextStart, nextEnd).trim() : "",
  };
}

export function closestTokenElement(node: Node | null): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.dataset.tokenStart !== undefined &&
      current.dataset.tokenEnd !== undefined &&
      current.dataset.blockId
    ) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

export function tokenHasHighlight(
  blockId: string,
  token: ArticleToken,
  highlightsByBlock: Map<string, HighlightResponse[]>
): boolean {
  const rows = highlightsByBlock.get(blockId) ?? [];
  return rows.some((row) => {
    const start = row.start_offset_in_block ?? 0;
    const end = row.end_offset_in_block ?? 0;
    return token.start_offset < end && token.end_offset > start;
  });
}

export function clampFloatingPosition(
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  gap = 8,
  margin = 8
): { left: number; top: number } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const left = Math.min(
    Math.max(anchorX - width / 2, margin),
    Math.max(margin, viewportWidth - width - margin)
  );

  const preferredTop = Math.max(anchorY, margin);
  const fitsBelow = preferredTop + height + margin <= viewportHeight;
  const top = fitsBelow
    ? preferredTop
    : Math.max(margin, Math.min(anchorY - height - gap * 2, viewportHeight - height - margin));

  return { left, top };
}
