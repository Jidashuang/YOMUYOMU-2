import type { ArticleBlock, ArticleToken, JlptLevel } from "@yomuyomu/shared-types";

// The reader highlights three difficulty bands. N3 is the most permissive ("N3+" shows
// N3/N2/N1), N1 the strictest. Lower rank number = harder = always shown at easier settings.
export type AnnotationLevel = "N3" | "N2" | "N1";

// CJK ideographs (incl. Extension A and compatibility) — used to decide whether a token
// needs furigana (pure-kana tokens never do).
const KANJI_RE = /[㐀-鿿豈-﫿]/;

export const jlptRank: Record<AnnotationLevel, number> = {
  N3: 3,
  N2: 2,
  N1: 1,
};

export function shouldAnnotate(tokenLevel: JlptLevel, annotationLevel: AnnotationLevel): boolean {
  if (tokenLevel !== "N3" && tokenLevel !== "N2" && tokenLevel !== "N1") {
    return false;
  }
  return jlptRank[tokenLevel] <= jlptRank[annotationLevel];
}

// Used to drive the "当前页暂无 N2/N1 词" hint: true when at least one token on the
// currently-loaded page would be coloured at the selected level.
export function pageHasAnnotatableToken(blocks: ArticleBlock[], annotationLevel: AnnotationLevel): boolean {
  return blocks.some((block) => block.tokens.some((token) => shouldAnnotate(token.jlpt_level, annotationLevel)));
}

// Sudachi returns readings in katakana (e.g. "クル"); furigana is conventionally hiragana.
export function katakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    // Katakana ァ(0x30A1)–ヶ(0x30F6) → hiragana by -0x60; leave ー, punctuation, kanji as-is.
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

// A token gets inline furigana only if it has a reading AND its surface contains kanji
// (pure-kana words don't need it).
export function shouldShowFurigana(token: Pick<ArticleToken, "surface" | "reading">): boolean {
  if (!token.reading) {
    return false;
  }
  return KANJI_RE.test(token.surface);
}
