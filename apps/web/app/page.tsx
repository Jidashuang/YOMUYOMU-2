import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <section className="landing-hero overflow-hidden rounded-[2rem] border border-orange-200/70 px-6 py-10 shadow-sm sm:px-10 sm:py-14">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-orange-300 bg-white/75 px-3 py-1 text-xs font-medium text-orange-700 backdrop-blur">
                Public beta for Japanese learners
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                  读原文，不丢词。
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-700 sm:text-lg">
                  Yomuyomu 把日语阅读、查词、AI 解释和生词复习接成一个闭环。你不用在阅读器、词典、笔记和 Anki 之间来回切。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
                >
                  免费注册
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-zinc-300 bg-white/80 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
                >
                  查看定价
                </Link>
              </div>
              <div className="grid gap-3 text-sm text-zinc-600 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur">
                  <p className="font-medium text-zinc-900">阅读不中断</p>
                  <p className="mt-1">原文、词义、语法解释都留在同一页。</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur">
                  <p className="font-medium text-zinc-900">生词自动沉淀</p>
                  <p className="mt-1">高亮、查词、AI 建议都能一键加入复习流。</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur">
                  <p className="font-medium text-zinc-900">为长期掌握设计</p>
                  <p className="mt-1">按掌握状态与到期时间组织每日复习。</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-950 p-6 text-zinc-50 shadow-xl">
                <p className="text-sm text-zinc-300">学习闭环</p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-sm font-medium">1. 阅读原文</p>
                    <p className="mt-1 text-sm text-zinc-300">导入文本或 EPUB，直接进入可点击阅读。</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-sm font-medium">2. 即时理解</p>
                    <p className="mt-1 text-sm text-zinc-300">词典 lookup + AI explanation 同步给出语义与语气。</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-sm font-medium">3. 复习回收</p>
                    <p className="mt-1 text-sm text-zinc-300">新增生词自动进入 today new / review due 队列。</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-medium text-zinc-900">适合谁</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-600">
                  <li>已经开始读日语原文，但还不想被查词打断节奏的人。</li>
                  <li>希望把“查过的词”自然带入复习，而不是手工搬运的人。</li>
                  <li>需要一个比普通阅读器更懂学习场景的轻量 Web 工具的人。</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">文章导入</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              支持文本与 EPUB，导入后进入异步处理流程，准备完成即可继续阅读。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">AI 学习解释</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              不只给翻译，也给语法点、替代表达、语气说明与建议收词。
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-900">轻量复习面板</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              用 `today new / unmastered / review due` 三个入口把每天的学习动作收回来。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
