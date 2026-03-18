"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { login, register } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";
import { Button } from "@yomuyomu/ui";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123");
  const [mode, setMode] = useState<"login" | "register">("login");

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "register") {
        return register({ email, password });
      }
      return login({ email, password });
    },
    onSuccess: (result) => {
      setAuth(result.access_token, result.user);
      router.push("/library");
    },
  });

  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold">{mode === "login" ? "登录" : "注册"}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Phase 1 使用 email + password + JWT。</p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="block text-sm">
          Email
          <input
            data-testid="login-email"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block text-sm">
          Password
          <input
            data-testid="login-password"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {mutation.isError ? <p className="text-sm text-red-600">{(mutation.error as Error).message}</p> : null}

        <div className="flex items-center gap-3">
          <Button data-testid="login-submit" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "提交中..." : mode === "login" ? "登录" : "注册"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            切换到{mode === "login" ? "注册" : "登录"}
          </Button>
        </div>
      </form>
    </div>
  );
}
