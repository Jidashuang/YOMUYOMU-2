import type { Metadata } from "next";
import { ContactEmail, LegalList, LegalPage, LegalSection } from "../../components/legal";
import { OPERATOR_NAME } from "../../lib/site";

export const metadata: Metadata = { title: "隐私政策 · Genbun" };

export default function PrivacyPage() {
  return (
    <LegalPage title="隐私政策">
      <LegalSection title="谁在运营">
        <p>
          Genbun 由个人开发者 {OPERATOR_NAME} 运营。这份说明告诉你：我们保存了你的哪些信息、用来做什么、
          会交给谁，以及你可以怎么处理它们。
        </p>
      </LegalSection>

      <LegalSection title="我们保存的信息">
        <LegalList
          items={[
            "账号：你的邮箱地址，以及加密后的密码。我们无法看到你的密码原文。",
            "你导入的内容：粘贴的文本、上传的 EPUB，以及由它们生成的分词和难词标注。",
            "学习记录：生词、划线和笔记、阅读进度、你请求过的 AI 句子解释。",
            "使用记录：你做了哪类操作及其时间（例如导入文章、查词、加入生词、复习），用来统计功能使用情况和排查问题。",
            "访问地址：为了防止恶意刷接口，登录和注册时会短暂记录网络地址（IP）用于计数，最长保留 1 小时。",
          ]}
        />
      </LegalSection>

      <LegalSection title="保存在你设备上的内容">
        <p>
          我们在你的浏览器本地存储里保存登录凭证和阅读偏好（主题、字号、行距等），这样你下次打开不用重新登录和设置。
          我们不使用广告追踪，也没有接入第三方统计或广告脚本。
        </p>
      </LegalSection>

      <LegalSection title="会发给第三方的内容">
        <p>为了提供解释和释义，下面这些内容会被发送给外部服务。发送时不会附带你的邮箱或账号信息。</p>
        <LegalList
          items={[
            "AI 句子解释：你选中的句子和它的前后句，会发送给 AI 模型服务商（Google 或 OpenAI）来生成中文解释。",
            "中文释义与例句：你点击的词，会用于向中文维基词典（Wiktionary）、Wikimedia 翻译服务和 Tatoeba 例句库查询。",
            "服务器：网站和数据库托管在云服务商（Google Cloud）的服务器上。",
          ]}
        />
        <p>
          请不要导入含有个人隐私或机密信息的文本。除上述情况和法律要求外，我们不会把你的信息出售或提供给其他人。
        </p>
      </LegalSection>

      <LegalSection title="保存多久，怎么删除">
        <LegalList
          items={[
            "你可以随时在书架里删除导入的文章，在生词本里删除生词。",
            "只要账号存在，其余数据会一直保存，方便你继续学习。",
            <>
              想导出生词可以在生词页直接下载。想删除整个账号和全部数据，请发邮件到 <ContactEmail />
              ，我们会在 30 天内处理。目前还没有自助注销功能。
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="未成年人">
        <p>Genbun 面向成年学习者。如果你未满 14 岁，请在监护人同意后再使用。</p>
      </LegalSection>

      <LegalSection title="变更与联系">
        <p>
          这份政策有重要变化时，我们会更新页面顶部的日期，并在网站上提示。有任何疑问，请联系 <ContactEmail />。
        </p>
      </LegalSection>
    </LegalPage>
  );
}
