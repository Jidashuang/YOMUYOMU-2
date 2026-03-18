"use client";

import type { ArticleBlock, ArticleToken, HighlightResponse, JlptLevel } from "@yomuyomu/shared-types";
import { useRef } from "react";

import { closestTokenElement, tokenHasHighlight } from "./reader-utils";
import type { SelectedTokenState, SelectionMenuState } from "./types";

const jlptClassMap: Record<JlptLevel, string> = {
  N5: "text-emerald-900 dark:text-emerald-300",
  N4: "text-teal-900 dark:text-teal-300",
  N3: "text-sky-900 dark:text-sky-300",
  N2: "text-amber-900 dark:text-amber-300",
  N1: "text-rose-900 dark:text-rose-300",
  Unknown: "text-zinc-900 dark:text-zinc-200",
};

interface ReaderArticleViewProps {
  blocks: ArticleBlock[];
  highlightsByBlock: Map<string, HighlightResponse[]>;
  onTokenSelect: (value: SelectedTokenState) => void;
  onSelectionChange: (menu: SelectionMenuState | null, error: string | null) => void;
}

export function ReaderArticleView({
  blocks,
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
    <article data-testid="reader-article-view" className="reader-text rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div ref={articleContainerRef} className="space-y-6" onMouseUp={handleSelectionMenu}>
        {blocks.map((block) => (
          <p key={block.id} className="leading-relaxed">
            {block.tokens.length > 0
              ? block.tokens.map((token: ArticleToken, tokenIndex: number) => {
                  const highlighted = tokenHasHighlight(block.id, token, highlightsByBlock);
                  return (
                    <span
                      key={`${block.id}-${tokenIndex}`}
                      data-testid="reader-token"
                      data-block-id={block.id}
                      data-token-start={token.start_offset}
                      data-token-end={token.end_offset}
                      className={`mx-[1px] rounded px-0.5 py-0.5 transition select-text ${jlptClassMap[token.jlpt_level]} ${highlighted ? "bg-yellow-200/70 dark:bg-yellow-700/40" : ""}`}
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
                      {token.surface}
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
