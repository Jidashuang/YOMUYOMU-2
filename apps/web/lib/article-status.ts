import type { AnnotationStatus, ArticleStatus } from "@yomuyomu/shared-types";

// Minimal shape both ArticleSummary and ArticleDetail satisfy. status describes text
// readability; annotation_status describes difficulty-word colouring health.
export interface ArticleStatusView {
  status: ArticleStatus;
  annotation_status: AnnotationStatus;
  processed_block_count: number;
  total_block_count: number | null;
}

export type ArticleStatusTone = "ready" | "pending" | "error";

export function articleStatusLabel(article: ArticleStatusView): string {
  if (article.status === "failed") {
    return "处理失败";
  }
  if (article.status === "processing") {
    return article.total_block_count !== null
      ? `解析中 ${article.processed_block_count}/${article.total_block_count}`
      : "解析中";
  }
  // status === "ready": text is readable — surface annotation health instead.
  switch (article.annotation_status) {
    case "ready":
      return "已就绪";
    case "partial":
      return "正文可读 · 标注部分失败";
    case "failed":
      return "正文可读 · 标注失败";
    default:
      return article.total_block_count !== null
        ? `标注中 ${article.processed_block_count}/${article.total_block_count}`
        : "标注中";
  }
}

export function articleStatusTone(article: ArticleStatusView): ArticleStatusTone {
  if (article.status === "failed") {
    return "error";
  }
  if (article.status === "ready" && article.annotation_status === "ready") {
    return "ready";
  }
  return "pending";
}
