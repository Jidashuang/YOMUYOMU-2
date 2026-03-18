"use client";

import type { LookupEntry } from "@yomuyomu/shared-types";

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
  if (!selectedToken) {
    return null;
  }

  const firstEntry = lookupEntries[0];

  return (
    <div
      data-testid="token-popup"
      className="fixed z-20 w-[320px] max-w-[calc(100vw-16px)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: selectedToken.x, top: selectedToken.y }}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">单词详情</h3>
        <button className="text-sm text-zinc-500" onClick={onClose}>
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
