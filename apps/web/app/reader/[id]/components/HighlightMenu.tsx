"use client";

import type { SelectionMenuState } from "./types";

interface HighlightMenuProps {
  selectionMenu: SelectionMenuState | null;
  isAiPending: boolean;
  aiError?: string | null;
  onRequestAi: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onAddToVocab: () => void;
}

export function HighlightMenu({
  selectionMenu,
  isAiPending,
  aiError,
  onRequestAi,
  onFavorite,
  onCopy,
  onAddToVocab,
}: HighlightMenuProps) {
  if (!selectionMenu) {
    return null;
  }

  return (
    <div
      data-testid="highlight-menu"
      className="fixed z-30 w-[360px] max-w-[calc(100vw-16px)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: selectionMenu.x, top: selectionMenu.y }}
    >
      <p className="mb-2 text-xs text-zinc-500">{selectionMenu.textQuote}</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          data-testid="highlight-menu-ai"
          className="rounded border px-2 py-1"
          onClick={onRequestAi}
          disabled={isAiPending}
        >
          {isAiPending ? "解释中..." : "AI解释"}
        </button>
        <button data-testid="highlight-menu-favorite" className="rounded border px-2 py-1" onClick={onFavorite}>加入收藏</button>
        <button data-testid="highlight-menu-copy" className="rounded border px-2 py-1" onClick={onCopy}>复制</button>
        <button data-testid="highlight-menu-add-vocab" className="rounded border px-2 py-1" onClick={onAddToVocab}>加入生词本</button>
      </div>
      {aiError ? <p className="mt-2 text-xs text-red-600">{aiError}</p> : null}
    </div>
  );
}

export type { HighlightMenuProps };
