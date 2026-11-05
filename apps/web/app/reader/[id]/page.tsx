"use client";

import type {
  AIExplanationResponse,
  ArticleDetail,
  HighlightResponse,
  LookupEntry,
  SuggestedVocabItem,
} from "@yomuyomu/shared-types";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { TouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAiExplanation,
  createHighlight,
  getArticle,
  getReadingProgress,
  listAiExplanations,
  listHighlights,
  listVocab,
  lookupWordInReader,
  retryAnnotation,
  saveVocabFromReader,
  updateHighlightNote,
  upsertReadingProgress,
} from "../../../lib/api";
import { katakanaToHiragana, pageHasAnnotatableToken, type AnnotationLevel } from "../../../lib/reader-annotation";
import { computeReaderPaging } from "../../../lib/reader-paging";
import { formatReadingPosition, pageFromProgressPercent, parseReadingPosition } from "../../../lib/reading-position";
import { useUISettingsStore } from "../../../lib/ui-settings-store";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { HighlightMenu } from "./components/HighlightMenu";
import { HighlightsPanel } from "./components/HighlightsPanel";
import { ProgressBar } from "./components/ProgressBar";
import { ReaderArticleView } from "./components/ReaderArticleView";
import {
  BookmarkIcon,
  LibraryIcon,
  ReaderShell,
  SearchIcon,
  ThemeIcon,
  TypographyIcon,
  VocabIcon,
  type ReaderActivityItem,
  type ReaderPanelDef,
  type ReaderPanelKey,
} from "./components/ReaderShell";
import { SearchPanel } from "./components/SearchPanel";
import { ThemePanel } from "./components/ThemePanel";
import { TypographyPanel } from "./components/TypographyPanel";
import { sentenceContextFromBlock } from "./components/reader-utils";
import { TokenPopup } from "./components/TokenPopup";
import type { SelectedTokenState, SelectionMenuState } from "./components/types";

type ReaderPagingMode = "scroll" | "swipe";

const ANNOTATION_LEVELS: Array<{ value: AnnotationLevel; label: string; description: string }> = [
  { value: "N3", label: "N3+", description: "N3/N2/N1" },
  { value: "N2", label: "N2+", description: "N2/N1" },
  { value: "N1", label: "N1", description: "仅 N1" },
];
const READER_BLOCKS_PER_PAGE = 18;

function processingProgressText(article: ArticleDetail) {
  if (article.total_block_count !== null) {
    return `${article.processed_block_count}/${article.total_block_count}`;
  }
  return `${article.processed_block_count}`;
}

function hasDictionaryMatch(entry: LookupEntry | undefined): boolean {
  if (!entry) {
    return false;
  }
  return entry.primary_meaning !== "No dictionary match" && !entry.meanings.includes("No dictionary match");
}

function vocabKeyForToken(token: { lemma: string; surface: string; pos: string }): string {
  return `${token.lemma || token.surface}:${token.pos}`;
}

