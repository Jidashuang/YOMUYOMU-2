"use client";

import Link from "next/link";

import { PUBLIC_BOOKS } from "../lib/public-books";

const previewBooks = PUBLIC_BOOKS.slice(0, 4);

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-96px)] space-y-5">
      <section className="grid min-h-[620px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="rounded-lg border border-stone-200 bg-stone-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Public shelf</p>
              <h2 className="mt-1 text-lg font-semibold">公共领域书架</h2>
            </div>
            <Link href="/library" className="text-sm text-brand-700 hover:underline dark:text-brand-300">
              全部
            </Link>
          </div>

          <div className="mt-4 space-y-3" data-testid="home-public-books">
            {previewBooks.map((book) => (
              <Link
                key={book.slug}
                href="/library"
                className="block rounded-md border border-stone-200 bg-white px-3 py-3 transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-brand-500 dark:hover:bg-brand-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium leading-tight">{book.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{book.author}</p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {book.level}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{book.description}</p>
              </Link>
            ))}
          </div>
        </aside>

        <main className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Genbun · 日文原文阅读工作台
          </p>
          <h1 data-testid="home-headline" className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
            为 N2-N1 学习者准备的原文精读工作台
          </h1>
          <p data-testid="home-subhead" className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
            从一段读不顺的日文开始：选择 N3+、N2+ 或 N1 三档高亮，点词查义，选句让 AI 中文拆解，
            再把值得记住的词放进生词本复习。
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-zinc-700">N2-N1 主力</span>
            <span className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-zinc-700">N3 过渡可用</span>
            <span className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-zinc-700">原文优先</span>
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-brand-300 bg-brand-50/45 p-4 dark:border-brand-700 dark:bg-brand-950/20">
            <p className="text-sm font-medium">今天要读什么？</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              直接从左侧书架选一篇公共领域作品，或把你正在读的轻小说、新闻、论文摘要、JLPT 阅读片段贴进来。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/library"
                data-testid="home-cta-import"
                className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-700"
              >
                打开书架 / 粘贴片段
              </Link>
              <Link href="/login" className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800">
                登录 / 注册
              </Link>
              <Link href="/pricing" data-testid="home-cta-pricing" className="rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800">
                查看定价
              </Link>
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Today loop</p>
            <h2 className="mt-1 text-lg font-semibold">阅读后要留下什么</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-md bg-white p-3 dark:bg-zinc-950">
                <p className="font-medium">难词标注</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">N3+ / N2+ / N1 三档，颜色只服务阅读，不抢正文。</p>
              </div>
              <div className="rounded-md bg-white p-3 dark:bg-zinc-950">
                <p className="font-medium">AI 句子拆解</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">选中一句，得到中文释义、语法点和词语拆解。</p>
              </div>
              <div className="rounded-md bg-white p-3 dark:bg-zinc-950">
                <p className="font-medium">生词回流</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">点词或 AI 建议词，一键加入生词本，后面复习。</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-medium">不做什么</p>
            <p className="mt-2 leading-6 text-zinc-600 dark:text-zinc-300">
              不做泛课程、不做版权不清的书库、不做聊天老师。Genbun 只帮你把日文原文读通，把值得记住的词留下来。
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}
