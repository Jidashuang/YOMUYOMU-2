"use client";

import type { LookupEntry } from "@yomuyomu/shared-types";

import type { SelectedTokenState } from "./types";

interface TokenPopupProps {
  selectedToken: SelectedTokenState | null;
  lookupEntries: LookupEntry[];
  isLookupLoading: boolean;
  isSavingVocab: boolean;
  alreadySaved?: boolean;
  justSaved?: boolean;
  saveError?: string | null;
  onClose: () => void;
  onAddToVocab: () => void;
}

function isDictionaryMiss(entry: LookupEntry | undefined): boolean {
  if (!entry) {
    return true;
  }
  return entry.primary_meaning === "No dictionary match" || entry.meanings.includes("No dictionary match");
}

export function TokenPopup({
  selectedToken,
  lookupEntries,
  isLookupLoading,
  isSavingVocab,
  alreadySaved = false,
  justSaved = false,
  saveError = null,
  onClose,
  onAddToVocab,
}: TokenPopupProps) {
  if (!selectedToken) {
    return null;
  }

  const firstEntry = lookupEntries[0];
  const hasDictionaryMatch = !isDictionaryMiss(firstEntry);
  const reading = firstEntry?.reading || selectedToken.token.reading || selectedToken.token.surface;
  const moreMeanings = firstEntry?.meanings?.slice(1) ?? [];
  const partsOfSpeech = hasDictionaryMatch ? firstEntry?.pos?.join("、") || selectedToken.token.pos : selectedToken.token.pos;
  const jlpt = hasDictionaryMatch ? firstEntry?.jlpt_level ?? selectedToken.token.jlpt_level : selectedToken.token.jlpt_level;
  const frequency = hasDictionaryMatch
    ? firstEntry?.frequency_band ?? selectedToken.token.frequency_band
    : selectedToken.token.frequency_band;
  const meaningText = isLookupLoading
    ? "查询中..."
    : hasDictionaryMatch
      ? firstEntry?.primary_meaning
      : "词典暂未收录，先看原文标注信息";
  const exampleSentence = firstEntry?.example_sentence || selectedToken.blockText;
  const usageNote =
    hasDictionaryMatch && firstEntry?.usage_note && firstEntry.usage_note !== "No usage note available."
      ? firstEntry.usage_note
      : `在当前句中作为「${partsOfSpeech}」出现，可结合例句和上下文理解。`;

  return (
    <div
      data-testid="token-popup"
      className="fixed z-20 w-[340px] max-w-[calc(100vw-16px)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: selectedToken.x, top: selectedToken.y }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-lg font-semibold leading-tight">{selectedToken.token.surface}</p>
          <p className="text-xs text-zinc-500">
            {reading}
            {selectedToken.token.lemma && selectedToken.token.lemma !== selectedToken.token.surface
              ? ` · 词典形 ${selectedToken.token.lemma}`
              : ""}
          </p>
        </div>
        <button className="text-xs text-zinc-500" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </div>

      <div className="mt-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/40">
        <p className="text-xs font-medium text-zinc-500">中文意思</p>
        <p data-testid="token-popup-meaning" className="mt-1 text-base font-medium">
          {meaningText}
        </p>
        {hasDictionaryMatch && moreMeanings.length > 0 ? (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            其他释义：{moreMeanings.slice(0, 3).join("；")}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-500">
        <div>
          <p>词性</p>
          <p className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-200">{partsOfSpeech}</p>
        </div>
        <div>
          <p>JLPT</p>
          <p className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-200">{jlpt}</p>
        </div>
        <div>
          <p>频度</p>
          <p className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-200">{frequency}</p>
        </div>
      </div>

      {exampleSentence ? (
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
          <span className="font-medium">例：</span>
          {exampleSentence}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-zinc-500">
        <span className="font-medium">用法：</span>
        {usageNote}
      </p>

      <button
        type="button"
        data-testid="token-popup-add-vocab"
        className="mt-4 w-full rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        onClick={onAddToVocab}
        disabled={isSavingVocab || alreadySaved}
      >
        {justSaved ? "已加入" : alreadySaved ? "已收录" : isSavingVocab ? "加入中..." : "加入生词本"}
      </button>
      <p
        data-testid="token-popup-vocab-feedback"
        className={`mt-1 text-center text-[11px] ${saveError ? "text-red-500" : "text-zinc-400"}`}
      >
        {saveError
          ? saveError
          : justSaved
            ? "已加入生词本，会出现在 Vocab 的「到期复习」里"
            : alreadySaved
              ? "这个词已经在你的生词本里了"
              : "加入后会出现在 Vocab 的「到期复习」里"}
      </p>

      {hasDictionaryMatch && lookupEntries.length > 1 ? (
        <details className="mt-3 text-xs text-zinc-500">
          <summary className="cursor-pointer">更多义项（{lookupEntries.length - 1}）</summary>
          <div className="mt-2 space-y-1">
            {lookupEntries.slice(1, 6).map((entry, index) => (
              <div key={index} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
                <p className="text-zinc-700 dark:text-zinc-200">
                  {entry.primary_meaning}
                  <span className="text-zinc-500"> · {entry.reading} · {entry.pos.join("、")}</span>
                </p>
                {entry.usage_note ? <p>{entry.usage_note}</p> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export type { TokenPopupProps };
