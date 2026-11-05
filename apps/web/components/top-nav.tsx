"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../lib/auth-store";
import { listVocab } from "../lib/api";

const NAV_LINKS: Array<{ href: string; label: string; testId?: string }> = [
  { href: "/library", label: "书架" },
  { href: "/vocab", label: "生词" },
  { href: "/pricing", label: "定价", testId: "top-nav-pricing" },
  { href: "/settings", label: "设置" },
];

export function TopNav() {
  const { user, clearAuth } = useAuthStore();
  const pathname = usePathname();

  // Surface how many vocab items are due for review, as a badge on the 生词 link.
  const dueReviewQuery = useQuery({
    queryKey: ["vocab", "review_due"],
    queryFn: () => listVocab("review_due"),
    enabled: Boolean(user),
    refetchInterval: 5 * 60 * 1000,
  });
  const dueCount = dueReviewQuery.data?.length ?? 0;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          <Link
            href="/"
            data-testid="top-nav-home"
            className="mr-2 text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Genbun
            <span className="ml-1 hidden align-middle text-[10px] font-normal uppercase tracking-wider text-zinc-400 sm:inline">
              beta
            </span>
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-testid={link.testId}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 transition ${
                isActive(link.href)
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "hover:bg-white/70 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
              }`}
            >
              {link.label}
              {link.href === "/vocab" && dueCount > 0 ? (
                <span
                  data-testid="vocab-due-badge"
                  title={`${dueCount} 个生词待复习`}
                  className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
                >
                  {dueCount > 99 ? "99+" : dueCount}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          {user ? (
            <>
              <span className="max-w-[40vw] truncate sm:max-w-[200px]" title={user.email}>
                {user.email}
              </span>
              <button
                className="rounded-md border border-stone-300 px-3 py-1 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
                onClick={clearAuth}
              >
                退出
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-stone-300 px-3 py-1 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              登录
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
