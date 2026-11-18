import { describe, expect, it } from "vitest";

import { frequencyLabel, jlptLabel, posLabel } from "./lookup-labels";

describe("posLabel", () => {
  it("turns raw JMdict parts of speech into Chinese", () => {
    expect(posLabel(["noun (common) (futsuumeishi)"])).toBe("名词");
    expect(posLabel(["Godan verb with 'u' ending", "transitive verb"])).toBe("动词");
    expect(posLabel(["adjective (keiyoushi)"])).toBe("形容词");
    expect(posLabel(["adverb (fukushi)"])).toBe("副词");
  });

  it("maps Sudachi Japanese parts of speech", () => {
    expect(posLabel("名詞")).toBe("名词");
    expect(posLabel("助動詞")).toBe("助动词");
    expect(posLabel("動詞")).toBe("动词");
  });

  it("does not mistake adverb for verb", () => {
    expect(posLabel(["adverb taking the 'to' particle"])).toBe("副词");
  });

  it("keeps unknown values and handles empty input", () => {
    expect(posLabel(["something else"])).toBe("something else");
    expect(posLabel([])).toBe("—");
    expect(posLabel(undefined)).toBe("—");
  });
});

describe("jlptLabel / frequencyLabel", () => {
  it("shows friendly text instead of Unknown", () => {
    expect(jlptLabel("Unknown")).toBe("未分级");
    expect(jlptLabel("N1")).toBe("N1");
    expect(frequencyLabel("outside-10k")).toBe("较少见");
    expect(frequencyLabel("top-1k")).toBe("极常见");
    expect(frequencyLabel("Unknown")).toBe("未收录");
  });
});
