"use client";

import Link from "next/link";

import { PUBLIC_BOOKS } from "../lib/public-books";

const previewBooks = PUBLIC_BOOKS.slice(0, 4);

const READING_LOOP: Array<{ title: string; body: string }> = [
  { title: "难词标注", body: "N3+ / N2+ / N1 三档高亮，颜色只服务阅读，不抢正文。" },
  { title: "AI 句子拆解", body: "选中一句，得到中文释义、语法点和逐词拆解。" },
  { title: "生词回流", body: "点词或采纳 AI 建议词，一键加入生词本，之后到期复习。" },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Workbench entry: 今天读什么 + 公共书架 */}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Genbun · 日文原文阅读工作台
          </p>
          <h1
            data-testid="home-headline"
            className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl"
          >
            为 N2-N1 学习者准备的原文精读工作台
          </h1>
          <p
            data-testid="home-subhead"
            className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300"
          >
            从一段读不顺的日文开始：选 N3+、N2+ 或 N1 三档高亮，点词查义，选句让 AI 中文拆解，
            再把值得记住的词放进生词本复习。
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-zinc-700">N2-N1 主力</span>
            <span className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-zinc-700">N3 过渡可用</span>
            <span className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-zinc-700">原文优先</span>
          </div>

          <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-950/20">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">今天读什么？</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              从右侧公共书架挑一篇开始，或把你正在读的轻小说、新闻、论文摘要、JLPT 阅读片段贴进书架。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/library"
                data-testid="home-cta-import"
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                打开书架 / 粘贴片段
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                登录 / 注册
              </Link>
              <Link
                href="/pricing"
                data-testid="home-cta-pricing"
                className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                查看定价
              </Link>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-stone-200 bg-stone-50 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">Public shelf</p>
              <h2 className="mt-0.5 text-base font-semibold">公共领域书架</h2>
            </div>
            <Link href="/library" className="text-xs text-brand-700 hover:underline dark:text-brand-300">
              全部
            </Link>
          </div>

          <div className="mt-4 space-y-2.5" data-testid="home-public-books">
            {previewBooks.map((book) => (
              <Link
                key={book.slug}
                href="/library"
                className="block rounded-lg border border-stone-200 bg-white px-3 py-2.5 transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-brand-500 dark:hover:bg-brand-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{book.title}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{book.author}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {book.level}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      {/* Reading loop — what you keep after each passage */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">读完一段后，Genbun 帮你留下这三件事</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {READING_LOOP.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
