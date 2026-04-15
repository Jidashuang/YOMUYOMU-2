export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Terms</h1>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          这是公开上线前的基础使用条款草案，先把账户、内容使用与服务边界说清楚。
        </p>
      </header>

      <div className="space-y-5 rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-sm">
        <section>
          <h2 className="text-lg font-semibold text-zinc-950">账户责任</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            你需要对自己账户下的操作负责，并确保提交的信息真实、合法，不得以自动化滥用、攻击或绕过限制的方式使用服务。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-950">可接受使用</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            不得上传违法内容、恶意压测、尝试获取其他用户数据，或利用 AI explanation 能力生成违反适用法律与平台规则的内容。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-950">服务现状</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            当前产品仍处于公开测试前阶段，功能、配额与可用性可能调整。正式商业条款、退款条款与 SLA 尚未在仓库内落地。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-950">内容与知识产权</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            你保留对自己上传内容的权利；Yomuyomu 仅在提供阅读、查词、解释与复习服务所必需的范围内处理这些内容。
          </p>
        </section>
      </div>
    </section>
  );
}
