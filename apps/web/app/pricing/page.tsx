import Link from "next/link";
import { PricingUpgradeButton, PricingUpgradeNotice } from "./PricingUpgradeButton";

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          目前已经接上最小可用的支付闭环。公开测试前，先把免费档和 Pro 档的边界跑通。
        </p>
      </header>

      <PricingUpgradeNotice />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-zinc-950">Starter</p>
              <p className="mt-1 text-sm text-zinc-500">先跑通阅读与学习闭环。</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-zinc-950">Free</p>
              <p className="text-xs text-zinc-500">公开测试期</p>
            </div>
          </div>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-zinc-700">
            <li>文本 / EPUB 导入</li>
            <li>词汇 lookup 与 AI explanation</li>
            <li>每月 20 次 AI explanation</li>
            <li>生词本、掌握状态、到期复习</li>
            <li>基础学习数据统计</li>
          </ul>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            免费注册
          </Link>
        </article>

        <article className="rounded-[1.75rem] border border-orange-300 bg-orange-50 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-zinc-950">Pro</p>
              <p className="mt-1 text-sm text-zinc-600">面向高频阅读者的正式付费档。</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-zinc-950">Checkout</p>
              <p className="text-xs text-zinc-600">价格以结账页为准</p>
            </div>
          </div>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-zinc-700">
            <li>每月 200 次 AI explanation</li>
            <li>更高 AI 使用额度</li>
            <li>更强的阅读与复习配额</li>
            <li>优先获得新功能与模型升级</li>
            <li>按月订阅，支付后自动升级</li>
          </ul>
          <PricingUpgradeButton />
          <p className="rounded-2xl border border-orange-200 bg-white/80 px-4 py-3 text-sm text-zinc-600">
            这一步已经接上 Checkout 与订阅回写。账单中心、退款、发票与自助取消还没做完，仍然属于上线前待补项。
          </p>
        </article>
      </div>
    </section>
  );
}
