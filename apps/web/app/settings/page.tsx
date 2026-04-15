"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createBillingPortalSession, getBillingSummary } from "../../lib/api";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useUISettingsStore } from "../../lib/ui-settings-store";

export default function SettingsPage() {
  const { hydrated, isAuthorized } = useRequireAuth();
  const { theme, fontSize, lineHeight, setTheme, setFontSize, setLineHeight } = useUISettingsStore();
  const [upgradeState, setUpgradeState] = useState<string | null>(null);
  const billingQuery = useQuery({
    queryKey: ["billing", "me"],
    queryFn: getBillingSummary,
    enabled: hydrated && isAuthorized,
  });
  const portalMutation = useMutation({
    mutationFn: createBillingPortalSession,
    onSuccess: (result) => {
      window.location.href = result.portal_url;
    },
  });

  useEffect(() => {
    setUpgradeState(new URLSearchParams(window.location.search).get("upgrade"));
  }, []);

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">认证状态加载中...</p>;
  }

  if (!isAuthorized) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">请先登录后查看设置与套餐信息。</p>
        <Link href="/login" className="inline-flex rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-700">
          去登录
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {upgradeState === "success" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          支付已完成，正在同步套餐状态。如果这里还没变成 Pro，稍等几秒后刷新一次。
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Plan</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {billingQuery.data ? `当前套餐：${billingQuery.data.plan.toUpperCase()}` : "加载套餐信息中..."}
            </p>
            {billingQuery.data?.billing_status ? (
              <p className="mt-1 text-xs text-zinc-500">订阅状态：{billingQuery.data.billing_status}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="rounded-md border px-3 py-2 text-sm">
              查看定价
            </Link>
            {billingQuery.data?.plan === "pro" ? (
              <button
                className="rounded-md border px-3 py-2 text-sm"
                disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate()}
              >
                {portalMutation.isPending ? "跳转中..." : "管理订阅"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950">
          <p className="text-sm font-medium">AI explanation 月度额度</p>
          {billingQuery.data ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              已使用 {billingQuery.data.ai_explanations.used_this_month} / {billingQuery.data.ai_explanations.monthly_limit}，
              剩余 {billingQuery.data.ai_explanations.remaining}
            </p>
          ) : billingQuery.isError ? (
            <p className="mt-2 text-sm text-red-600">{(billingQuery.error as Error).message}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">加载中...</p>
          )}
          {portalMutation.isError ? (
            <p className="mt-2 text-sm text-red-600">{(portalMutation.error as Error).message}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Theme</h2>
        <div className="mt-3 flex gap-3">
          <button
            className={`rounded-md border px-4 py-2 ${theme === "light" ? "bg-zinc-100" : ""}`}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={`rounded-md border px-4 py-2 ${theme === "dark" ? "bg-zinc-800 text-zinc-100" : ""}`}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Reader Typography</h2>
        <label className="mt-3 block text-sm">
          字号: {fontSize}px
          <input
            className="mt-2 w-full"
            type="range"
            min={14}
            max={30}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          />
        </label>

        <label className="mt-4 block text-sm">
          行高: {lineHeight.toFixed(1)}
          <input
            className="mt-2 w-full"
            type="range"
            min={1.2}
            max={2.6}
            step={0.1}
            value={lineHeight}
            onChange={(event) => setLineHeight(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
