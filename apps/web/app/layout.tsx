import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/providers";
import { TopNav } from "../components/top-nav";

export const metadata: Metadata = {
  title: "Yomuyomu",
  description: "Japanese reading SaaS MVP",
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
