"use client";

import Link from "next/link";
import { useAuthStore } from "../lib/auth-store";

export function TopNav() {
  const { user, clearAuth } = useAuthStore();

  return (
    <header className="border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Link href="/" data-testid="top-nav-home" className="font-semibold">
            Genbun
            <span className="ml-1 hidden align-middle text-[10px] font-normal uppercase tracking-wider text-zinc-500 sm:inline">
              beta
            </span>
          </Link>
          <Link href="/library">书架</Link>
          <Link href="/vocab">生词</Link>
          <Link href="/pricing" data-testid="top-nav-pricing">Pricing</Link>
          <Link href="/settings">设置</Link>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          {user ? <span>{user.email}</span> : <Link href="/login">Login</Link>}
          {user ? (
            <button className="rounded-md border px-3 py-1" onClick={clearAuth}>
              Logout
            </button>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
