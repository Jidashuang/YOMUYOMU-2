"use client";

import type { ArticleCreateRequest, ArticleSummary, SourceType } from "@yomuyomu/shared-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createArticle, deleteArticle, listArticles } from "../../lib/api";
import { PUBLIC_BOOKS } from "../../lib/public-books";
import { useRequireAuth } from "../../lib/use-require-auth";

const MAX_EPUB_FILE_BYTES = 20 * 1024 * 1024;

function statusLabel(article: ArticleSummary) {
  if (article.status === "ready") return "已就绪";
  if (article.status === "failed") return "处理失败";
  if (article.total_block_count !== null) {
    return `处理中 ${article.processed_block_count}/${article.total_block_count}`;
  }
  return "处理中";
}

function statusTone(status: string) {
  if (status === "ready") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-200";
  return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
}

// Target-user sample: a short slice from a light-novel-flavored passage that
// includes vocabulary and grammar typically tripping up N2-N1 readers.
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
  const [epubReadError, setEpubReadError] = useState("");
  const [isReadingEpub, setIsReadingEpub] = useState(false);

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
    mutationFn: (input: ArticleCreateRequest) => createArticle(input),
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

  function readEpubFile(file: File | undefined) {
    setSourceType("epub");
    setEpubPayload("");
    setEpubReadError("");
    setIsReadingEpub(false);
    if (!file) {
      setEpubFileName("");
      return;
    }
    setEpubFileName(file.name);
    if (file.size > MAX_EPUB_FILE_BYTES) {
      setEpubReadError("EPUB 文件超过 20MB 限制，请选择更小的文件。");
      return;
    }
    setIsReadingEpub(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEpubPayload(reader.result);
      } else {
        setEpubReadError("EPUB 文件读取失败，请重新选择。");
      }
      setIsReadingEpub(false);
    };
    reader.onerror = () => {
      setEpubPayload("");
      setEpubReadError("EPUB 文件读取失败，请重新选择。");
      setIsReadingEpub(false);
    };
    reader.readAsDataURL(file);
  }

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">认证状态加载中...</p>;
  }

  if (!isAuthorized) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">书架</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后打开默认书架，或粘贴你正在读的日文。</p>
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
        <h1 className="text-2xl font-semibold">书架与片段精读</h1>
        <p data-testid="library-intro" className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
          先从公共领域名著里选一段，或贴一段你<strong>最近读不顺</strong>的真实内容：
          轻小说、NHK 新闻、JLPT 阅读、播客文字稿都可以。导入后会自动分句、分词，然后跳转到阅读器。
        </p>
        <p className="text-xs text-zinc-500">
          目前仅支持 <code className="rounded bg-stone-200 px-1 dark:bg-zinc-800">text</code> 与{" "}
          <code className="rounded bg-stone-200 px-1 dark:bg-zinc-800">epub</code> 两种来源。URL 抓取与 OCR 暂未开放。
        </p>
      </header>

      {/* 我的书架优先 */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">My shelf</p>
            <h2 className="mt-0.5 text-lg font-semibold">我的书架</h2>
          </div>
          {hasArticles ? <span className="text-xs text-zinc-500">{articles?.length} 篇已导入</span> : null}
        </div>

        <div data-testid="article-list" className="mt-4 space-y-3">
          {articlesQuery.isLoading ? <p className="text-sm">加载中...</p> : null}
          {articlesQuery.isError ? <p className="text-sm text-red-600">{(articlesQuery.error as Error).message}</p> : null}

          {articles?.map((article) => (
            <div
              key={article.id}
              data-testid="article-list-item"
              className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3 transition hover:border-stone-300 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{article.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${statusTone(article.status)}`}>
                      {statusLabel(article)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{new Date(article.created_at).toLocaleString()}</p>
                  {article.processing_error ? <p className="mt-1 text-xs text-red-600">{article.processing_error}</p> : null}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/reader/${article.id}`}
                    className={`rounded-md border px-3 py-1 text-sm ${
                      article.status === "failed"
                        ? "pointer-events-none opacity-50"
                        : "border-stone-300 hover:bg-stone-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
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

          {!hasArticles && !articlesQuery.isLoading ? (
            <div
              data-testid="library-empty-state"
              className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4 text-sm dark:border-brand-700 dark:bg-brand-900/20"
            >
              <p className="font-medium">还没有导入过内容。</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                下一步：从下面的默认书架点「开始精读」，或把你最近读不顺的一段日文粘贴到下面的导入框。
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* 公共书架与粘贴导入：清晰分区 */}
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Public domain shelf</p>
            <h2 className="mt-0.5 text-lg font-semibold">默认书架</h2>
            <p className="mt-1 text-xs text-zinc-500">不知道读什么时，从这里挑一段公共领域名著开始。</p>
          </div>
          <p className="text-xs text-zinc-500">来源标注为青空文庫，第一版先导入节选精读。</p>
        </div>
        <div data-testid="public-bookshelf" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PUBLIC_BOOKS.map((book) => {
            const isImporting = createMutation.isPending && createMutation.variables?.title === book.title;
            return (
              <div
                key={book.slug}
                className="flex min-h-[220px] flex-col rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">{book.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{book.author}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {book.level}
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{book.description}</p>
                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-zinc-500">
                  <a href={book.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {book.sourceLabel}
                  </a>
                  <span>{book.readingTime}</span>
                </div>
                <button
                  type="button"
                  data-testid={`public-book-start-${book.slug}`}
                  className="mt-3 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  disabled={createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      title: book.title,
                      source_type: "text",
                      raw_content: book.excerpt,
                    })
                  }
                >
                  {isImporting ? "打开中..." : "开始精读"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">导入一段日文</h2>
        <p className="mt-1 text-xs text-zinc-500">
          下面填的是示例段落，请替换成你自己手头的内容。一次只导入一段，便于你立刻读完它。
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate({
              title,
              source_type: sourceType,
              raw_content: sourceType === "epub" ? epubPayload : rawContent,
            });
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm">来源</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="source-type-text"
                aria-pressed={sourceType === "text"}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                  sourceType === "text"
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100"
                    : "border-zinc-300 bg-transparent text-zinc-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
                onClick={() => {
                  setSourceType("text");
                  setEpubReadError("");
                  setIsReadingEpub(false);
                }}
              >
                直接粘贴文本
              </button>
              <label
                htmlFor="epub-file-input"
                role="button"
                tabIndex={0}
                data-testid="source-type-epub"
                aria-pressed={sourceType === "epub"}
                className={`cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition ${
                  sourceType === "epub"
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100"
                    : "border-zinc-300 bg-transparent text-zinc-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }`}
                onClick={() => {
                  setSourceType("epub");
                }}
              >
                上传 EPUB
              </label>
            </div>
            <input
              id="epub-file-input"
              data-testid="epub-file-input"
              className="sr-only"
              type="file"
              accept=".epub,application/epub+zip"
              onChange={(event) => readEpubFile(event.target.files?.[0])}
            />
          </fieldset>

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
            <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4 text-sm dark:border-brand-700 dark:bg-brand-900/20">
              <p className="font-medium">EPUB 文件</p>
              <p className="mt-1 text-xs text-zinc-500">支持常见小说 EPUB，单文件上限 20MB。</p>
              <label
                htmlFor="epub-file-input"
                role="button"
                tabIndex={0}
                className="mt-3 inline-flex cursor-pointer rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700"
              >
                选择 EPUB 文件
              </label>
              {epubFileName ? <p className="mt-1 text-xs text-zinc-500">已选择：{epubFileName}</p> : null}
              {isReadingEpub ? <p className="mt-1 text-xs text-zinc-500">正在读取 EPUB 文件...</p> : null}
              {epubReadError ? <p className="mt-1 text-xs text-red-600">{epubReadError}</p> : null}
            </div>
          )}

          {createMutation.isError ? <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p> : null}

          <button
            type="submit"
            data-testid="create-article-submit"
            className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={createMutation.isPending || isReadingEpub || (sourceType === "epub" && !epubPayload)}
          >
            {isReadingEpub ? "读取 EPUB 中..." : createMutation.isPending ? "导入中..." : "导入并开始阅读"}
          </button>
        </form>
      </div>
    </section>
  );
}
