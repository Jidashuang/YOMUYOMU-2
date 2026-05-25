"use client";

import Link from "next/link";

interface PlanFeature {
  text: string;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  cadence: string;
  positioning: string;
  cta: { label: string; href: string };
  features: PlanFeature[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "¥0",
    cadence: "持续可用",
    positioning: "适合先把一段你正在卡的日文读完。",
    cta: { label: "开始读一段", href: "/library" },
    features: [
      { text: "粘贴文本或上传 EPUB，不限来源。" },
      { text: "点词查义 + 整句中文 AI 解释（每日额度有限）。" },
      { text: "生词本与到期复习，CSV / JSON 导出。" },
    ],
  },
  {
    id: "pro",
    name: "Pro · 早期价",
    price: "¥39",
    cadence: "每月（验证期内锁定）",
    positioning: "适合每周读真实日文内容、希望少切换工具的人。",
    highlight: true,
    cta: { label: "我想付费试用", href: "mailto:hello@yomuyomu.app?subject=Yomuyomu%20Pro%20%E6%97%A9%E6%9C%9F%E4%BB%98%E8%B4%B9" },
    features: [
      { text: "把读不顺的轻小说 / NHK / JLPT 段落，一次读完不再切窗口。" },
      { text: "更高的 AI 整句解释额度，覆盖一次完整的阅读 session。" },
      { text: "完整的生词复习节奏：到期复习、状态追踪、导出到你已有的工作流。" },
      { text: "直接和创始人沟通：你卡在哪一段，下一周修哪里。" },
    ],
  },
];

export default function PricingPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700 dark:text-brand-300">
          定价 · 验证期早期价
        </p>
        <h1 data-testid="pricing-headline" className="text-3xl font-semibold">
          按阅读工作流付费，而不是按 AI 用量
        </h1>
        <p data-testid="pricing-subhead" className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          Yomuyomu 在 2 周验证窗口内，只服务中文母语 N4–N2 的真实阅读者。
          Pro 卖的是「读完一段你之前读不顺的日文 + 把生词留下 + 第二天还会回来」这个完整动作，
          不是 AI 调用次数本身。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            data-testid={`pricing-plan-${plan.id}`}
            className={`rounded-xl border p-6 ${
              plan.highlight
                ? "border-brand-500 bg-white shadow-sm dark:border-brand-400 dark:bg-zinc-900"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-1 text-3xl font-semibold">
              {plan.price}
              <span className="ml-2 text-sm font-normal text-zinc-500">{plan.cadence}</span>
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{plan.positioning}</p>

            <ul className="mt-4 space-y-2 text-sm">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden>·</span>
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            <Link
              href={plan.cta.href}
              data-testid={`pricing-cta-${plan.id}`}
              className={`mt-6 inline-flex rounded-md px-4 py-2 text-sm ${
                plan.highlight
                  ? "bg-brand-500 text-white hover:bg-brand-700"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {plan.cta.label}
            </Link>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Pro 早期价仅限验证期内的前 10 位付费用户使用。验证期结束后，价格与功能边界都会重新评估。
      </p>
    </section>
  );
}
