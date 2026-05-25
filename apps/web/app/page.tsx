"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">
          Yomuyomu · 公测中（名称可能调整）
        </p>
        <h1 data-testid="home-headline" className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
          专为中文母语 N4–N2 学习者打造的日语原文阅读工作台
        </h1>
        <p data-testid="home-subhead" className="mt-4 max-w-2xl text-base text-zinc-600 dark:text-zinc-300">
          把你正在读的轻小说、NHK 新闻、JLPT 阅读、网文片段贴进来，
          点词查义、整句中文解释、一键加入生词本与复习。不再在 Yomitan、Anki、ChatGPT、Jisho 之间来回切换。
        </p>

        <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="font-medium">为谁设计</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">中文母语、N4–N2、每周都在读真实日文内容的人。</p>
          </li>
          <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="font-medium">你带什么进来</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">你最近读不顺的一段日文：粘贴文本或上传 EPUB。</p>
          </li>
          <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="font-medium">解决什么痛</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">查词、整句中文解释、生词复习在同一个页面里完成。</p>
          </li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/library"
            data-testid="home-cta-import"
            className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700"
          >
            贴一段你最近读不顺的日文
          </Link>
          <Link href="/pricing" data-testid="home-cta-pricing" className="rounded-md border px-4 py-2">
            查看定价
          </Link>
          <Link href="/login" className="rounded-md border px-4 py-2">
            登录 / 注册
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium">为什么不是又一个日语阅读器</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <li>· 我们只服务一种人：能读真实日文、但中途经常卡壳的中文母语者。</li>
          <li>· 解释默认是中文，不是英文，也不是教学口吻；面向 N4–N2 的实际理解断点。</li>
          <li>· 不做免费阅读库、不做语法课程、不做 AI 老师对话；只让你把手头的内容读完、把生词留下来。</li>
        </ul>
      </section>
    </div>
  );
}
