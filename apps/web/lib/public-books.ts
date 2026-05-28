export interface PublicBook {
  slug: string;
  title: string;
  author: string;
  level: "N3+" | "N2+" | "N1";
  readingTime: string;
  sourceLabel: string;
  sourceUrl: string;
  description: string;
  excerpt: string;
}

export const PUBLIC_BOOKS: PublicBook[] = [
  {
    slug: "rashomon",
    title: "羅生門",
    author: "芥川 竜之介",
    level: "N2+",
    readingTime: "12 min",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000879/card127.html",
    description: "短篇经典，适合练习文学叙述、心理描写和抽象表达。",
    excerpt: [
      "ある日の暮方の事である。一人の下人が、羅生門の下で雨やみを待っていた。",
      "広い門の下には、この男のほかに誰もいない。ただ、所々丹塗の剥げた、大きな円柱に、蟋蟀が一匹とまっている。",
      "羅生門が、朱雀大路にある以上は、この男のほかにも、雨やみをする市女笠や揉烏帽子が、もう二三人はありそうなものである。",
    ].join("\n"),
  },
  {
    slug: "sangetsuki",
    title: "山月記",
    author: "中島 敦",
    level: "N1",
    readingTime: "18 min",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000119/card624.html",
    description: "汉文感强，适合中文母语高阶学习者练习书面语和典故表达。",
    excerpt: [
      "隴西の李徴は博学才穎、天宝の末年、若くして名を虎榜に連ね、ついで江南尉に補せられたが、性、狷介、自ら恃むところ頗る厚く、賤吏に甘んずるを潔しとしなかった。",
      "いくばくもなく官を退いた後は、故山、虢略に帰臥し、人と交を絶って、ひたすら詩作に耽った。",
      "下吏となって長く膝を俗悪な大官の前に屈するよりは、詩家としての名を死後百年に遺そうとしたのである。",
    ].join("\n"),
  },
  {
    slug: "lemon",
    title: "檸檬",
    author: "梶井 基次郎",
    level: "N2+",
    readingTime: "10 min",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000074/card424.html",
    description: "现代短篇，句子不长但意象密度高，适合练习语感。",
    excerpt: [
      "えたいの知れない不吉な塊が私の心を始終圧えつけていた。",
      "焦躁と言おうか、嫌悪と言おうか、酒を飲んだあとに宿酔があるように、酒を毎日飲んでいると宿酔に相当した時期がやって来る。",
      "それが来たのだ。これはちょっといけなかった。",
    ].join("\n"),
  },
  {
    slug: "kokoro",
    title: "こころ",
    author: "夏目 漱石",
    level: "N2+",
    readingTime: "20 min",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000148/card773.html",
    description: "长篇节选，适合练习近代文学里的叙述节奏和人物心理。",
    excerpt: [
      "私はその人を常に先生と呼んでいた。だからここでもただ先生と書くだけで本名は打ち明けない。",
      "これは世間を憚かる遠慮というよりも、その方が私にとって自然だからである。",
      "私はその人の記憶を呼び起すごとに、すぐ「先生」といいたくなる。",
    ].join("\n"),
  },
];

