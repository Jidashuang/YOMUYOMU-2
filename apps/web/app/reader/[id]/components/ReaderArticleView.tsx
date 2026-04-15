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
  onTokenSelect: (value: SelectedTokenState, triggerElement: HTMLElement) => void;
  onTokenActionMenu: (menu: SelectionMenuState, triggerElement: HTMLElement) => void;
  onSelectionChange: (menu: SelectionMenuState | null, error: string | null, triggerElement?: HTMLElement | null) => void;
  focusedBlockId?: string | null;
}

export function ReaderArticleView({
  blocks,
  highlightsByBlock,
  onTokenSelect,
  onTokenActionMenu,
  onSelectionChange,
  focusedBlockId,
}: ReaderArticleViewProps) {
  const articleContainerRef = useRef<HTMLDivElement | null>(null);

  function openTokenDetails(token: ArticleToken, block: ArticleBlock, triggerElement: HTMLElement) {
    const rect = triggerElement.getBoundingClientRect();
    onTokenSelect(
      {
        token,
        blockId: block.id,
        blockText: block.text,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      },
      triggerElement
    );
  }

  function openTokenActionMenu(token: ArticleToken, block: ArticleBlock, triggerElement: HTMLElement) {
    const rect = triggerElement.getBoundingClientRect();
    onTokenActionMenu(
      {
        blockId: block.id,
        startOffsetInBlock: token.start_offset,
        endOffsetInBlock: token.end_offset,
        textQuote: block.text.slice(token.start_offset, token.end_offset),
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      },
      triggerElement
    );
  }

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
      onSelectionChange(null, "仅支持在正文 token 范围内划线。", null);
      return;
    }

    const startBlockId = startEl.dataset.blockId;
    const endBlockId = endEl.dataset.blockId;
    if (!startBlockId || !endBlockId || startBlockId !== endBlockId) {
      onSelectionChange(null, "暂不支持跨 block 划线，请在同一段落内选择。", startEl);
      return;
    }

    const tokenElements = Array.from(
      container.querySelectorAll<HTMLElement>(`[data-block-id='${startBlockId}'][data-token-start][data-token-end]`)
    );
    const covered = tokenElements.filter((element) => range.intersectsNode(element));
    if (covered.length === 0) {
      onSelectionChange(null, "未找到可定位 token，请重试。", startEl);
      return;
    }

    const starts = covered.map((element) => Number(element.dataset.tokenStart ?? "0"));
    const ends = covered.map((element) => Number(element.dataset.tokenEnd ?? "0"));
    const startOffsetInBlock = Math.min(...starts);
    const endOffsetInBlock = Math.max(...ends);

    const block = blocks.find((item) => item.id === startBlockId);
    if (!block) {
      onSelectionChange(null, "段落不存在。", startEl);
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
      null,
      startEl
    );
  }

  return (
    <article
      data-testid="reader-article-view"
      lang="ja"
      className="reader-text rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p id="reader-token-shortcuts" className="sr-only">
        聚焦单词后按 Enter 查看词义，按 Shift 加 F10 打开选区操作菜单。
      </p>
      <div ref={articleContainerRef} className="space-y-6" onMouseUp={handleSelectionMenu}>
        {blocks.map((block) => (
          <p
            key={block.id}
            id={`reader-block-${block.id}`}
            data-reader-block="true"
            className={`scroll-mt-28 rounded-xl px-2 py-2 leading-relaxed transition ${focusedBlockId === block.id ? "bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-950/30 dark:ring-brand-700" : ""}`}
          >
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
                      role="button"
                      tabIndex={0}
                      aria-describedby="reader-token-shortcuts"
                      aria-haspopup="dialog"
                      aria-keyshortcuts="Enter Shift+F10"
                      aria-label={`查看 ${token.surface} 的单词详情。按 Enter 查看词义，按 Shift 加 F10 打开操作菜单。`}
                      className={`mx-[1px] cursor-pointer rounded px-0.5 py-0.5 transition select-text hover:bg-brand-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2 dark:hover:bg-brand-950/30 dark:hover:text-white ${jlptClassMap[token.jlpt_level]} ${highlighted ? "bg-yellow-200/70 dark:bg-yellow-700/40" : ""}`}
                      onClick={(event) => openTokenDetails(token, block, event.currentTarget)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        openTokenActionMenu(token, block, event.currentTarget);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openTokenDetails(token, block, event.currentTarget);
                          return;
                        }

                        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
                          event.preventDefault();
                          openTokenActionMenu(token, block, event.currentTarget);
                        }
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
