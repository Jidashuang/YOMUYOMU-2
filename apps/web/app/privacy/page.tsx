export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          这是公开上线前的基础隐私说明草案，用来明确当前站点收集什么、为什么收集、以及数据如何用于学习体验。
        </p>
      </header>

      <div className="space-y-5 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm">
        <section>
          <h2 className="text-lg font-semibold text-zinc-950">我们收集哪些数据</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            账号邮箱、文章内容、查词记录、生词本条目、AI explanation 请求记录，以及阅读进度等与产品体验直接相关的数据。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-950">为什么收集</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            这些数据用于提供登录态、保存个人阅读资料、生成 AI 学习解释，以及把学习动作组织成可复习的闭环。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-950">第三方处理</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            当前仓库已接入可配置的 AI provider 与基础基础设施组件。正式上线前，需要补齐面向用户的第三方列表、数据保留周期与删除流程。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-950">你的控制权</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            你可以删除文章与生词条目。账号删除、数据导出范围、保留周期与隐私联系渠道仍需在正式商业化前补完整。
          </p>
        </section>
      </div>
    </section>
  );
}
