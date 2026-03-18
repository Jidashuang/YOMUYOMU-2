"use client";

import Link from "next/link";
import { useAuthStore } from "../lib/auth-store";

export function TopNav() {
  const { user, clearAuth } = useAuthStore();

  return (
    <header className="border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Link href="/">Yomuyomu</Link>
          <Link href="/library">Library</Link>
          <Link href="/vocab">Vocab</Link>
          <Link href="/settings">Settings</Link>
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
