"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "../lib/api";
import { useAuthStore } from "../lib/auth-store";

export function TopNav() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearAuth();
      router.push("/login");
    },
  });

  return (
    <header className="border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <nav className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <Link href="/" className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Yomuyomu
          </Link>
          {user ? (
            <>
              <Link href="/library">导入</Link>
              <Link href="/vocab">生词</Link>
              <Link href="/settings">设置</Link>
            </>
          ) : (
            <>
              <Link href="/pricing">Pricing</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          {user ? (
            <span>{user.email}</span>
          ) : (
            <Link href="/login" className="rounded-full bg-zinc-950 px-4 py-2 text-white transition hover:bg-zinc-800">
              Login
            </Link>
          )}
          {user ? (
            <button
              className="rounded-full border px-3 py-1"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </button>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
