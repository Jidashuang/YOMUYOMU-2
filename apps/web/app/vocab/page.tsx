"use client";

import type { VocabItemResponse, VocabStatus } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import {
  deleteVocab,
  exportVocabCsv,
  exportVocabJson,
  getTodayLearningStats,
  listVocab,
  reviewVocab,
  updateVocabStatus,
} from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const STATUS_LABEL_ZH: Record<VocabStatus, string> = {
  new: "新加入",
  learning: "学习中",
  known: "已掌握",
};

function statusBadgeClass(status: VocabStatus): string {
  if (status === "known") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (status === "learning") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
}

function formatNextReview(value: string | null | undefined): string {
  if (!value) {
    return "暂未安排";
  }
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin <= 0) {
    return "现在到期";
  }
  if (diffMin < 60) {
    return `约 ${diffMin} 分钟后`;
  }
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) {
    return `约 ${diffHours} 小时后`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `约 ${diffDays} 天后`;
}

function VocabCard({
  item,
  onDelete,
  onUpdateStatus,
  onReview,
  emphasizeReview,
}: {
  item: VocabItemResponse;
  onDelete?: (id: string) => void;
  onUpdateStatus: (id: string, status: VocabStatus) => void;
  onReview?: (id: string, result: "fail" | "pass") => void;
  emphasizeReview?: boolean;
}) {
  const meanings = (item.meaning_snapshot?.meanings ?? []).join("；");

  return (
    <div
      data-testid="vocab-card"
      className={`rounded-xl border bg-white p-3.5 transition dark:bg-zinc-900 ${
        emphasizeReview
          ? "border-stone-200 shadow-sm dark:border-zinc-700"
          : "border-stone-200 hover:border-stone-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight">
            {item.surface}
            {item.reading && item.reading !== item.surface ? (
              <span className="ml-2 text-xs font-normal text-zinc-500">{item.reading}</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {meanings || "未填中文释义"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {item.jlpt_level} · {item.frequency_band}
            {item.source_sentence ? <span className="ml-2 italic">来自：{item.source_sentence}</span> : null}
          </p>
        </div>
        <span
          data-testid="vocab-card-status"
          className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}
        >
          {STATUS_LABEL_ZH[item.status]}
        </span>
      </div>

      {emphasizeReview ? (
        <p className="mt-2 text-xs text-zinc-500">下次复习：{formatNextReview(item.next_review_at)}</p>
      ) : null}

      {onReview ? (
        <div className="mt-3 flex gap-2 text-sm">
          <button
            data-testid="vocab-review-fail"
            className="flex-1 rounded-md border border-red-300 px-3 py-2 font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => onReview(item.id, "fail")}
          >
            没记住
          </button>
          <button
            data-testid="vocab-review-pass"
            className="flex-1 rounded-md bg-emerald-500 px-3 py-2 font-medium text-white hover:bg-emerald-600"
            onClick={() => onReview(item.id, "pass")}
          >
            想起来了
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.status !== "learning" ? (
          <button
            className="rounded border px-2 py-1"
            onClick={() => onUpdateStatus(item.id, "learning")}
          >
            标为学习中
          </button>
        ) : null}
        {item.status !== "known" ? (
          <button
            className="rounded border px-2 py-1"
            onClick={() => onUpdateStatus(item.id, "known")}
          >
            标为已掌握
          </button>
        ) : null}
        {item.status !== "new" ? (
          <button
            className="rounded border px-2 py-1 text-zinc-500"
            onClick={() => onUpdateStatus(item.id, "new")}
          >
            重置为新词
          </button>
        ) : null}
        {onDelete ? (
          <button
            className="ml-auto rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => onDelete(item.id)}
          >
            删除
          </button>
        ) : null}
      </div>
    </div>
  );
}

type LibraryTab = "today" | "learning" | "all";

function VocabListBody({
  items,
  isLoading,
  isError,
  errorMessage,
  emptyText,
  renderCard,
}: {
  items?: VocabItemResponse[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyText: string;
  renderCard: (item: VocabItemResponse) => ReactNode;
}) {
  return (
    <div className="mt-3 space-y-2">
      {isLoading ? <p className="text-sm text-zinc-500">加载中...</p> : null}
      {isError ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {items?.map((item) => renderCard(item))}
      {items && items.length === 0 ? <p className="text-sm text-zinc-500">{emptyText}</p> : null}
    </div>
  );
}

export default function VocabPage() {
  const queryClient = useQueryClient();
  const { hydrated, isAuthorized } = useRequireAuth();
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("all");

  const allVocabQuery = useQuery({
    queryKey: ["vocab", "all"],
    queryFn: () => listVocab(),
    enabled: hydrated && isAuthorized,
  });

  const todayStatsQuery = useQuery({
    queryKey: ["analytics", "today"],
    queryFn: getTodayLearningStats,
    enabled: hydrated && isAuthorized,
  });

  const todayNewQuery = useQuery({
    queryKey: ["vocab", "today_new"],
    queryFn: () => listVocab("today_new"),
    enabled: hydrated && isAuthorized,
  });

  const unmasteredQuery = useQuery({
    queryKey: ["vocab", "unmastered"],
    queryFn: () => listVocab("unmastered"),
    enabled: hydrated && isAuthorized,
  });

  const reviewDueQuery = useQuery({
    queryKey: ["vocab", "review_due"],
    queryFn: () => listVocab("review_due"),
    enabled: hydrated && isAuthorized,
  });

  const refreshVocabQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["vocab"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVocab(id),
    onSuccess: refreshVocabQueries,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VocabStatus }) => updateVocabStatus(id, status),
    onSuccess: refreshVocabQueries,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, result }: { id: string; result: "fail" | "pass" }) => reviewVocab(id, result),
    onSuccess: refreshVocabQueries,
  });

  const exportCsvMutation = useMutation({
    mutationFn: exportVocabCsv,
    onSuccess: (blob) => downloadBlob(blob, "vocab-export.csv"),
  });

  const exportJsonMutation = useMutation({
    mutationFn: exportVocabJson,
    onSuccess: (blob) => downloadBlob(blob, "vocab-export.json"),
  });

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">认证状态加载中...</p>;
  }

  if (!isAuthorized) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">生词本</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后查看生词本。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  const dueItems = reviewDueQuery.data ?? [];
  const dueCount = dueItems.length;

  const onUpdateStatus = (id: string, status: VocabStatus) => statusMutation.mutate({ id, status });

  const libraryTabs: Array<{ key: LibraryTab; label: string; count?: number }> = [
    { key: "today", label: "今日新增", count: todayNewQuery.data?.length },
    { key: "learning", label: "学习中", count: unmasteredQuery.data?.length },
    { key: "all", label: "全部", count: allVocabQuery.data?.length },
  ];

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">复习工作台</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          把阅读时遇到的词留下来 → 第二天回来花几分钟复习 → 再读到就认识了。
        </p>
      </header>

      {/* 到期复习 — 第一视觉优先级 */}
      <div
        data-testid="vocab-due-section"
        className="rounded-2xl border-2 border-brand-400 bg-white p-5 shadow-md dark:border-brand-600 dark:bg-zinc-900 sm:p-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">到期复习</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {dueCount > 0
                ? `今天有 ${dueCount} 个词等你回来。每个 5–10 秒，能记住就标「想起来了」。`
                : "今天没有到期的词。继续读你手头那段日文，把新词留下来。"}
            </p>
          </div>
          <span
            data-testid="vocab-due-count"
            className="shrink-0 rounded-full bg-brand-500 px-3.5 py-1 text-base font-semibold text-white"
          >
            {dueCount}
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {dueItems.map((item) => (
            <VocabCard
              key={item.id}
              item={item}
              emphasizeReview
              onUpdateStatus={onUpdateStatus}
              onReview={(id, result) => reviewMutation.mutate({ id, result })}
            />
          ))}
        </div>
        {reviewDueQuery.isLoading ? <p className="mt-3 text-sm text-zinc-500">加载中...</p> : null}
        {reviewDueQuery.data && reviewDueQuery.data.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">回头有词到期时会出现在这里。</p>
        ) : null}
      </div>

      {/* 今日统计 — 紧凑、次要 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "今日查词", value: todayStatsQuery.data?.lookup_count },
          { label: "今日加入生词", value: todayStatsQuery.data?.vocab_added_count },
          { label: "今日 AI 解释", value: todayStatsQuery.data?.ai_explanation_count },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="truncate text-[11px] text-zinc-500">{stat.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{stat.value ?? "-"}</p>
          </div>
        ))}
      </div>
      {todayStatsQuery.isError ? (
        <p className="text-xs text-red-600">{(todayStatsQuery.error as Error).message}</p>
      ) : null}

      {/* 我的生词库 — 今日新增 / 学习中 / 全部 收进 tab，避免列表堆叠 */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">My library</p>
            <h2 className="mt-0.5 text-lg font-semibold">我的生词库</h2>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => exportCsvMutation.mutate()}
              disabled={exportCsvMutation.isPending}
            >
              导出 CSV
            </button>
            <button
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => exportJsonMutation.mutate()}
              disabled={exportJsonMutation.isPending}
            >
              导出 JSON
            </button>
          </div>
        </div>

        <div className="mt-4 inline-flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1 dark:border-zinc-700 dark:bg-zinc-950">
          {libraryTabs.map((tab) => {
            const active = libraryTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={active}
                onClick={() => setLibraryTab(tab.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
                {typeof tab.count === "number" ? (
                  <span className="ml-1.5 text-xs text-zinc-400">{tab.count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {libraryTab === "today" ? (
          <VocabListBody
            items={todayNewQuery.data}
            isLoading={todayNewQuery.isLoading}
            emptyText="今天还没有新增。"
            renderCard={(item) => <VocabCard key={item.id} item={item} onUpdateStatus={onUpdateStatus} />}
          />
        ) : null}

        {libraryTab === "learning" ? (
          <VocabListBody
            items={unmasteredQuery.data}
            isLoading={unmasteredQuery.isLoading}
            emptyText="暂无。还没标为「已掌握」的词会出现在这里。"
            renderCard={(item) => <VocabCard key={item.id} item={item} onUpdateStatus={onUpdateStatus} />}
          />
        ) : null}

        {libraryTab === "all" ? (
          <VocabListBody
            items={allVocabQuery.data}
            isLoading={allVocabQuery.isLoading}
            isError={allVocabQuery.isError}
            errorMessage={allVocabQuery.isError ? (allVocabQuery.error as Error).message : undefined}
            emptyText="生词本为空。先去阅读器里点几个词，加进来。"
            renderCard={(item) => (
              <VocabCard
                key={item.id}
                item={item}
                onDelete={(id) => deleteMutation.mutate(id)}
                onUpdateStatus={onUpdateStatus}
              />
            )}
          />
        ) : null}
      </div>
    </section>
  );
}
