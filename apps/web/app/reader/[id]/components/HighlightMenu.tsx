"use client";

import { useEffect, useId, useRef, useState } from "react";

import { clampFloatingPosition } from "./reader-utils";
import type { SelectionMenuState } from "./types";

interface HighlightMenuProps {
  selectionMenu: SelectionMenuState | null;
  isAiPending: boolean;
  aiError?: string | null;
  onRequestAi: () => void;
  onFavorite: () => void;
  onCopy: () => void;
  onAddToVocab: () => void;
  onClose: () => void;
}

export function HighlightMenu({
  selectionMenu,
  isAiPending,
  aiError,
  onRequestAi,
  onFavorite,
  onCopy,
  onAddToVocab,
  onClose,
}: HighlightMenuProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (selectionMenu) {
      closeButtonRef.current?.focus();
    }
  }, [selectionMenu]);

  useEffect(() => {
    if (!selectionMenu || !menuRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = menuRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setPosition(clampFloatingPosition(selectionMenu.x, selectionMenu.y, rect.width, rect.height));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [selectionMenu]);

  useEffect(() => {
    if (!selectionMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose, selectionMenu]);

  if (!selectionMenu) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="highlight-menu"
      tabIndex={-1}
      className="fixed z-30 w-[360px] max-w-[calc(100vw-16px)] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: position?.left ?? selectionMenu.x, top: position?.top ?? selectionMenu.y }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={titleId} className="font-semibold">选区操作</h3>
          <p id={descriptionId} className="mt-1 text-xs text-zinc-500">{selectionMenu.textQuote}</p>
        </div>
        <button ref={closeButtonRef} type="button" className="text-sm text-zinc-500" aria-label="关闭选区操作" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          data-testid="highlight-menu-ai"
          className="rounded border px-2 py-1"
          onClick={onRequestAi}
          disabled={isAiPending}
        >
          {isAiPending ? "解释中..." : "AI解释"}
        </button>
        <button type="button" data-testid="highlight-menu-favorite" className="rounded border px-2 py-1" onClick={onFavorite}>加入收藏</button>
        <button type="button" data-testid="highlight-menu-copy" className="rounded border px-2 py-1" onClick={onCopy}>复制</button>
        <button type="button" data-testid="highlight-menu-add-vocab" className="rounded border px-2 py-1" onClick={onAddToVocab}>加入生词本</button>
      </div>
      {aiError ? <p role="alert" className="mt-2 text-xs text-red-600">{aiError}</p> : null}
    </div>
  );
}

export type { HighlightMenuProps };
