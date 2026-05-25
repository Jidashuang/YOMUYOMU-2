"use client";

import type { SourceType } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createArticle, deleteArticle, listArticles } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";

function statusLabel(status: string) {
  if (status === "ready") return "已就绪";
  if (status === "failed") return "处理失败";
  return "处理中";
}

// Target-user sample: a short slice from a light-novel-flavored passage that
// includes vocabulary and grammar typically tripping up N4-N2 readers.
const SAMPLE_TITLE = "示例 · 你最近读不顺的一段（替换成你自己的）";
const SAMPLE_CONTENT = [
  "彼は来るはずだったのに、結局あの日は姿を見せなかった。",
  "あとから聞いた話では、家のことでどうしても抜けられなかったらしい。",
  "それでも一言くらいは連絡してほしかったな、と私は今でも思っている。",
].join("\n");

export default function LibraryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hydrated, isAuthorized } = useRequireAuth();

  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [sourceType, setSourceType] = useState<SourceType>("text");
  const [rawContent, setRawContent] = useState(SAMPLE_CONTENT);
  const [epubPayload, setEpubPayload] = useState("");
  const [epubFileName, setEpubFileName] = useState("");

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
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后再粘贴你正在读的日文。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  const articles = articlesQuery.data;
  const hasArticles = Boolean(articles && articles.length > 0);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">把你正在读的日文贴进来</h1>
        <p data-testid="library-intro" className="text-sm text-zinc-600 dark:text-zinc-300">
          推荐贴一段你<strong>最近读不顺</strong>的真实内容：轻小说、NHK 新闻、JLPT 阅读、播客文字稿都可以。
          我们不提供文章库，只处理你自己带来的内容。导入后会自动分句、分词，然后跳转到阅读器。
        </p>
        <p className="text-xs text-zinc-500">目前仅支持 <code>text</code> 与 <code>epub</code> 两种来源。URL 抓取与 OCR 暂未开放。</p>
      </header>

      {!hasArticles && !articlesQuery.isLoading ? (
        <div
          data-testid="library-empty-state"
          className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-5 text-sm dark:border-brand-700 dark:bg-brand-900/20"
        >
          <p className="font-medium">还没有导入过内容。</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-300">
            打开你最近正在读、但卡住的那段日文，复制粘贴到下面的「正文」里，点击「导入并开始阅读」即可。
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">导入一段日文</h2>
        <p className="mt-1 text-xs text-zinc-500">
          下面填的是示例段落，请替换成你自己手头的内容。一次只导入一段，便于你立刻读完它。
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <label className="block text-sm">
            来源
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as SourceType)}
            >
              <option value="text">直接粘贴文本</option>
              <option value="epub">上传 EPUB</option>
            </select>
          </label>

          <label className="block text-sm">
            标题（给这段内容起一个你认得出来的名字）
            <input
              data-testid="create-article-title"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：星新一短篇 · 第三段"
              required
            />
          </label>

          {sourceType === "text" ? (
            <label className="block text-sm">
              正文（粘贴你最近读不顺的一段日文）
              <textarea
                data-testid="create-article-content"
                className="mt-1 min-h-[180px] w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                value={rawContent}
                onChange={(event) => setRawContent(event.target.value)}
                placeholder="把你正在读的轻小说 / NHK 新闻 / JLPT 阅读片段贴在这里。"
                required
              />
              <span className="mt-1 block text-xs text-zinc-500">
                建议 1–3 段、几百字以内，方便你今天就把它读完。
              </span>
            </label>
          ) : (
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
              {epubFileName ? <p className="mt-1 text-xs text-zinc-500">已选择：{epubFileName}</p> : null}
            </label>
          )}

          {createMutation.isError ? <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p> : null}

          <button
            type="submit"
            data-testid="create-article-submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={createMutation.isPending || (sourceType === "epub" && !epubPayload)}
          >
            {createMutation.isPending ? "导入中..." : "导入并开始阅读"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">已导入的内容</h2>
        <div className="mt-4 space-y-3">
          {articlesQuery.isLoading ? <p className="text-sm">加载中...</p> : null}
          {articlesQuery.isError ? <p className="text-sm text-red-600">{(articlesQuery.error as Error).message}</p> : null}

          {articles?.map((article) => (
            <div key={article.id} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{article.title}</p>
                  <p className="text-xs text-zinc-500">{new Date(article.created_at).toLocaleString()}</p>
                  <p className="mt-1 text-xs">状态：{statusLabel(article.status)}</p>
                  {article.processing_error ? <p className="text-xs text-red-600">{article.processing_error}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/reader/${article.id}`}
                    className={`rounded-md border px-3 py-1 text-sm ${article.status !== "ready" ? "pointer-events-none opacity-50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                  >
                    继续阅读
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

          {hasArticles ? null : !articlesQuery.isLoading ? (
            <p className="text-sm text-zinc-500">还没有导入内容。先在上面贴一段你正在读的日文。</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
