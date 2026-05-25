import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/providers";
import { TopNav } from "../components/top-nav";

export const metadata: Metadata = {
  title: "Yomuyomu · 中文母语 N4–N2 日语原文阅读工作台",
  description:
    "面向中文母语 N4–N2 学习者的日语原文阅读工作台：粘贴你正在读的内容，点词查义、整句中文 AI 解释、一键加入生词本与复习。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
