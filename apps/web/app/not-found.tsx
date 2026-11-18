import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">找不到这个页面</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        链接可能写错了，或者这篇内容已经被删除。
      </p>
      <Link
        href="/library"
        className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-700"
      >
        回到书架
      </Link>
    </section>
  );
}
