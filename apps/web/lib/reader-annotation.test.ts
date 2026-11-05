import { describe, expect, it } from "vitest";
import type { ArticleBlock, JlptLevel } from "@yomuyomu/shared-types";

import { katakanaToHiragana, pageHasAnnotatableToken, shouldAnnotate, shouldShowFurigana } from "./reader-annotation";

describe("shouldAnnotate", () => {
  it("colors a token only when its level is at or harder than the selected level", () => {
    // N3 selected ("N3+") → N3/N2/N1 all shown
    expect(shouldAnnotate("N3", "N3")).toBe(true);
    expect(shouldAnnotate("N2", "N3")).toBe(true);
    expect(shouldAnnotate("N1", "N3")).toBe(true);
    // N2 selected ("N2+") → only N2/N1
    expect(shouldAnnotate("N3", "N2")).toBe(false);
    expect(shouldAnnotate("N2", "N2")).toBe(true);
    expect(shouldAnnotate("N1", "N2")).toBe(true);
    // N1 selected → only N1
    expect(shouldAnnotate("N3", "N1")).toBe(false);
    expect(shouldAnnotate("N2", "N1")).toBe(false);
    expect(shouldAnnotate("N1", "N1")).toBe(true);
  });

  it("never colors easy or unknown levels", () => {
    for (const level of ["N5", "N4", "Unknown"] as const) {
      expect(shouldAnnotate(level, "N3")).toBe(false);
      expect(shouldAnnotate(level, "N1")).toBe(false);
    }
  });
});

function blockWithLevels(levels: JlptLevel[]): ArticleBlock {
  return {
    id: "block-1",
    block_index: 0,
    text: "本文",
    tokens: levels.map((level, index) => ({
      surface: "語",
      lemma: "語",
      reading: "",
      pos: "名詞",
      start_offset: index,
      end_offset: index + 1,
      jlpt_level: level,
      frequency_band: "Unknown",
    })),
  };
}

describe("pageHasAnnotatableToken", () => {
  it("is false when the page only has easy/unknown tokens", () => {
    const blocks = [blockWithLevels(["N5", "Unknown", "N4"])];
    expect(pageHasAnnotatableToken(blocks, "N3")).toBe(false);
    expect(pageHasAnnotatableToken(blocks, "N1")).toBe(false);
  });

  it("detects a matching token for the selected level", () => {
    const blocks = [blockWithLevels(["N5", "N2"])];
    expect(pageHasAnnotatableToken(blocks, "N3")).toBe(true);
    expect(pageHasAnnotatableToken(blocks, "N2")).toBe(true);
    expect(pageHasAnnotatableToken(blocks, "N1")).toBe(false);
  });

  it("is false for an empty page", () => {
    expect(pageHasAnnotatableToken([], "N3")).toBe(false);
  });
});

describe("katakanaToHiragana", () => {
  it("converts katakana readings to hiragana", () => {
    expect(katakanaToHiragana("クル")).toBe("くる");
    expect(katakanaToHiragana("ショウ")).toBe("しょう");
    expect(katakanaToHiragana("ニホン")).toBe("にほん");
  });

  it("leaves the long-vowel mark, kanji and other characters untouched", () => {
    expect(katakanaToHiragana("コーヒー")).toBe("こーひー");
    expect(katakanaToHiragana("来る")).toBe("来る");
    expect(katakanaToHiragana("")).toBe("");
  });
});

describe("shouldShowFurigana", () => {
  it("is true for kanji-containing tokens that have a reading", () => {
    expect(shouldShowFurigana({ surface: "来る", reading: "クル" })).toBe(true);
    expect(shouldShowFurigana({ surface: "日本", reading: "ニホン" })).toBe(true);
  });

  it("is false without a reading or without kanji", () => {
    expect(shouldShowFurigana({ surface: "来る", reading: "" })).toBe(false);
    expect(shouldShowFurigana({ surface: "から", reading: "カラ" })).toBe(false);
    expect(shouldShowFurigana({ surface: "、", reading: "" })).toBe(false);
  });
});
