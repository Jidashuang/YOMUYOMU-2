// 查词弹窗里的词性 / JLPT / 词频：把词典原始值转成用户看得懂的中文。

const JAPANESE_POS_LABELS: Record<string, string> = {
  名詞: "名词",
  代名詞: "代词",
  動詞: "动词",
  形容詞: "形容词",
  形状詞: "形容动词词干",
  副詞: "副词",
  助詞: "助词",
  助動詞: "助动词",
  接続詞: "接续词",
  連体詞: "连体词",
  感動詞: "感叹词",
  接頭辞: "接头词",
  接尾辞: "接尾词",
  記号: "符号",
  補助記号: "符号",
};

export function posLabel(pos: string[] | string | undefined | null): string {
  const items = Array.isArray(pos) ? pos : pos ? [pos] : [];
  const labels: string[] = [];
  for (const item of items) {
    const lower = item.toLowerCase();
    let label = JAPANESE_POS_LABELS[item] ?? "";
    if (label) {
      // Sudachi 给出的日文词性，直接映射
    } else if (lower.startsWith("noun")) label = "名词";
    else if (lower.includes("verb") && !lower.includes("adverb")) label = "动词";
    else if (lower.includes("adjectiv")) label = "形容词";
    else if (lower.startsWith("adverb")) label = "副词";
    else if (lower === "particle") label = "助词";
    else if (lower.startsWith("auxiliary")) label = "助动词";
    else if (lower.includes("expression")) label = "固定表达";
    else if (lower.includes("conjunction")) label = "接续词";
    else if (lower.includes("pronoun")) label = "代词";
    else if (lower.includes("interjection")) label = "感叹词";
    else if (lower.includes("prefix")) label = "接头词";
    else if (lower.includes("suffix")) label = "接尾词";
    const finalLabel = label || item;
    if (!labels.includes(finalLabel)) labels.push(finalLabel);
  }
  return labels.length > 0 ? labels.join("、") : "—";
}

export function jlptLabel(level: string | undefined | null): string {
  if (!level || level === "Unknown") return "未分级";
  return level;
}

const FREQUENCY_LABELS: Record<string, string> = {
  "top-1k": "极常见",
  "top-5k": "常见",
  "top-10k": "较常见",
  "outside-10k": "较少见",
};

export function frequencyLabel(band: string | undefined | null): string {
  if (!band || band === "Unknown") return "未收录";
  return FREQUENCY_LABELS[band] ?? band;
}
