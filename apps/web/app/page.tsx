"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getApiHealth, getNlpHealth } from "../lib/api";

export default function HomePage() {
  const apiHealth = useQuery({ queryKey: ["api-health"], queryFn: getApiHealth });
  const nlpHealth = useQuery({ queryKey: ["nlp-health"], queryFn: getNlpHealth });

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">Yomuyomu MVP · Phase 6</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          当前聚焦学习闭环：查词质量、AI 解释质量、关键词一键加词与复习列表。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/library" className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
            打开 Library
          </Link>
          <Link href="/vocab" className="rounded-md border px-4 py-2">
            打开 Vocab
          </Link>
          <Link href="/settings" className="rounded-md border px-4 py-2">
            打开 Settings
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">API Health</h2>
          <p className="mt-2 text-sm">{apiHealth.data ? JSON.stringify(apiHealth.data) : apiHealth.isError ? "error" : "loading"}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-medium">NLP Health</h2>
          <p className="mt-2 text-sm">{nlpHealth.data ? JSON.stringify(nlpHealth.data) : nlpHealth.isError ? "error" : "loading"}</p>
        </div>
      </section>
    </div>
  );
}
