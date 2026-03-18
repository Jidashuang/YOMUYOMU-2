"use client";

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
  const [rawContent, setRawContent] = useState("彼は来るはずだったのに。\n今日は雨が降っている。\n明日は晴れるだろう。");

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
        source_type: "text",
        raw_content: rawContent,
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
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后再创建和查看文章。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          文章创建后进入异步处理流：<code>processing -&gt; ready/failed</code>。
        </p>
      </header>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">创建文章（Text）</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
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

          <label className="block text-sm">
            正文
            <textarea
              data-testid="create-article-content"
              className="mt-1 min-h-[160px] w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={rawContent}
              onChange={(event) => setRawContent(event.target.value)}
              required
            />
          </label>

          {createMutation.isError ? <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p> : null}

          <button
            type="submit"
            data-testid="create-article-submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "创建中..." : "创建文章"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">我的文章</h2>
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

          {articlesQuery.data?.length === 0 ? <p className="text-sm text-zinc-500">还没有文章，先创建一篇。</p> : null}
        </div>
      </div>
    </section>
  );
}
