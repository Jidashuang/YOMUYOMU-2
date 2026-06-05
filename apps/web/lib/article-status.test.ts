import { describe, expect, it } from "vitest";

import { articleStatusLabel, articleStatusTone, type ArticleStatusView } from "./article-status";

function view(partial: Partial<ArticleStatusView>): ArticleStatusView {
  return {
    status: "ready",
    annotation_status: "ready",
    processed_block_count: 0,
    total_block_count: 10,
    ...partial,
  };
}

describe("articleStatusLabel", () => {
  it("shows parse failure", () => {
    expect(articleStatusLabel(view({ status: "failed" }))).toBe("处理失败");
  });

  it("shows parsing progress while the text is not yet readable", () => {
    expect(
      articleStatusLabel(view({ status: "processing", processed_block_count: 0, total_block_count: 5 }))
    ).toContain("解析中");
  });

  it("describes annotation health once the text is readable", () => {
    expect(articleStatusLabel(view({ annotation_status: "ready" }))).toBe("已就绪");
    expect(articleStatusLabel(view({ annotation_status: "partial" }))).toContain("部分失败");
    expect(articleStatusLabel(view({ annotation_status: "failed" }))).toContain("标注失败");
    expect(
      articleStatusLabel(view({ annotation_status: "processing", processed_block_count: 2, total_block_count: 5 }))
    ).toContain("标注中");
  });
});

describe("articleStatusTone", () => {
  it("maps each state to a tone bucket", () => {
    expect(articleStatusTone(view({ status: "failed" }))).toBe("error");
    expect(articleStatusTone(view({ status: "ready", annotation_status: "ready" }))).toBe("ready");
    expect(articleStatusTone(view({ status: "ready", annotation_status: "partial" }))).toBe("pending");
    expect(articleStatusTone(view({ status: "ready", annotation_status: "failed" }))).toBe("pending");
    expect(articleStatusTone(view({ status: "processing" }))).toBe("pending");
  });
});
