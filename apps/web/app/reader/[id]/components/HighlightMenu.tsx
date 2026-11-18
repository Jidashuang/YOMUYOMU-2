"use client";

import { useEffect, useState } from "react";

import { computePopupPlacement } from "../../../../lib/popup-placement";
import type { SelectionMenuState } from "./types";

const MENU_WIDTH = 360;

function useViewportSize() {
  const [size, setSize] = useState(() =>
    typeof window === "undefined"
      ? { width: 1024, height: 768 }
      : { width: window.innerWidth, height: window.innerHeight }
  );
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

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
  const viewport = useViewportSize();

  if (!selectionMenu) {
    return null;
  }

  // 限制在屏幕内：左右不越界；下方放不下时翻到选区上方
  const placement = computePopupPlacement({
    x: selectionMenu.x,
    y: selectionMenu.y,
    anchorTop: selectionMenu.anchorTop,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    width: MENU_WIDTH,
    preferredMinHeight: 180,
    allowSheet: false,
  });
  const placementStyle =
    placement.mode === "above"
      ? { left: placement.left, bottom: placement.bottom, maxHeight: placement.maxHeight, width: placement.width }
      : placement.mode === "below"
        ? { left: placement.left, top: placement.top, maxHeight: placement.maxHeight, width: placement.width }
        : {};

  return (
    <div
      data-testid="highlight-menu"
      className="fixed z-30 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={placementStyle}
      // Keep the floating menu anchored to the live text selection: a mousedown on the
      // menu would otherwise collapse the document selection and shift focus, which makes
      // the just-rendered buttons jitter/detach before the click lands (Playwright reports
      // "element is not stable / detached"). preventDefault keeps the gesture from mutating
      // the selection; the click still fires, and the handlers use selectionMenu state so
      // no data flow changes. Position stays fixed/viewport-relative (no transform here).
      onMouseDown={(event) => event.preventDefault()}
    >
      <p className="mb-2 text-xs text-zinc-500">{selectionMenu.textQuote}</p>
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          data-testid="highlight-menu-ai"
          className="rounded border px-2 py-1"
          onClick={onRequestAi}
          disabled={isAiPending}
        >
          {isAiPending ? "解释中..." : "让 AI 用中文解释这句"}
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
