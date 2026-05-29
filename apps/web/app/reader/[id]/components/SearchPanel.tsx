"use client";

import type { ArticleBlock } from "@yomuyomu/shared-types";
import { type ReactNode, useMemo, useState } from "react";

interface SearchPanelProps {
  blocks: ArticleBlock[];
  onJump: (blockId: string) => void;
}

interface SearchHit {
  blockId: string;
  count: number;
  snippet: string;
}

/**
 * In-document search for the current article only (first version — no backend full-text
 * search, no cross-article search). It only reads block text and reports matches; jumping
 * is delegated to the reader via onJump, so it never touches the token spans and therefore
 * does not interfere with token clicks or text selection.
 *
 * Interaction idea inspired by Flow (AGPL-3.0); no source copied. See
 * docs/third-party-flow-reader-shell.md.
 */
export function SearchPanel({ blocks, onJump }: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim();

  const hits = useMemo<SearchHit[]>(() => {
    if (!trimmed) {
      return [];
    }
    const needle = trimmed.toLowerCase();
    const out: SearchHit[] = [];
    for (const block of blocks) {
      const text = block.text ?? "";
      const hay = text.toLowerCase();
      let from = 0;
      let count = 0;
      let firstIdx = -1;
      for (;;) {
        const idx = hay.indexOf(needle, from);
        if (idx === -1) {
          break;
        }
        if (firstIdx === -1) {
          firstIdx = idx;
        }
        count += 1;
        from = idx + needle.length;
      }
      if (count > 0) {
        const start = Math.max(0, firstIdx - 24);
        const end = Math.min(text.length, firstIdx + trimmed.length + 40);
        const snippet =
          (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
        out.push({ blockId: block.id, count, snippet });
      }
    }
    return out;
  }, [blocks, trimmed]);

  const totalMatches = hits.reduce((sum, hit) => sum + hit.count, 0);

  return (
    <div className="flex h-full flex-col gap-3">
      <input
        data-testid="reader-search-input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="在本篇文章内查找…"
        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-100"
      />

      {!trimmed ? (
        <p className="text-sm text-zinc-500">输入关键词，在当前文章内查找并跳转到对应段落。</p>
      ) : hits.length === 0 ? (
        <p data-testid="reader-search-empty" className="text-sm text-zinc-500">
          未找到「{trimmed}」。
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {totalMatches} 处匹配 · {hits.length} 个段落
          </p>
          <div data-testid="reader-search-results" className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {hits.map((hit) => (
              <button
                key={hit.blockId}
                type="button"
                data-testid="reader-search-result"
                onClick={() => onJump(hit.blockId)}
                className="block w-full rounded-lg border border-zinc-200 p-2 text-left text-sm leading-relaxed text-zinc-700 hover:border-brand-500 hover:bg-brand-50/60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="line-clamp-3">{highlightSnippet(hit.snippet, trimmed)}</span>
                {hit.count > 1 ? (
                  <span className="mt-1 block text-[11px] text-zinc-400">{hit.count} 处匹配</span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function highlightSnippet(snippet: string, query: string): ReactNode[] {
  const parts: ReactNode[] = [];
  if (!query) {
    parts.push(snippet);
    return parts;
  }
  const hay = snippet.toLowerCase();
  const needle = query.toLowerCase();
  let cursor = 0;
  let key = 0;
  for (;;) {
    const idx = hay.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push(snippet.slice(cursor));
      break;
    }
    if (idx > cursor) {
      parts.push(snippet.slice(cursor, idx));
    }
    parts.push(
      <mark key={key++} className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-600/60 dark:text-zinc-50">
        {snippet.slice(idx, idx + query.length)}
      </mark>
    );
    cursor = idx + query.length;
  }
  return parts;
}

export type { SearchPanelProps };
