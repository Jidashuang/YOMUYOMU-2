"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { login, register } from "../../lib/api";
import { useAuthStore } from "../../lib/auth-store";
import { Button } from "@yomuyomu/ui";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);
  const sessionResolved = useAuthStore((state) => state.sessionResolved);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    if (sessionResolved && user) {
      router.replace("/library");
    }
  }, [router, sessionResolved, user]);

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "register") {
        return register({ email, password });
      }
      return login({ email, password });
    },
    onSuccess: (session) => {
      setUser({ id: session.user.id, email: session.user.email });
      router.push("/library");
    },
  });

  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold">{mode === "login" ? "登录" : "注册"}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">使用 email + password 登录，认证由安全 cookie 托管。</p>

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
            onChange={(event) => {
              if (mutation.isError) {
                mutation.reset();
              }
              setEmail(event.target.value);
            }}
          />
        </label>

        <label className="block text-sm">
          Password
          <input
            data-testid="login-password"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            type="password"
            value={password}
            minLength={8}
            maxLength={128}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(event) => {
              if (mutation.isError) {
                mutation.reset();
              }
              setPassword(event.target.value);
            }}
          />
        </label>

        {mode === "register" ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Password 要求</p>
            <ul className="mt-2 space-y-1">
              <li>8-128 位字符</li>
              <li>不能全是空格</li>
              <li>不能与邮箱相同</li>
              <li>不能使用常见弱密码</li>
            </ul>
          </div>
        ) : null}

        {mutation.isError ? <p className="text-sm text-red-600">{(mutation.error as Error).message}</p> : null}

        <div className="flex items-center gap-3">
          <Button data-testid="login-submit" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "提交中..." : mode === "login" ? "登录" : "注册"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              mutation.reset();
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            切换到{mode === "login" ? "注册" : "登录"}
          </Button>
        </div>
      </form>
    </div>
  );
}
