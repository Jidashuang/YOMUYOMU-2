export interface PublicBook {
  slug: string;
  title: string;
  author: string;
  level: "N3+" | "N2+" | "N1";
  readingTime: string;
  sourceLabel: string;
  sourceUrl: string;
  description: string;
  contentPath: string;
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
    description: "完整短篇经典，适合练习文学叙述、心理描写和抽象表达。",
    contentPath: "/books/rashomon.txt",
  },
  {
    slug: "sangetsuki",
    title: "山月記",
    author: "中島 敦",
    level: "N1",
    readingTime: "18 min",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000119/card624.html",
    description: "完整短篇，汉文感强，适合高阶学习者练习书面语和典故表达。",
    contentPath: "/books/sangetsuki.txt",
  },
  {
    slug: "lemon",
    title: "檸檬",
    author: "梶井 基次郎",
    level: "N2+",
    readingTime: "10 min",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000074/card424.html",
    description: "完整现代短篇，句子不长但意象密度高，适合练习语感。",
    contentPath: "/books/lemon.txt",
  },
  {
    slug: "kokoro",
    title: "こころ",
    author: "夏目 漱石",
    level: "N2+",
    readingTime: "long read",
    sourceLabel: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000148/card773.html",
    description: "完整长篇，适合练习近代文学里的叙述节奏和人物心理。",
    contentPath: "/books/kokoro.txt",
  },
];
