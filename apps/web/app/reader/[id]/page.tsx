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

type AnnotationLevel = "N3" | "N2" | "N1";

const ANNOTATION_LEVELS: Array<{ value: AnnotationLevel; label: string; description: string }> = [
  { value: "N3", label: "N3+", description: "N3/N2/N1" },
  { value: "N2", label: "N2+", description: "N2/N1" },
  { value: "N1", label: "N1", description: "仅 N1" },
];

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
  const [annotationLevel, setAnnotationLevel] = useState<AnnotationLevel>("N2");
  const [activePanel, setActivePanel] = useState<ReaderPanelKey | null>(null);

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
      setActivePanel("highlights");
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

  const highlightCount = highlightsQuery.data?.length ?? 0;
  const articleBlocks = articleQuery.data?.blocks ?? [];

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
      content: <SearchPanel blocks={articleBlocks} onJump={handleSearchJump} />,
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
    <section className="relative">
      <ReaderShell
        items={activityItems}
        panels={panelDefs}
        activePanel={activePanel}
        onSelectPanel={setActivePanel}
      >
        <div className="mx-auto w-full max-w-3xl space-y-5">
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
        </div>
      </header>

      {articleQuery.data && articleQuery.data.status !== "ready" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="font-medium">
            {articleQuery.data.status === "processing" ? "正在处理这篇文章…" : "这篇文章尚未就绪"}
          </p>
          {articleQuery.data.processing_error ? (
            <p className="mt-1 text-xs text-red-600">{articleQuery.data.processing_error}</p>
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
          annotationLevel={annotationLevel}
          highlightsByBlock={highlightsByBlock}
          onTokenSelect={setSelectedToken}
          onSelectionChange={(menu, error) => {
            setSelectionMenu(menu);
            setSelectionError(error);
          }}
        />
      ) : null}

      {selectionError ? <p className="text-xs text-red-600">{selectionError}</p> : null}

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
        </div>
      </ReaderShell>

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
