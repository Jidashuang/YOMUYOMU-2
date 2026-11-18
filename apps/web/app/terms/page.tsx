import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "../../components/legal";
import { OPERATOR_NAME } from "../../lib/site";

export const metadata: Metadata = { title: "服务条款 · Genbun" };

export default function TermsPage() {
  return (
    <LegalPage title="服务条款">
      <LegalSection title="这是什么">
        <p>
          Genbun 是一个帮助中文使用者精读日文原文的网站，由个人开发者 {OPERATOR_NAME} 运营。
          注册或使用 Genbun，即表示你同意这份条款和
          <Link className="underline" href="/privacy">
            隐私政策
          </Link>
          。
        </p>
      </LegalSection>

      <LegalSection title="你的账号">
        <LegalList
          items={[
            "请使用你本人能收信的邮箱注册，并妥善保管密码。账号下发生的操作由你负责。",
            "一个人请只使用一个账号，不要转让或出借。",
          ]}
        />
      </LegalSection>

      <LegalSection title="你导入的内容">
        <LegalList
          items={[
            "你导入的文本和 EPUB 仍然属于你或原权利人，我们不主张任何权利。",
            "请只导入你有权使用的内容，例如自己购买后供个人学习的书、公开文章、公共领域作品。不要导入盗版内容，也不要借 Genbun 向他人传播受版权保护的作品。",
            "你导入的内容只有你自己能看到。为了提供分词、标注和解释，我们会按隐私政策所述处理它们。",
            "书架里自带的作品来自青空文庫，属于在日本已进入公共领域的作品。",
          ]}
        />
      </LegalSection>

      <LegalSection title="请不要这样使用">
        <LegalList
          items={[
            "用程序批量注册、批量调用接口，或以其他方式干扰服务正常运行。",
            "尝试访问他人的账号或数据。",
            "把 Genbun 的 AI 解释功能当作通用的 AI 接口转售或对外提供。",
          ]}
        />
        <p>为了保证所有人可用，我们对登录、查词、导入和 AI 解释设有次数限制。出现上述行为时，我们可能限制或停用相关账号。</p>
      </LegalSection>

      <LegalSection title="关于 AI 解释和词典内容">
        <p>
          AI 生成的翻译、语法说明，以及自动的难词等级标注，都可能出错。它们是帮助你理解的参考，
          不是权威答案，请不要把它们作为考试、翻译交付或其他重要用途的唯一依据。
          词典与例句数据来自 JMdict、中文维基词典和 Tatoeba 等开放项目，版权归各自的贡献者所有。
        </p>
      </LegalSection>

      <LegalSection title="服务的现状">
        <LegalList
          items={[
            "Genbun 处于早期阶段，由一个人维护。功能可能调整，服务可能中断，我们不保证持续可用或没有错误。",
            "我们会尽力保护你的数据，但请为重要的生词定期使用导出功能自行备份。",
            "目前所有功能免费提供。将来如果推出付费方案，价格和退款规则会在你付款之前清楚写明。",
            "在法律允许的范围内，我们不对因使用或无法使用本服务造成的间接损失负责。",
          ]}
        />
      </LegalSection>

      <LegalSection title="停止使用">
        <p>
          你可以随时停止使用，并按隐私政策所述申请删除账号。如果我们决定停止运营，会提前在网站上通知，
          并留出时间让你导出数据。
        </p>
      </LegalSection>

      <LegalSection title="变更与联系">
        <p>
          条款有重要变化时，我们会更新页面顶部的日期并在网站上提示；继续使用即表示接受新的条款。
          有任何问题，请联系 <ContactEmail />。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
