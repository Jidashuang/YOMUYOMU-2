"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">页面出了点问题</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        你的书架和生词不会受影响。可以先重试一次，还不行就回到书架。
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-700"
        >
          重试
        </button>
        <Link href="/library" className="text-sm text-zinc-600 underline dark:text-zinc-300">
          回到书架
        </Link>
      </div>
    </section>
  );
}
