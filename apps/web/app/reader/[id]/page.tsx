"use client";

import type { AIExplanationResponse, HighlightResponse, SuggestedVocabItem } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [liveAnnouncement, setLiveAnnouncement] = useState({ id: 0, message: "" });
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const tokenTriggerRef = useRef<HTMLElement | null>(null);
  const selectionTriggerRef = useRef<HTMLElement | null>(null);

  function announce(message: string) {
    setLiveAnnouncement((current) => ({
      id: current.id + 1,
      message,
    }));
  }

  function restoreFocus(triggerElement: HTMLElement | null) {
    if (!triggerElement) {
      return;
    }

    window.requestAnimationFrame(() => {
      triggerElement.focus();
    });
  }

  function closeTokenPopup() {
    setSelectedToken(null);
    restoreFocus(tokenTriggerRef.current);
  }

  function closeSelectionMenu() {
    setSelectionMenu(null);
    window.getSelection()?.removeAllRanges();
    restoreFocus(selectionTriggerRef.current);
  }

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

  useEffect(() => {
    if (articleQuery.data?.status !== "ready") {
      return;
    }

    const updateProgressFromScroll = () => {
      const articleElement = document.querySelector<HTMLElement>("[data-testid='reader-article-view']");
      if (!articleElement) {
        return;
      }

      const rect = articleElement.getBoundingClientRect();
      const articleTop = window.scrollY + rect.top;
      const maxScrollable = Math.max(articleTop + articleElement.offsetHeight - window.innerHeight, articleTop + 1);
      const total = Math.max(maxScrollable - articleTop, 1);
      const current = Math.min(Math.max(window.scrollY - articleTop, 0), total);
      const nextProgress = Math.round((current / total) * 100);

      setProgressPercent((previous) => (previous === nextProgress ? previous : nextProgress));
    };

    updateProgressFromScroll();
    window.addEventListener("scroll", updateProgressFromScroll, { passive: true });
    window.addEventListener("resize", updateProgressFromScroll);
    return () => {
      window.removeEventListener("scroll", updateProgressFromScroll);
      window.removeEventListener("resize", updateProgressFromScroll);
    };
  }, [articleQuery.data?.status, articleQuery.data?.blocks.length]);

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
    onSuccess: () => {
      announce("已加入生词本");
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
      announce("已保存高亮");
      closeSelectionMenu();
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
      announce("阅读进度已保存");
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ highlightId, note }: { highlightId: string; note: string }) =>
      updateHighlightNote(highlightId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highlights", articleId] });
      announce("高亮笔记已更新");
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
      announce("AI解释已生成");
      closeSelectionMenu();
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
    onSuccess: () => {
      announce("已加入生词本");
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
    <section className="relative space-y-6">
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="reader-live-region"
        data-announcement-id={liveAnnouncement.id}
      >
        <span key={liveAnnouncement.id}>{liveAnnouncement.message}</span>
      </p>
      <header className="space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-brand-600">Reader</p>
            <h1 data-testid="reader-article-title" className="text-3xl font-semibold tracking-tight">
              {articleQuery.data?.title ?? "阅读器"}
            </h1>
            <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              正文优先的阅读视图。点词、划线、高亮和 AI 解析都围绕当前文章展开，不再把阅读过程拆散成多个独立面板。
            </p>
          </div>
          {articleQuery.data ? (
            <div className="reader-status-card rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">状态</p>
              <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{articleQuery.data.status}</p>
              {articleQuery.data.processing_error ? (
                <p className="mt-2 text-xs text-red-600">{articleQuery.data.processing_error}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {articleQuery.isLoading ? <p>加载文章中...</p> : null}
      {articleQuery.isError ? <p className="text-red-600">{(articleQuery.error as Error).message}</p> : null}

      <div data-testid="reader-shell" className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,360px)]">
        <div className="space-y-4">
          <div className="reader-hero rounded-3xl px-5 py-5 text-zinc-950 shadow-sm dark:text-white">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 font-medium backdrop-blur dark:border-white/10 dark:bg-white/10">
                {articleQuery.data?.source_type ?? "text"}
              </span>
              <span className="text-zinc-700 dark:text-zinc-200">
                {articleQuery.data?.blocks.length ?? 0} 个段落
              </span>
              <span className="text-zinc-700 dark:text-zinc-200">
                进度 {progressPercent.toFixed(0)}%
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-sm text-zinc-700 dark:text-zinc-200">
              点击单词查看释义，划线后请求 AI 解释或收藏片段。右侧面板始终保留当前阅读进度、解释摘要和高亮回顾。
            </p>
          </div>

          {selectionError ? <p role="alert" className="text-xs text-red-600">{selectionError}</p> : null}

          {articleQuery.data?.status === "ready" ? (
            <ReaderArticleView
              blocks={articleQuery.data.blocks}
              highlightsByBlock={highlightsByBlock}
              onTokenSelect={(value, triggerElement) => {
                tokenTriggerRef.current = triggerElement;
                setSelectedToken(value);
                setSelectionMenu(null);
                setSelectionError(null);
              }}
              onTokenActionMenu={(menu, triggerElement) => {
                selectionTriggerRef.current = triggerElement;
                setSelectionMenu(menu);
                setSelectedToken(null);
                setSelectionError(null);
              }}
              onSelectionChange={(menu, error, triggerElement) => {
                if (triggerElement) {
                  selectionTriggerRef.current = triggerElement;
                }
                setSelectionMenu(menu);
                setSelectionError(error);
                setSelectedToken(null);
                if (error) {
                  announce(error);
                }
              }}
              focusedBlockId={focusedBlockId}
            />
          ) : null}
        </div>

        <aside data-testid="reader-sidebar" className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <ProgressBar
            progressPercent={progressPercent}
            onProgressChange={setProgressPercent}
            onSave={() => saveProgressMutation.mutate()}
            isSaving={saveProgressMutation.isPending}
          />

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

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">已保存高亮</h3>
                <p className="mt-1 text-xs text-zinc-500">最近保存的句段会在这里回显，方便继续阅读时快速回看。</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {highlightsQuery.data?.length ?? 0}
              </span>
            </div>
            <div data-testid="highlight-list" className="mt-4 space-y-3">
              {highlightsQuery.data?.map((item) => (
                <div
                  data-testid="highlight-item"
                  key={item.id}
                  className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.text_quote}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.note === "favorite" ? "已加入收藏" : "可补充你的阅读备注"}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                      defaultValue={item.note ?? ""}
                      placeholder="写下阅读备注"
                      onBlur={(event) => {
                        updateNoteMutation.mutate({ highlightId: item.id, note: event.target.value });
                      }}
                    />
                    {item.block_id ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        onClick={() => {
                          const blockId = item.block_id ?? null;
                          if (!blockId) {
                            announce("未找到正文位置");
                            return;
                          }
                          const blockElement = document.getElementById(`reader-block-${blockId}`);
                          if (!blockElement) {
                            announce("未找到正文位置");
                            return;
                          }
                          setFocusedBlockId(blockId);
                          blockElement.scrollIntoView({ behavior: "smooth", block: "center" });
                          announce("已返回正文位置");
                          window.setTimeout(() => {
                            setFocusedBlockId((current) => (current === blockId ? null : current));
                          }, 1800);
                        }}
                      >
                        返回正文位置
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {highlightsQuery.data && highlightsQuery.data.length === 0 ? (
                <p className="text-sm text-zinc-500">还没有高亮。</p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <TokenPopup
        selectedToken={selectedToken}
        lookupEntries={lookupEntries}
        isLookupLoading={lookupQuery.isLoading}
        isSavingVocab={saveTokenVocabMutation.isPending}
        onClose={closeTokenPopup}
        onAddToVocab={() => saveTokenVocabMutation.mutate()}
      />

      <HighlightMenu
        selectionMenu={selectionMenu}
        isAiPending={createAiMutation.isPending}
        aiError={createAiMutation.isError ? (createAiMutation.error as Error).message : null}
        onRequestAi={() => createAiMutation.mutate()}
        onFavorite={() => createHighlightMutation.mutate("favorite")}
        onCopy={async () => {
          if (selectionMenu) {
            try {
              await navigator.clipboard.writeText(selectionMenu.textQuote);
              announce("已复制选中文本");
              closeSelectionMenu();
            } catch {
              announce("复制失败");
            }
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
          })
            .then(() => {
              announce("已加入生词本");
              closeSelectionMenu();
            })
            .catch(() => {
              announce("加入生词本失败");
            });
        }}
        onClose={closeSelectionMenu}
      />
    </section>
  );
}
