"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@yomuyomu/ui";
import { createBillingCheckoutSession, getBillingSummary } from "../../lib/api";
import { UnauthorizedError } from "../../lib/api-client";
import { useAuthStore } from "../../lib/auth-store";

export function PricingUpgradeButton() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionResolved = useAuthStore((state) => state.sessionResolved);
  const billingQuery = useQuery({
    queryKey: ["billing", "me"],
    queryFn: getBillingSummary,
    enabled: sessionResolved && Boolean(user),
  });

  const mutation = useMutation({
    mutationFn: createBillingCheckoutSession,
    onSuccess: (result) => {
      window.location.href = result.checkout_url;
    },
  });

  if (!sessionResolved) {
    return (
      <Button type="button" disabled>
        检查登录状态...
      </Button>
    );
  }

  if (!user) {
    return (
      <Button type="button" onClick={() => router.push("/login")}>
        登录后升级
      </Button>
    );
  }

  const isCurrentPro =
    billingQuery.data?.plan === "pro" &&
    (billingQuery.data.billing_status === "active" || billingQuery.data.billing_status === "trialing");

  if (isCurrentPro) {
    return (
      <div className="mt-6 space-y-3">
        <Button type="button" disabled>
          当前已是 Pro
        </Button>
        <p className="text-sm text-zinc-600">你的订阅已经生效，无需重复升级。</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "跳转支付中..." : "升级到 Pro"}
      </Button>
      {mutation.isError ? (
        <p className="text-sm text-red-600">
          {mutation.error instanceof UnauthorizedError ? "登录已过期，请重新登录。" : (mutation.error as Error).message}
        </p>
      ) : null}
    </div>
  );
}

export function PricingUpgradeNotice() {
  const [upgradeState, setUpgradeState] = useState<string | null>(null);

  useEffect(() => {
    setUpgradeState(new URLSearchParams(window.location.search).get("upgrade"));
  }, []);

  if (upgradeState !== "canceled") {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-600">
      你已取消本次支付，没有发生扣费。准备好了可以随时再试一次。
    </div>
  );
}
