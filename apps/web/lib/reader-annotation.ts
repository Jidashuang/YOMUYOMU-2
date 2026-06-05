import type { ArticleBlock, JlptLevel } from "@yomuyomu/shared-types";

// The reader highlights three difficulty bands. N3 is the most permissive ("N3+" shows
// N3/N2/N1), N1 the strictest. Lower rank number = harder = always shown at easier settings.
export type AnnotationLevel = "N3" | "N2" | "N1";

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
