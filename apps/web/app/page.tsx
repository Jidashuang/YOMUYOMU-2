"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuthStore } from "../lib/auth-store";
import { PUBLIC_BOOKS } from "../lib/public-books";

const previewBooks = PUBLIC_BOOKS.slice(0, 4);

const READING_LOOP: Array<{ step: string; title: string; body: string }> = [
  { step: "01", title: "难词标注", body: "N3+ / N2+ / N1 三档高亮，颜色只服务阅读，不抢正文。" },
  { step: "02", title: "AI 句子拆解", body: "选中一句，得到中文释义、语法点和逐词拆解。" },
  { step: "03", title: "生词回流", body: "点词或采纳 AI 建议词，一键加入生词本，之后到期复习。" },
];

// 与阅读器里 N3/N2/N1 的着色保持一致
const LEVEL_CLASS = {
  N3: "bg-sky-100 text-sky-950 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900",
  N2: "bg-amber-100 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
  N1: "bg-rose-100 text-rose-950 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
} as const;

type SampleLevel = keyof typeof LEVEL_CLASS;

// 《羅生門》开头一段（青空文庫，公共领域）；着色与阅读器实际标注结果一致。
const SAMPLE_PASSAGE: Array<string | { text: string; level: SampleLevel; selected?: boolean }> = [
  "ある日の",
  { text: "暮方", level: "N1" },
  "の事である。一人の",
  { text: "下人", level: "N1", selected: true },
  "が、",
  { text: "羅生門", level: "N1" },
  "の下で",
  { text: "雨やみ", level: "N1" },
  "を待っていた。広い門の下には、この男のほかに誰もいない。",
  { text: "ただ", level: "N3" },
  "、",
  { text: "所々", level: "N2" },
  { text: "丹塗", level: "N2" },
  "の",
  { text: "剥げ", level: "N2" },
  "た、大きな",
  { text: "円柱", level: "N1" },
  "に、",
  { text: "蟋蟀", level: "N1" },
  "が一匹とまっている。",
];

function formatReadingTime(value: string): string {
  const minutes = /^(\d+)\s*min$/.exec(value);
  if (minutes) {
    return `约 ${minutes[1]} 分钟`;
  }
  return value === "long read" ? "长篇" : value;
}

/** 阅读器效果的静态示例：不连接后端，只用来让访客一眼看懂产品。 */
function ReadingSample() {
  return (
    <div
      role="img"
      aria-label="阅读器示例：《羅生門》片段，难词按 N3、N2、N1 着色，点词后弹出中文释义"
      className="relative"
    >
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>《羅生門》· 芥川 竜之介</span>
          <span className="flex gap-1.5">
            {(Object.keys(LEVEL_CLASS) as SampleLevel[]).map((level) => (
              <span key={level} className={`rounded px-1.5 py-0.5 text-[11px] ${LEVEL_CLASS[level]}`}>
                {level}
              </span>
            ))}
          </span>
        </div>

        <p lang="ja" className="mt-4 text-lg leading-[2.1] text-zinc-900 dark:text-zinc-100 sm:text-xl sm:leading-[2.2]">
          {SAMPLE_PASSAGE.map((part, index) =>
            typeof part === "string" ? (
              <span key={index}>{part}</span>
            ) : (
              <span
                key={index}
                className={`whitespace-nowrap rounded-sm px-0.5 ${LEVEL_CLASS[part.level]} ${
                  part.selected ? "ring-2 !ring-brand-500" : ""
                }`}
              >
                {part.text}
              </span>
            )
          )}
        </p>
      </div>

      {/* 点词后的查义弹窗（静态示意） */}
      <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-950 sm:ml-auto sm:-mt-4 sm:mr-4 sm:w-[18.5rem]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-semibold leading-tight">
            下人 <span className="ml-1 text-xs font-normal text-zinc-500">げにん</span>
          </p>
          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] text-rose-950 dark:bg-rose-950/40 dark:text-rose-200">
            N1
          </span>
        </div>
        <div className="mt-2 rounded-md bg-stone-50 p-2.5 dark:bg-zinc-900">
          <p className="text-[11px] text-zinc-500">中文释义</p>
          <p className="mt-0.5 text-sm font-medium">低级别的人；卑微的人</p>
        </div>
        <div className="mt-3 rounded-md bg-brand-500 px-3 py-1.5 text-center text-sm font-medium text-white">
          加入生词本
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const user = useAuthStore((state) => state.user);
  // 登录状态来自 localStorage，首屏先按未登录渲染，挂载后再切换，避免服务端/客户端不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loggedIn = mounted && Boolean(user);

  return (
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col justify-center gap-14 py-4 lg:gap-20 lg:py-8">
      {/* 首屏：主张 + 一个主操作 + 阅读器效果示例 */}
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <div>
          <p className="inline-flex rounded-full border border-stone-300 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            N2–N1 主力 · N3 过渡可用 · 原文优先
          </p>
          <h1
            data-testid="home-headline"
            className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl xl:text-5xl xl:leading-[1.15]"
          >
            {/* 两段各自不拆行，避免在「准/备」这类词中间断开 */}
            <span className="inline-block">为 N2-N1 学习者准备的</span> <span className="inline-block">原文精读工作台</span>
          </h1>
          <p
            data-testid="home-subhead"
            className="mt-5 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg sm:leading-8"
          >
            从一段读不顺的日文开始：选 N3+、N2+ 或 N1 三档高亮，点词查义，选句让 AI 中文拆解，
            再把值得记住的词放进生词本复习。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/library"
              data-testid="home-cta-import"
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
            >
              打开书架 / 粘贴片段
            </Link>
            {loggedIn ? (
              <Link href="/vocab" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                去复习生词 →
              </Link>
            ) : (
              <Link href="/login" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                登录 / 注册 →
              </Link>
            )}
          </div>
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            不用自己找材料：书架里有青空文庫的公共领域名著，也可以贴你正在读的轻小说、新闻或 JLPT 阅读。
          </p>
        </div>

        <ReadingSample />
      </section>

      {/* 读完一段后留下什么 */}
      <section aria-label="阅读流程">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">读完一段后，Genbun 帮你留下这三件事</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {READING_LOOP.map((item) => (
            <div key={item.title} className="border-t-2 border-zinc-900 pt-4 dark:border-zinc-200">
              <p className="text-xs font-medium tabular-nums text-zinc-400">{item.step}</p>
              <p className="mt-1 text-base font-semibold">{item.title}</p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 公共领域书架 */}
      <section aria-label="公共领域书架">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">公共领域书架</h2>
          <Link href="/library" className="text-sm text-brand-700 hover:underline dark:text-brand-300">
            全部 →
          </Link>
        </div>
        <div data-testid="home-public-books" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {previewBooks.map((book) => (
            <Link
              key={book.slug}
              href="/library"
              className="group flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500"
            >
              <div className="flex items-start justify-between gap-3">
                <p lang="ja" className="text-xl font-semibold leading-tight">
                  {book.title}
                </p>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {book.level}
                </span>
              </div>
              <p lang="ja" className="mt-1 text-xs text-zinc-500">
                {book.author}
              </p>
              <p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {book.description}
              </p>
              <p className="mt-3 text-xs text-zinc-400 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                {formatReadingTime(book.readingTime)} · {book.sourceLabel}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
