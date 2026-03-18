"use client";

import type { AIExplanationResponse, HighlightResponse, SuggestedVocabItem } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAiExplanation,
  createHighlight,
  getArticle,
  getReadingProgress,
  listAiExplanations,
  listHighlights,
  lookupWordInReader,
  saveVocabFromReader,
  updateHighlightNote,
  upsertReadingProgress,
} from "../../../lib/api";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { HighlightMenu } from "./components/HighlightMenu";
import { ProgressBar } from "./components/ProgressBar";
import { ReaderArticleView } from "./components/ReaderArticleView";
import { sentenceContextFromBlock } from "./components/reader-utils";
import { TokenPopup } from "./components/TokenPopup";
import type { SelectedTokenState, SelectionMenuState } from "./components/types";

export default function ReaderPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const articleId = params.id;
  const { hydrated, isAuthorized } = useRequireAuth();

  const [selectedToken, setSelectedToken] = useState<SelectedTokenState | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [latestAi, setLatestAi] = useState<AIExplanationResponse | null>(null);
  const [addingSuggestedKey, setAddingSuggestedKey] = useState<string | null>(null);

  const articleQuery = useQuery({
    queryKey: ["article", articleId],
    queryFn: () => getArticle(articleId),
    enabled: hydrated && isAuthorized,
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
  });

  const highlightsQuery = useQuery({
    queryKey: ["highlights", articleId],
    queryFn: () => listHighlights(articleId),
    enabled: hydrated && isAuthorized && articleQuery.data?.status === "ready",
  });

  const progressQuery = useQuery({
    queryKey: ["progress", articleId],
    queryFn: () => getReadingProgress(articleId),
    enabled: hydrated && isAuthorized,
  });

  const aiHistoryQuery = useQuery({
    queryKey: ["ai-history", articleId],
    queryFn: () => listAiExplanations(articleId),
    enabled: hydrated && isAuthorized,
  });

  useEffect(() => {
    if (progressQuery.data?.progress_percent !== undefined) {
      setProgressPercent(progressQuery.data.progress_percent);
    }
  }, [progressQuery.data]);

  const lookupQuery = useQuery({
    queryKey: ["lookup", articleId, selectedToken?.token.surface, selectedToken?.token.lemma, selectedToken?.blockId],
    queryFn: () =>
      lookupWordInReader({
        article_id: articleId,
        surface: selectedToken?.token.surface ?? "",
        lemma: selectedToken?.token.lemma ?? "",
        reading: selectedToken?.token.reading ?? "",
        context: selectedToken?.blockText,
      }),
    enabled: Boolean(selectedToken) && hydrated && isAuthorized,
  });

  const lookupEntries = useMemo(() => lookupQuery.data?.entries ?? [], [lookupQuery.data]);
  const firstEntry = useMemo(() => lookupEntries[0], [lookupEntries]);

  const highlightsByBlock = useMemo(() => {
    const mapping = new Map<string, HighlightResponse[]>();
    for (const item of highlightsQuery.data ?? []) {
      if (!item.block_id) {
        continue;
      }
      const list = mapping.get(item.block_id) ?? [];
      list.push(item);
      mapping.set(item.block_id, list);
    }
    return mapping;
  }, [highlightsQuery.data]);

  const saveTokenVocabMutation = useMutation({
    mutationFn: () => {
      if (!selectedToken) {
        throw new Error("Missing token selection");
      }
      return saveVocabFromReader({
        surface: selectedToken.token.surface,
        lemma: selectedToken.token.lemma,
        reading: selectedToken.token.reading,
        pos: selectedToken.token.pos,
        meaning_snapshot: { meanings: firstEntry?.meanings ?? [] },
        jlpt_level: firstEntry?.jlpt_level ?? selectedToken.token.jlpt_level,
        frequency_band: firstEntry?.frequency_band ?? selectedToken.token.frequency_band,
        source_article_id: articleId,
        source_sentence: selectedToken.blockText,
      });
    },
  });

  const createHighlightMutation = useMutation({
    mutationFn: (note: string | null) => {
      if (!selectionMenu) {
        throw new Error("Missing selection");
      }
      return createHighlight({
        article_id: articleId,
        block_id: selectionMenu.blockId,
        start_offset_in_block: selectionMenu.startOffsetInBlock,
        end_offset_in_block: selectionMenu.endOffsetInBlock,
        text_quote: selectionMenu.textQuote,
        note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", articleId] });
      setSelectionMenu(null);
      window.getSelection()?.removeAllRanges();
    },
  });

  const saveProgressMutation = useMutation({
    mutationFn: () =>
      upsertReadingProgress({
        article_id: articleId,
        progress_percent: progressPercent,
        last_position: `manual:${progressPercent}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", articleId] });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ highlightId, note }: { highlightId: string; note: string }) =>
      updateHighlightNote(highlightId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", articleId] });
    },
  });

  const createAiMutation = useMutation({
    mutationFn: () => {
      if (!selectionMenu || !articleQuery.data) {
        throw new Error("Missing selection");
      }
      const block = articleQuery.data.blocks.find((item) => item.id === selectionMenu.blockId);
      if (!block) {
        throw new Error("Selected block not found");
      }
      const context = sentenceContextFromBlock(
        block.text,
        selectionMenu.startOffsetInBlock,
        selectionMenu.endOffsetInBlock
      );
      return createAiExplanation({
        article_id: articleId,
        sentence: context.sentence,
        previous_sentence: context.previousSentence,
        next_sentence: context.nextSentence,
        user_level: "N3",
      });
    },
    onSuccess: (result) => {
      setLatestAi(result);
      queryClient.invalidateQueries({ queryKey: ["ai-history", articleId] });
      setSelectionMenu(null);
      window.getSelection()?.removeAllRanges();
    },
  });

  const saveSuggestedVocabMutation = useMutation({
    mutationFn: (item: SuggestedVocabItem) =>
      saveVocabFromReader({
        surface: item.surface,
        lemma: item.lemma,
        reading: item.reading,
        pos: item.pos,
        meaning_snapshot: { meanings: [item.meaning] },
        jlpt_level: item.jlpt_level,
        frequency_band: item.frequency_band,
        source_article_id: articleId,
        source_sentence: latestAi?.sentence ?? item.surface,
      }),
    onSettled: () => {
      setAddingSuggestedKey(null);
    },
  });

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">认证状态加载中...</p>;
  }

  if (!isAuthorized) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Reader</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后访问 Reader。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  return (
    <section className="relative space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Reader</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          单一阅读视图：点词、划线、高亮回显、AI解释在同一正文内完成。
        </p>
      </header>

      {articleQuery.data ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm">status: {articleQuery.data.status}</p>
          {articleQuery.data.processing_error ? (
            <p className="text-xs text-red-600">{articleQuery.data.processing_error}</p>
          ) : null}
        </div>
      ) : null}

      <ProgressBar
        progressPercent={progressPercent}
        onProgressChange={setProgressPercent}
        onSave={() => saveProgressMutation.mutate()}
        isSaving={saveProgressMutation.isPending}
      />

      {articleQuery.isLoading ? <p>加载文章中...</p> : null}
      {articleQuery.isError ? <p className="text-red-600">{(articleQuery.error as Error).message}</p> : null}

      {articleQuery.data?.status === "ready" ? (
        <ReaderArticleView
          blocks={articleQuery.data.blocks}
          highlightsByBlock={highlightsByBlock}
          onTokenSelect={setSelectedToken}
          onSelectionChange={(menu, error) => {
            setSelectionMenu(menu);
            setSelectionError(error);
          }}
        />
      ) : null}

      {selectionError ? <p className="text-xs text-red-600">{selectionError}</p> : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="font-semibold">已保存高亮</h3>
        <div data-testid="highlight-list" className="mt-3 space-y-3">
          {highlightsQuery.data?.map((item) => (
            <div data-testid="highlight-item" key={item.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="text-sm">{item.text_quote}</p>
              <p className="mt-1 text-xs text-zinc-500">block: {item.block_id}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="w-full rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
                  defaultValue={item.note ?? ""}
                  placeholder="note"
                  onBlur={(event) => {
                    updateNoteMutation.mutate({ highlightId: item.id, note: event.target.value });
                  }}
                />
              </div>
            </div>
          ))}
          {highlightsQuery.data && highlightsQuery.data.length === 0 ? (
            <p className="text-sm text-zinc-500">还没有高亮。</p>
          ) : null}
        </div>
      </div>

      <ExplanationPanel
        latestAi={latestAi}
        history={aiHistoryQuery.data}
        addingSuggestedKey={addingSuggestedKey}
        onAddSuggestedVocab={(item) => {
          const key = `${item.lemma}:${item.pos}`;
          setAddingSuggestedKey(key);
          saveSuggestedVocabMutation.mutate(item);
        }}
      />

      <TokenPopup
        selectedToken={selectedToken}
        lookupEntries={lookupEntries}
        isLookupLoading={lookupQuery.isLoading}
        isSavingVocab={saveTokenVocabMutation.isPending}
        onClose={() => setSelectedToken(null)}
        onAddToVocab={() => saveTokenVocabMutation.mutate()}
      />

      <HighlightMenu
        selectionMenu={selectionMenu}
        isAiPending={createAiMutation.isPending}
        aiError={createAiMutation.isError ? (createAiMutation.error as Error).message : null}
        onRequestAi={() => createAiMutation.mutate()}
        onFavorite={() => createHighlightMutation.mutate("favorite")}
        onCopy={() => {
          if (selectionMenu) {
            navigator.clipboard.writeText(selectionMenu.textQuote);
          }
        }}
        onAddToVocab={() => {
          if (!selectionMenu) {
            return;
          }
          saveVocabFromReader({
            surface: selectionMenu.textQuote,
            lemma: selectionMenu.textQuote,
            reading: "",
            pos: "phrase",
            meaning_snapshot: { meanings: [] },
            jlpt_level: "Unknown",
            frequency_band: "Unknown",
            source_article_id: articleId,
            source_sentence: selectionMenu.textQuote,
          }).then(() => setSelectionMenu(null));
        }}
      />
    </section>
  );
}
