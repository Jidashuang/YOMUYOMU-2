"use client";

import type { VocabItemResponse, VocabStatus } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

function statusBadgeClass(status: VocabStatus): string {
  if (status === "known") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (status === "learning") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
}

function VocabCard({
  item,
  onDelete,
  onUpdateStatus,
  onReview,
}: {
  item: VocabItemResponse;
  onDelete?: (id: string) => void;
  onUpdateStatus: (id: string, status: VocabStatus) => void;
  onReview?: (id: string, result: "fail" | "pass") => void;
}) {
  const nextReviewLabel = item.next_review_at ? new Date(item.next_review_at).toLocaleString() : "N/A";
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{item.surface}</p>
          <p className="text-xs text-zinc-500">
            lemma: {item.lemma} · reading: {item.reading || "-"} · pos: {item.pos}
          </p>
          <p className="text-xs text-zinc-500">
            {item.jlpt_level} · {item.frequency_band}
          </p>
          <p className="text-xs text-zinc-500">review_count: {item.review_count} · next_review: {nextReviewLabel}</p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {(item.meaning_snapshot?.meanings ?? []).join("; ") || "No meaning snapshot"}
          </p>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
          {item.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {onReview ? (
          <>
            <button className="rounded border border-red-300 px-2 py-1 text-red-600" onClick={() => onReview(item.id, "fail")}>
              复习失败
            </button>
            <button className="rounded border border-emerald-300 px-2 py-1 text-emerald-600" onClick={() => onReview(item.id, "pass")}>
              复习通过
            </button>
          </>
        ) : null}
        <button className="rounded border px-2 py-1" onClick={() => onUpdateStatus(item.id, "new")}>标记 new</button>
        <button className="rounded border px-2 py-1" onClick={() => onUpdateStatus(item.id, "learning")}>标记 learning</button>
        <button className="rounded border px-2 py-1" onClick={() => onUpdateStatus(item.id, "known")}>标记 known</button>
        {onDelete ? (
          <button className="rounded border border-red-300 px-2 py-1 text-red-600" onClick={() => onDelete(item.id)}>
            删除
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function VocabPage() {
  const queryClient = useQueryClient();
  const { hydrated, isAuthorized } = useRequireAuth();

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
        <h1 className="text-2xl font-semibold">Vocab</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后查看生词本。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vocab</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">学习闭环：状态追踪 + 复习列表 + 导出。</p>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => exportCsvMutation.mutate()}
            disabled={exportCsvMutation.isPending}
          >
            导出 CSV
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => exportJsonMutation.mutate()}
            disabled={exportJsonMutation.isPending}
          >
            导出 JSON
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">今日 lookup 数</p>
          <p className="mt-1 text-2xl font-semibold">{todayStatsQuery.data?.lookup_count ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">今日 vocab 添加数</p>
          <p className="mt-1 text-2xl font-semibold">{todayStatsQuery.data?.vocab_added_count ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">今日 AI 使用数</p>
          <p className="mt-1 text-2xl font-semibold">{todayStatsQuery.data?.ai_explanation_count ?? "-"}</p>
        </div>
      </div>
      {todayStatsQuery.isError ? (
        <p className="text-xs text-red-600">{(todayStatsQuery.error as Error).message}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">到期复习</h2>
          <p className="mt-1 text-xs text-zinc-500">状态为 new/learning，且到期需要复习。</p>
          <div className="mt-3 space-y-2">
            {reviewDueQuery.data?.map((item) => (
              <VocabCard
                key={item.id}
                item={item}
                onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
                onReview={(id, result) => reviewMutation.mutate({ id, result })}
              />
            ))}
            {reviewDueQuery.data && reviewDueQuery.data.length === 0 ? <p className="text-sm text-zinc-500">暂无。</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">今日新增</h2>
          <p className="mt-1 text-xs text-zinc-500">仅显示状态为 new 且今日创建。</p>
          <div className="mt-3 space-y-2">
            {todayNewQuery.data?.map((item) => (
              <VocabCard
                key={item.id}
                item={item}
                onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
              />
            ))}
            {todayNewQuery.data && todayNewQuery.data.length === 0 ? <p className="text-sm text-zinc-500">暂无。</p> : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">未掌握</h2>
          <p className="mt-1 text-xs text-zinc-500">状态为 new / learning。</p>
          <div className="mt-3 space-y-2">
            {unmasteredQuery.data?.map((item) => (
              <VocabCard
                key={item.id}
                item={item}
                onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
              />
            ))}
            {unmasteredQuery.data && unmasteredQuery.data.length === 0 ? <p className="text-sm text-zinc-500">暂无。</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">全部生词</h2>
        {allVocabQuery.isLoading ? <p className="mt-2 text-sm">加载中...</p> : null}
        {allVocabQuery.isError ? <p className="mt-2 text-sm text-red-600">{(allVocabQuery.error as Error).message}</p> : null}
        <div className="mt-3 space-y-2">
          {allVocabQuery.data?.map((item) => (
            <VocabCard
              key={item.id}
              item={item}
              onDelete={(id) => deleteMutation.mutate(id)}
              onUpdateStatus={(id, status) => statusMutation.mutate({ id, status })}
            />
          ))}
          {allVocabQuery.data && allVocabQuery.data.length === 0 ? <p className="text-sm text-zinc-500">生词本为空。</p> : null}
        </div>
      </div>
    </section>
  );
}
