import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "../components/providers";
import { TopNav } from "../components/top-nav";

export const metadata: Metadata = {
  title: "Genbun · 日文原文阅读工作台",
  description:
    "面向 N2-N1 主力、兼容 N3 过渡学习者的日文原文阅读工作台：公共领域名著、片段精读、难词标注、AI 中文拆解与生词复习。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="bg-stone-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <TopNav />
          <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</main>
          <footer className="mx-auto flex w-full max-w-7xl gap-4 px-4 pb-24 pt-8 text-xs text-zinc-500 sm:px-6 lg:px-8">
            <span>© 2026 Genbun</span>
            <Link className="hover:underline" href="/privacy">
              隐私政策
            </Link>
            <Link className="hover:underline" href="/terms">
              服务条款
            </Link>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
