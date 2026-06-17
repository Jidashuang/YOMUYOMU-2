"use client";

import type { ArticleBlock, ArticleToken, HighlightResponse, JlptLevel } from "@yomuyomu/shared-types";
import { useRef } from "react";

import {
  katakanaToHiragana,
  shouldAnnotate,
  shouldShowFurigana,
  type AnnotationLevel,
} from "../../../../lib/reader-annotation";
import { closestTokenElement, tokenHasHighlight } from "./reader-utils";
import type { SelectedTokenState, SelectionMenuState } from "./types";

export type { AnnotationLevel };

const jlptClassMap: Record<JlptLevel, string> = {
  N5: "text-zinc-900 dark:text-zinc-200",
  N4: "text-zinc-900 dark:text-zinc-200",
  N3: "bg-sky-100 text-sky-950 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  N2: "bg-amber-100 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  N1: "bg-rose-100 text-rose-950 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
  Unknown: "text-zinc-900 dark:text-zinc-200",
};
const neutralTokenClass = "text-zinc-900 dark:text-zinc-200";

function annotationClassForToken(token: ArticleToken, annotationLevel: AnnotationLevel) {
  if (shouldAnnotate(token.jlpt_level, annotationLevel)) {
    return jlptClassMap[token.jlpt_level];
  }
  return neutralTokenClass;
}

interface ReaderArticleViewProps {
  blocks: ArticleBlock[];
  annotationLevel: AnnotationLevel;
  furiganaVisible: boolean;
  highlightsByBlock: Map<string, HighlightResponse[]>;
  onTokenSelect: (value: SelectedTokenState) => void;
  onSelectionChange: (menu: SelectionMenuState | null, error: string | null) => void;
}

export function ReaderArticleView({
  blocks,
  annotationLevel,
  furiganaVisible,
  highlightsByBlock,
  onTokenSelect,
  onSelectionChange,
}: ReaderArticleViewProps) {
  const articleContainerRef = useRef<HTMLDivElement | null>(null);

  function handleSelectionMenu() {
    const container = articleContainerRef.current;
    if (!container) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      onSelectionChange(null, null);
      return;
    }

    const range = selection.getRangeAt(0);
    const startEl = closestTokenElement(range.startContainer);
    const endEl = closestTokenElement(range.endContainer);

    if (!startEl || !endEl) {
      onSelectionChange(null, "仅支持在正文 token 范围内划线。");
      return;
    }

    const startBlockId = startEl.dataset.blockId;
    const endBlockId = endEl.dataset.blockId;
    if (!startBlockId || !endBlockId || startBlockId !== endBlockId) {
      onSelectionChange(null, "暂不支持跨 block 划线，请在同一段落内选择。");
      return;
    }

    const tokenElements = Array.from(
      container.querySelectorAll<HTMLElement>(`[data-block-id='${startBlockId}'][data-token-start][data-token-end]`)
    );
    const covered = tokenElements.filter((element) => range.intersectsNode(element));
    if (covered.length === 0) {
      onSelectionChange(null, "未找到可定位 token，请重试。");
      return;
    }

    const starts = covered.map((element) => Number(element.dataset.tokenStart ?? "0"));
    const ends = covered.map((element) => Number(element.dataset.tokenEnd ?? "0"));
    const startOffsetInBlock = Math.min(...starts);
    const endOffsetInBlock = Math.max(...ends);

    const block = blocks.find((item) => item.id === startBlockId);
    if (!block) {
      onSelectionChange(null, "段落不存在。");
      return;
    }

    const textQuote = block.text.slice(startOffsetInBlock, endOffsetInBlock);
    const rect = range.getBoundingClientRect();

    onSelectionChange(
      {
        blockId: startBlockId,
        startOffsetInBlock,
        endOffsetInBlock,
        textQuote,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      },
      null
    );
  }

  return (
    <article
      lang="ja"
      data-testid="reader-article-view"
      className="reader-text reader-surface rounded-2xl border p-6 shadow-sm sm:p-8"
    >
      <div ref={articleContainerRef} className="reader-measure space-y-6" onMouseUp={handleSelectionMenu}>
        {blocks.map((block) => (
          <p key={block.id} id={`reader-block-${block.id}`} className="scroll-mt-24 leading-relaxed">
            {block.tokens.length > 0
              ? block.tokens.map((token: ArticleToken, tokenIndex: number) => {
                  const highlighted = tokenHasHighlight(block.id, token, highlightsByBlock);
                  const tokenClass = annotationClassForToken(token, annotationLevel);
                  return (
                    <span
                      key={`${block.id}-${tokenIndex}`}
                      data-testid="reader-token"
                      data-block-id={block.id}
                      data-token-start={token.start_offset}
                      data-token-end={token.end_offset}
                      className={`rounded-sm transition-colors select-text ${tokenClass} ${
                        highlighted ? "bg-yellow-200/70 dark:bg-yellow-700/40" : ""
                      }`}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        onTokenSelect({
                          token,
                          blockId: block.id,
                          blockText: block.text,
                          x: rect.left + rect.width / 2,
                          y: rect.bottom + 8,
                        });
                      }}
                    >
                      {furiganaVisible && shouldShowFurigana(token) ? (
                        <ruby>
                          {token.surface}
                          <rt>{katakanaToHiragana(token.reading)}</rt>
                        </ruby>
                      ) : (
                        token.surface
                      )}
                    </span>
                  );
                })
              : block.text}
          </p>
        ))}
      </div>
    </article>
  );
}

export type { ReaderArticleViewProps };
