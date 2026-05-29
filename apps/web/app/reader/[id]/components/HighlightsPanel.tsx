"use client";

import type { HighlightResponse } from "@yomuyomu/shared-types";

interface HighlightsPanelProps {
  highlights?: HighlightResponse[];
  isLoading?: boolean;
  onUpdateNote: (highlightId: string, note: string) => void;
}

/**
 * Saved-sentence ("收藏句") panel. Moved out of the main reading column into the
 * reader shell side panel, but keeps the original highlight-list / highlight-item
 * test ids and the note-on-blur behaviour intact.
 */
export function HighlightsPanel({ highlights, isLoading, onUpdateNote }: HighlightsPanelProps) {
  const isEmpty = Boolean(highlights) && highlights!.length === 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        划线后选「加入收藏」会把整句存到这里，方便复看。
      </p>

      <div data-testid="highlight-list" className="space-y-3">
        {highlights?.map((item) => (
          <div
            data-testid="highlight-item"
            key={item.id}
            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">{item.text_quote}</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-100"
                defaultValue={item.note ?? ""}
                placeholder="note"
                onBlur={(event) => {
                  onUpdateNote(item.id, event.target.value);
                }}
              />
            </div>
          </div>
        ))}

        {isEmpty && !isLoading ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            还没有收藏的句子。
          </p>
        ) : null}

        {isLoading && !highlights ? <p className="text-sm text-zinc-500">加载收藏中…</p> : null}
      </div>
    </div>
  );
}

export type { HighlightsPanelProps };
