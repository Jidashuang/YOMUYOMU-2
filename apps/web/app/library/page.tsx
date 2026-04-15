"use client";

import type { SourceType } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createArticle, deleteArticle, listArticles } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";

function statusLabel(status: string) {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  return "processing";
}

export default function LibraryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hydrated, isAuthorized } = useRequireAuth();

  const [title, setTitle] = useState("Sample Japanese Text");
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [rawContent, setRawContent] = useState("彼は来るはずだったのに。\n今日は雨が降っている。\n明日は晴れるだろう。");
  const [epubPayload, setEpubPayload] = useState("");
  const [epubFileName, setEpubFileName] = useState("");
  const sourceOptions: Array<{ value: SourceType; label: string; description: string }> = [
    { value: "text", label: "文本", description: "粘贴文章、短文或练习材料，马上进入处理流程。" },
    { value: "epub", label: "EPUB", description: "上传电子书文件，系统会自动提取正文后继续处理。" },
  ];

  const articlesQuery = useQuery({
    queryKey: ["articles"],
    queryFn: listArticles,
    enabled: hydrated && isAuthorized,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!rows) {
        return false;
      }
      return rows.some((item) => item.status === "processing") ? 2000 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createArticle({
        title,
        source_type: sourceType,
        raw_content: sourceType === "epub" ? epubPayload : rawContent,
      }),
    onSuccess: (article) => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      router.push(`/reader/${article.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (articleId: string) => deleteArticle(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
  });

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">认证状态加载中...</p>;
  }

  if (!isAuthorized) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">导入与书库</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后再导入和查看文章。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">导入与书库</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          先导入文本或 EPUB，再在下方继续管理已经处理过的内容。
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-2">
          <h2 className="font-medium">导入内容</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            新内容会进入异步处理流：<code>processing -&gt; ready/failed</code>。
          </p>
        </div>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">导入方式</p>
            <div className="flex flex-wrap gap-3">
              {sourceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    sourceType === option.value
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                  onClick={() => setSourceType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{sourceOptions.find((option) => option.value === sourceType)?.description}</p>
          </div>

          <label className="block text-sm">
            标题
            <input
              data-testid="create-article-title"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          {sourceType === "text" ? (
            <label className="block text-sm">
              文本内容
              <textarea
                data-testid="create-article-content"
                className="mt-1 min-h-[160px] w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                value={rawContent}
                onChange={(event) => setRawContent(event.target.value)}
                required
              />
            </label>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm">
                EPUB 文件
                <input
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  type="file"
                  accept=".epub,application/epub+zip"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      setEpubPayload("");
                      setEpubFileName("");
                      return;
                    }
                    setEpubFileName(file.name);
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === "string") {
                        setEpubPayload(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  required
                />
              </label>
              {epubFileName ? <p className="text-xs text-zinc-500">已选择：{epubFileName}</p> : null}
            </div>
          )}

          {createMutation.isError ? <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p> : null}

          <button
            type="submit"
            data-testid="create-article-submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={createMutation.isPending || (sourceType === "epub" && !epubPayload)}
          >
            {createMutation.isPending ? "导入中..." : "开始导入"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">已导入内容</h2>
        <div className="mt-4 space-y-3">
          {articlesQuery.isLoading ? <p className="text-sm">加载中...</p> : null}
          {articlesQuery.isError ? <p className="text-sm text-red-600">{(articlesQuery.error as Error).message}</p> : null}

          {articlesQuery.data?.map((article) => (
            <div key={article.id} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{article.title}</p>
                  <p className="text-xs text-zinc-500">{new Date(article.created_at).toLocaleString()}</p>
                  <p className="mt-1 text-xs">status: {statusLabel(article.status)}</p>
                  {article.processing_error ? <p className="text-xs text-red-600">{article.processing_error}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/reader/${article.id}`}
                    className={`rounded-md border px-3 py-1 text-sm ${article.status !== "ready" ? "pointer-events-none opacity-50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                  >
                    打开
                  </Link>
                  <button
                    className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                    onClick={() => deleteMutation.mutate(article.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}

          {articlesQuery.data?.length === 0 ? <p className="text-sm text-zinc-500">还没有内容，先从上面导入一篇。</p> : null}
        </div>
      </div>
    </section>
  );
}
