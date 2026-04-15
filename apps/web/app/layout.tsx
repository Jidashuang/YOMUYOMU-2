import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "../components/providers";
import { TopNav } from "../components/top-nav";

export const metadata: Metadata = {
  title: "Yomuyomu",
  description: "Japanese reading SaaS for learners who want reading, lookup, AI explanation, and review in one loop.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Providers>
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
          <footer className="border-t border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-6 text-sm text-zinc-600 dark:text-zinc-300 sm:flex-row sm:items-center sm:justify-between">
              <p>Yomuyomu public beta. Read, understand, retain.</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/pricing">Pricing</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/login">Login</Link>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
