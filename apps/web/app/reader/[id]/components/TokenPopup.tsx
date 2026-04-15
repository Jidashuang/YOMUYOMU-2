"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LookupEntry } from "@yomuyomu/shared-types";

import { clampFloatingPosition } from "./reader-utils";
import type { SelectedTokenState } from "./types";

interface TokenPopupProps {
  selectedToken: SelectedTokenState | null;
  lookupEntries: LookupEntry[];
  isLookupLoading: boolean;
  isSavingVocab: boolean;
  onClose: () => void;
  onAddToVocab: () => void;
}

export function TokenPopup({
  selectedToken,
  lookupEntries,
  isLookupLoading,
  isSavingVocab,
  onClose,
  onAddToVocab,
}: TokenPopupProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (selectedToken) {
      closeButtonRef.current?.focus();
    }
  }, [selectedToken]);

  useEffect(() => {
    if (!selectedToken || !popupRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = popupRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      setPosition(clampFloatingPosition(selectedToken.x, selectedToken.y, rect.width, rect.height));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [selectedToken]);

  useEffect(() => {
    if (!selectedToken) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
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
  }, [onClose, selectedToken]);

  if (!selectedToken) {
    return null;
  }

  const firstEntry = lookupEntries[0];

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-testid="token-popup"
      tabIndex={-1}
      className="fixed z-20 w-[320px] max-w-[calc(100vw-16px)] rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: position?.left ?? selectedToken.x, top: position?.top ?? selectedToken.y }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="flex items-start justify-between">
        <h3 id={titleId} className="font-semibold">单词详情</h3>
        <button ref={closeButtonRef} type="button" className="text-sm text-zinc-500" aria-label="关闭单词详情" onClick={onClose}>
          关闭
        </button>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-zinc-500">surface</dt><dd>{selectedToken.token.surface}</dd></div>
        <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-zinc-500">lemma</dt><dd>{selectedToken.token.lemma}</dd></div>
        <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-zinc-500">reading</dt><dd>{selectedToken.token.reading}</dd></div>
        <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-zinc-500">pos</dt><dd>{isLookupLoading ? selectedToken.token.pos : firstEntry?.pos?.join(", ") || selectedToken.token.pos}</dd></div>
        <div className="grid grid-cols-[96px_1fr] gap-2">
          <dt className="text-zinc-500">primary_meaning</dt>
          <dd className="font-medium">{isLookupLoading ? "查询中..." : firstEntry?.primary_meaning ?? "No meaning found"}</dd>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-2">
          <dt className="text-zinc-500">usage</dt>
          <dd>{isLookupLoading ? "-" : firstEntry?.usage_note || "No usage note"}</dd>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-2">
          <dt className="text-zinc-500">example</dt>
          <dd>{isLookupLoading ? "-" : firstEntry?.example_sentence || "No example sentence"}</dd>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-2">
          <dt className="text-zinc-500">more_meanings</dt>
          <dd>{isLookupLoading ? "-" : (firstEntry?.meanings?.slice(1).join("; ") || "None")}</dd>
        </div>
        <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-zinc-500">jlpt_level</dt><dd>{firstEntry?.jlpt_level ?? selectedToken.token.jlpt_level}</dd></div>
        <div className="grid grid-cols-[96px_1fr] gap-2"><dt className="text-zinc-500">frequency_band</dt><dd>{firstEntry?.frequency_band ?? selectedToken.token.frequency_band}</dd></div>
      </dl>

      <div className="mt-3 rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">更多义项（按匹配度排序）</p>
        <div className="mt-1 space-y-1 text-xs">
          {lookupEntries.slice(1, 6).map((entry, index) => (
            <div key={index}>
              <p>{entry.primary_meaning} · {entry.reading} · {entry.pos.join(", ")}</p>
              <p className="text-zinc-500">{entry.usage_note}</p>
            </div>
          ))}
          {lookupEntries.length <= 1 ? <p>无</p> : null}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          data-testid="token-popup-add-vocab"
          className="rounded-md bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-700"
          onClick={onAddToVocab}
          disabled={isSavingVocab}
        >
          {isSavingVocab ? "saving..." : "add_to_vocab"}
        </button>
      </div>
    </div>
  );
}

export type { TokenPopupProps };