export default function ReaderPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const articleId = params.id;
  const { hydrated, isAuthorized } = useRequireAuth();

  const [selectedToken, setSelectedToken] = useState<SelectedTokenState | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [latestAi, setLatestAi] = useState<AIExplanationResponse | null>(null);
  const [addingSuggestedKey, setAddingSuggestedKey] = useState<string | null>(null);
  const [recentlySavedTokenKey, setRecentlySavedTokenKey] = useState<string | null>(null);
  const [progressSaveMessage, setProgressSaveMessage] = useState<string | null>(null);
  const annotationLevel = useUISettingsStore((state) => state.annotationLevel);
  const setAnnotationLevel = useUISettingsStore((state) => state.setAnnotationLevel);
  const furiganaVisible = useUISettingsStore((state) => state.furiganaVisible);
  const setFuriganaVisible = useUISettingsStore((state) => state.setFuriganaVisible);
  const [activePanel, setActivePanel] = useState<ReaderPanelKey | null>(null);
  const [pagingMode, setPagingMode] = useState<ReaderPagingMode>("scroll");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const didRestorePositionRef = useRef(false);
  const pageBlockOffset = currentPageIndex * READER_BLOCKS_PER_PAGE;

  const articleQuery = useQuery({
    queryKey: ["article", articleId, currentPageIndex],
    queryFn: () => getArticle(articleId, { blockOffset: pageBlockOffset, blockLimit: READER_BLOCKS_PER_PAGE }),
    enabled: hydrated && isAuthorized,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        return false;
      }
      const annotating = data.annotation_status === "pending" || data.annotation_status === "processing";
      return data.status === "processing" || annotating ? 2000 : false;
    },
  });

  const highlightsQuery = useQuery({
    queryKey: ["highlights", articleId],
    queryFn: () => listHighlights(articleId),
    enabled: hydrated && isAuthorized && Boolean(articleQuery.data),
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

  // The user's saved vocab, used to show "已收录" so a word isn't added twice.
  const savedVocabQuery = useQuery({
    queryKey: ["vocab", "saved"],
    queryFn: () => listVocab(),
    enabled: hydrated && isAuthorized,
  });
  const savedVocabKeys = useMemo(
    () => new Set((savedVocabQuery.data ?? []).map((item) => `${item.lemma}:${item.pos}`)),
    [savedVocabQuery.data]
  );

  const lookupQuery = useQuery({
    queryKey: ["lookup", articleId, selectedToken?.token.surface, selectedToken?.token.lemma, selectedToken?.blockId],
    queryFn: () =>
      lookupWordInReader({
        article_id: articleId,
        surface: selectedToken?.token.surface ?? "",
        lemma: selectedToken?.token.lemma || selectedToken?.token.surface || "",
        reading: selectedToken?.token.reading ? katakanaToHiragana(selectedToken.token.reading) : "",
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
        lemma: selectedToken.token.lemma || selectedToken.token.surface,
        reading: selectedToken.token.reading,
        pos: selectedToken.token.pos,
        meaning_snapshot: {
          meanings: hasDictionaryMatch(firstEntry)
            ? [...(firstEntry?.meaning_zh ? [firstEntry.meaning_zh] : []), ...(firstEntry?.meanings ?? [])]
            : [],
        },
        jlpt_level: hasDictionaryMatch(firstEntry) ? firstEntry?.jlpt_level ?? selectedToken.token.jlpt_level : selectedToken.token.jlpt_level,
        frequency_band: hasDictionaryMatch(firstEntry)
          ? firstEntry?.frequency_band ?? selectedToken.token.frequency_band
          : selectedToken.token.frequency_band,
        source_article_id: articleId,
        source_sentence: selectedToken.blockText,
      });
    },
    onSuccess: () => {
      if (selectedToken) {
        setRecentlySavedTokenKey(vocabKeyForToken(selectedToken.token));
      }
      queryClient.invalidateQueries({ queryKey: ["vocab"] });
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
      setActivePanel("highlights");
    },
  });

  const retryAnnotationMutation = useMutation({
    mutationFn: () => retryAnnotation(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["article", articleId] });
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
        user_level: annotationLevel,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab"] });
    },
    onSettled: () => {
      setAddingSuggestedKey(null);
    },
  });

  const highlightCount = highlightsQuery.data?.length ?? 0;
  const articleBlocks = articleQuery.data?.blocks ?? [];
  const loadedBlockCount = pageBlockOffset + articleBlocks.length;
  const { visibleBlockCount, totalReaderPages, currentReaderPage } = computeReaderPaging({
    totalBlockCount: articleQuery.data?.total_block_count ?? null,
    processedBlockCount: articleQuery.data?.processed_block_count ?? 0,
    loadedBlockCount,
    currentPageIndex,
    blocksPerPage: READER_BLOCKS_PER_PAGE,
  });
  const progressPercent =
    articleQuery.data && totalReaderPages > 0 ? Math.min(100, ((currentReaderPage + 1) / totalReaderPages) * 100) : 0;
  const progressPercentForPage = (pageIndex: number) =>
    articleQuery.data && totalReaderPages > 0 ? Math.min(100, ((pageIndex + 1) / totalReaderPages) * 100) : 0;
  const currentPageBlocks = articleBlocks;
  const pageBlockStart = currentPageBlocks.length === 0 ? 0 : pageBlockOffset + 1;
  const pageBlockEnd = currentPageBlocks.length === 0 ? 0 : pageBlockOffset + currentPageBlocks.length;
  const hasReadableCurrentPage = articleBlocks.length > 0;
  const annotationStatus = articleQuery.data?.annotation_status;
  const annotationError = articleQuery.data?.annotation_error;
  const annotationProgressText = articleQuery.data ? processingProgressText(articleQuery.data) : "";
  const annotationSettled = annotationStatus === "ready" || annotationStatus === "partial";
  const showAnnotationInProgress =
    (annotationStatus === "pending" || annotationStatus === "processing") && hasReadableCurrentPage;
  const showAnnotationDegraded =
    (annotationStatus === "partial" || annotationStatus === "failed") && hasReadableCurrentPage;
  const showLevelEmptyHint =
    hasReadableCurrentPage && annotationSettled && !pageHasAnnotatableToken(articleBlocks, annotationLevel);
  const showPageLoading = articleQuery.isFetching && !articleQuery.isLoading && !hasReadableCurrentPage;
  const selectedTokenKey = selectedToken ? vocabKeyForToken(selectedToken.token) : null;

  const saveReadingProgress = (pageIndex: number) =>
    upsertReadingProgress({
      article_id: articleId,
      progress_percent: progressPercentForPage(pageIndex),
      last_position: formatReadingPosition(pageIndex),
    });

  const saveProgressMutation = useMutation({
    mutationFn: () => saveReadingProgress(currentReaderPage),
    onSuccess: (result) => {
      queryClient.setQueryData(["progress", articleId], result);
      setProgressSaveMessage("已保存");
    },
    onError: () => {
      setProgressSaveMessage("保存失败，请重试");
    },
  });

  const goToReaderPage = (pageIndex: number) => {
    const targetPage = Math.min(Math.max(pageIndex, 0), totalReaderPages - 1);
    setSelectedToken(null);
    setSelectionMenu(null);
    setSelectionError(null);
    window.getSelection()?.removeAllRanges();
    setCurrentPageIndex(targetPage);
    saveReadingProgress(targetPage)
      .then((result) => queryClient.setQueryData(["progress", articleId], result))
      .catch(() => undefined);
  };

  const goToPreviousPage = () => goToReaderPage(currentReaderPage - 1);
  const goToNextPage = () => goToReaderPage(currentReaderPage + 1);

  useEffect(() => {
    if (currentPageIndex >= totalReaderPages) {
      setCurrentPageIndex(totalReaderPages - 1);
    }
  }, [currentPageIndex, totalReaderPages]);

  // Restore the last-read page once, after the article (page count) and saved progress load.
  useEffect(() => {
    if (didRestorePositionRef.current || !articleQuery.data || progressQuery.isLoading) {
      return;
    }
    const savedPage =
      parseReadingPosition(progressQuery.data?.last_position ?? null) ??
      pageFromProgressPercent(progressQuery.data?.progress_percent, totalReaderPages);
    if (savedPage !== null && savedPage > 0) {
      const target = Math.min(savedPage, Math.max(0, totalReaderPages - 1));
      if (target !== currentPageIndex) {
        setCurrentPageIndex(target);
      }
    }
    didRestorePositionRef.current = true;
  }, [articleQuery.data, progressQuery.data, progressQuery.isLoading, totalReaderPages, currentPageIndex]);

  useEffect(() => {
    if (!progressSaveMessage) {
      return;
    }
    const handle = window.setTimeout(() => {
      setProgressSaveMessage(null);
    }, 2200);
    return () => window.clearTimeout(handle);
  }, [progressSaveMessage]);

  // Prefetch the next page so paging forward (and its annotations) feels instant.
  useEffect(() => {
    if (!articleQuery.data || currentReaderPage >= totalReaderPages - 1) {
      return;
    }
    const nextIndex = currentReaderPage + 1;
    queryClient.prefetchQuery({
      queryKey: ["article", articleId, nextIndex],
      queryFn: () =>
        getArticle(articleId, {
          blockOffset: nextIndex * READER_BLOCKS_PER_PAGE,
          blockLimit: READER_BLOCKS_PER_PAGE,
        }),
    });
  }, [articleId, articleQuery.data, currentReaderPage, totalReaderPages, queryClient]);

  useEffect(() => {
    if (pagingMode !== "swipe") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousPage();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentReaderPage, pagingMode, totalReaderPages]);

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

  const handleSearchJump = (blockId: string) => {
    if (typeof document === "undefined") {
      return;
    }
    const target = document.getElementById(`reader-block-${blockId}`);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Transient flash applied imperatively so the article (and its token spans / live
    // text selection) is not re-rendered by React.
    target.classList.add("reader-block-flash");
    window.setTimeout(() => target.classList.remove("reader-block-flash"), 1200);
    // On mobile the panel is a full overlay; close it so the jump is visible.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setActivePanel(null);
    }
  };

  const handleReaderTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (pagingMode !== "swipe") {
      return;
    }
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleReaderTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (pagingMode !== "swipe" || touchStartXRef.current === null) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 60) {
      return;
    }
    if (deltaX < 0) {
      goToNextPage();
      return;
    }
    goToPreviousPage();
  };

  const handleTokenSelect = (value: SelectedTokenState) => {
    saveTokenVocabMutation.reset();
    setSelectedToken(value);
  };

  const activityItems: ReaderActivityItem[] = [
    {
      key: "library",
      label: "书架",
      icon: <LibraryIcon />,
      kind: "link",
      href: "/library",
      testId: "reader-activity-library",
    },
    {
      key: "search",
      label: "搜索",
      icon: <SearchIcon />,
      kind: "panel",
      panelKey: "search",
      testId: "reader-activity-search",
    },
    {
      key: "highlights",
      label: "收藏句",
      icon: <BookmarkIcon />,
      kind: "panel",
      panelKey: "highlights",
      badge: highlightCount,
      testId: "reader-activity-highlights",
    },
    {
      key: "typography",
      label: "排版",
      icon: <TypographyIcon />,
      kind: "panel",
      panelKey: "typography",
      testId: "reader-activity-typography",
    },
    {
      key: "theme",
      label: "主题",
      icon: <ThemeIcon />,
      kind: "panel",
      panelKey: "theme",
      testId: "reader-activity-theme",
    },
    {
      key: "vocab",
      label: "生词",
      icon: <VocabIcon />,
      kind: "link",
      href: "/vocab",
      testId: "reader-activity-vocab",
    },
  ];

  const panelDefs: ReaderPanelDef[] = [
    {
      key: "search",
      title: "搜索",
      content: <SearchPanel blocks={currentPageBlocks} onJump={handleSearchJump} />,
    },
    {
      key: "highlights",
      title: "收藏句",
      content: (
        <HighlightsPanel
          highlights={highlightsQuery.data}
          isLoading={highlightsQuery.isLoading}
          onUpdateNote={(highlightId, note) => updateNoteMutation.mutate({ highlightId, note })}
        />
      ),
    },
    {
      key: "typography",
      title: "排版",
      content: <TypographyPanel />,
    },
    {
      key: "theme",
      title: "主题",
      content: <ThemePanel />,
    },
  ];

  return (
    <section className="relative left-1/2 w-screen -ml-[50vw] px-4 sm:px-6 lg:px-8">
      <ReaderShell
        items={activityItems}
        panels={panelDefs}
        activePanel={activePanel}
        onSelectPanel={setActivePanel}
      >
        <div className="mx-auto w-full max-w-[96rem] space-y-5">
      <header className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">原文精读</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            读完它，卡住时点词或选句让 AI 中文拆解，再把对你有用的词加进生词本。
          </p>
        </div>
        <div data-testid="annotation-controls" className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-500">难词标注</p>
          <div className="inline-flex rounded-md border border-stone-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
            {ANNOTATION_LEVELS.map((item) => (
              <button
                key={item.value}
                type="button"
                data-testid={`annotation-level-${item.value.toLowerCase()}`}
                className={`rounded px-3 py-1.5 text-sm ${
                  annotationLevel === item.value
                    ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "text-zinc-600 hover:bg-stone-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
                onClick={() => setAnnotationLevel(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            当前显示：{ANNOTATION_LEVELS.find((item) => item.value === annotationLevel)?.description}
          </p>
          <div className="flex gap-2 text-[11px] text-zinc-500" aria-label="JLPT color legend">
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-950 dark:bg-sky-950/40 dark:text-sky-200">N3</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">N2</span>
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200">N1</span>
          </div>
          <button
            type="button"
            data-testid="furigana-toggle"
            aria-pressed={furiganaVisible}
            onClick={() => setFuriganaVisible(!furiganaVisible)}
            className={`mt-1 inline-flex w-fit items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${
              furiganaVisible
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/30 dark:text-brand-100"
                : "border-stone-300 text-zinc-600 hover:bg-stone-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            振假名：{furiganaVisible ? "开" : "关"}
          </button>
        </div>
      </header>

      {articleQuery.data?.status === "processing" || showAnnotationInProgress ? (
        <div
          data-testid="reader-processing-banner"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <p className="font-medium">
            {articleQuery.data?.status === "processing"
              ? "正在解析正文…"
              : `难词标注处理中：${annotationProgressText}`}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            {hasReadableCurrentPage ? "正文已可阅读，难词颜色会随着标注结果补上。" : "正在解析正文，请稍等，页面会自动刷新。"}
          </p>
        </div>
      ) : null}

      {showAnnotationDegraded ? (
        <div
          data-testid="reader-annotation-degraded"
          className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">
              {annotationStatus === "failed" ? "正文可阅读，难词标注失败" : "正文可阅读，部分难词标注失败"}
            </p>
            {annotationError ? <p className="mt-1 text-xs">{annotationError}</p> : null}
          </div>
          <button
            type="button"
            data-testid="reader-retry-annotation"
            disabled={retryAnnotationMutation.isPending}
            className="shrink-0 rounded-md border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/40"
            onClick={() => retryAnnotationMutation.mutate()}
          >
            {retryAnnotationMutation.isPending ? "重试中…" : "重试标注"}
          </button>
        </div>
      ) : null}

      {articleQuery.data?.status === "failed" && !hasReadableCurrentPage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          <p className="font-medium">这篇文章处理失败</p>
          {articleQuery.data.processing_error ? (
            <p className="mt-1 text-xs">{articleQuery.data.processing_error}</p>
          ) : null}
        </div>
      ) : null}

      <ProgressBar
        progressPercent={progressPercent}
        isSaving={saveProgressMutation.isPending}
        saveMessage={progressSaveMessage}
        onSave={() => saveProgressMutation.mutate()}
      />

      {articleQuery.isLoading ? <p>加载文章中...</p> : null}
      {showPageLoading ? <p className="text-sm text-zinc-500">加载本页中...</p> : null}
      {articleQuery.isError ? <p className="text-red-600">{(articleQuery.error as Error).message}</p> : null}

      {articleBlocks.length > 0 ? (
        <div className="space-y-3">
          <div
            data-testid="reader-pagination-controls"
            className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                第 {currentReaderPage + 1} / {totalReaderPages} 页
              </p>
              <p className="text-xs text-zinc-500">
                段落 {pageBlockStart}-{pageBlockEnd} / {visibleBlockCount}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-stone-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
                <button
                  type="button"
                  data-testid="reader-mode-scroll"
                  className={`rounded px-3 py-1.5 text-xs ${
                    pagingMode === "scroll"
                      ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "text-zinc-600 hover:bg-stone-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setPagingMode("scroll")}
                >
                  向下滚动
                </button>
                <button
                  type="button"
                  data-testid="reader-mode-swipe"
                  className={`rounded px-3 py-1.5 text-xs ${
                    pagingMode === "swipe"
                      ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "text-zinc-600 hover:bg-stone-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setPagingMode("swipe")}
                >
                  左右翻页
                </button>
              </div>
              <button
                type="button"
                data-testid="reader-prev-page"
                disabled={currentReaderPage === 0}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
                onClick={goToPreviousPage}
              >
                上一页
              </button>
              <button
                type="button"
                data-testid="reader-next-page"
                disabled={currentReaderPage >= totalReaderPages - 1}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
                onClick={goToNextPage}
              >
                下一页
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] xl:items-start">
            <div className="min-w-0 space-y-3 xl:order-none">
              {showLevelEmptyHint ? (
                <p
                  data-testid="reader-level-empty-hint"
                  className="rounded-md bg-stone-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  当前页暂无 {annotationLevel} 词，可翻页或切换难度等级。
                </p>
              ) : null}

              <div
                data-testid="reader-page-frame"
                className={
                  pagingMode === "scroll"
                    ? "max-h-[calc(100vh-14rem)] overflow-y-auto overscroll-contain rounded-2xl"
                    : "rounded-2xl touch-pan-y"
                }
                onTouchStart={handleReaderTouchStart}
                onTouchEnd={handleReaderTouchEnd}
              >
                <ReaderArticleView
                  blocks={currentPageBlocks}
                  annotationLevel={annotationLevel}
                  furiganaVisible={furiganaVisible}
                  highlightsByBlock={highlightsByBlock}
                  onTokenSelect={handleTokenSelect}
                  onSelectionChange={(menu, error) => {
                    setSelectionMenu(menu);
                    setSelectionError(error);
                  }}
                />
              </div>
            </div>

            <aside
              data-testid="reader-ai-companion"
              className="order-first min-w-0 xl:order-none xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto"
            >
              <ExplanationPanel
                latestAi={latestAi}
                history={aiHistoryQuery.data}
                isGenerating={createAiMutation.isPending}
                addingSuggestedKey={addingSuggestedKey}
                savedKeys={savedVocabKeys}
                onAddSuggestedVocab={(item) => {
                  const key = `${item.lemma}:${item.pos}`;
                  setAddingSuggestedKey(key);
                  saveSuggestedVocabMutation.mutate(item);
                }}
              />
            </aside>
          </div>
        </div>
      ) : null}

      {articleQuery.data && articleBlocks.length === 0 && !articleQuery.isLoading && !articleQuery.isFetching ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {articleQuery.data.status === "failed" ? "没有可显示的正文。" : "正文还在生成中，稍后会自动显示。"}
        </div>
      ) : null}

      {selectionError ? <p className="text-xs text-red-600">{selectionError}</p> : null}

        </div>
      </ReaderShell>

      <TokenPopup
        selectedToken={selectedToken}
        lookupEntries={lookupEntries}
        isLookupLoading={lookupQuery.isLoading}
        isSavingVocab={saveTokenVocabMutation.isPending}
        alreadySaved={
          selectedTokenKey ? savedVocabKeys.has(selectedTokenKey) || recentlySavedTokenKey === selectedTokenKey : false
        }
        justSaved={selectedTokenKey ? recentlySavedTokenKey === selectedTokenKey : false}
        saveError={saveTokenVocabMutation.isError ? "加入失败，请重试" : null}
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
          }).then(() => {
            setSelectionMenu(null);
            queryClient.invalidateQueries({ queryKey: ["vocab"] });
          });
        }}
      />
    </section>
  );
}
