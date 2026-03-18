import type {
  AIExplanationCreateRequest,
  AIExplanationHistoryItem,
  AIExplanationResponse,
  ArticleCreateRequest,
  ArticleDetail,
  ArticleSummary,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthTokenResponse,
  HealthResponse,
  HighlightCreateRequest,
  HighlightNoteUpdateRequest,
  HighlightResponse,
  LookupRequest,
  LookupResponse,
  ProductAnalyticsStatsResponse,
  TodayLearningStatsResponse,
  ReadingProgressResponse,
  ReaderLookupRequest,
  ReadingProgressUpsertRequest,
  UserProfile,
  VocabStatus,
  VocabItemCreateRequest,
  VocabItemResponse,
} from "@yomuyomu/shared-types";
import { requestBlob, requestJson, withNlpBase } from "./api-client";

export function register(input: AuthRegisterRequest): Promise<AuthTokenResponse> {
  return requestJson<AuthTokenResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function login(input: AuthLoginRequest): Promise<AuthTokenResponse> {
  return requestJson<AuthTokenResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export function getProfile(): Promise<UserProfile> {
  return requestJson<UserProfile>("/auth/me", { auth: true });
}

export function getApiHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health");
}

export function getNlpHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health", withNlpBase());
}

export function createArticle(input: ArticleCreateRequest): Promise<ArticleDetail> {
  return requestJson<ArticleDetail>("/articles", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function listArticles(): Promise<ArticleSummary[]> {
  return requestJson<ArticleSummary[]>("/articles", { auth: true });
}

export function getArticle(articleId: string): Promise<ArticleDetail> {
  return requestJson<ArticleDetail>(`/articles/${articleId}`, { auth: true });
}

export function deleteArticle(articleId: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/articles/${articleId}`, {
    method: "DELETE",
    auth: true,
  });
}

export function lookupWord(input: LookupRequest): Promise<LookupResponse> {
  return requestJson<LookupResponse>("/lookup", withNlpBase({
    method: "POST",
    body: input,
  }));
}

export function lookupWordInReader(input: ReaderLookupRequest): Promise<LookupResponse> {
  return requestJson<LookupResponse>("/reader-data/lookup", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function saveVocabFromReader(input: VocabItemCreateRequest): Promise<VocabItemResponse> {
  return requestJson<VocabItemResponse>("/reader-data/vocab", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function listVocab(bucket?: "today_new" | "unmastered"): Promise<VocabItemResponse[]> {
  const search = new URLSearchParams();
  if (bucket) {
    search.set("bucket", bucket);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return requestJson<VocabItemResponse[]>(`/vocab${suffix}`, { auth: true });
}

export function deleteVocab(vocabId: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/vocab/${vocabId}`, {
    method: "DELETE",
    auth: true,
  });
}

export function exportVocabCsv(): Promise<Blob> {
  return requestBlob("/vocab/export.csv", { auth: true });
}

export function exportVocabJson(): Promise<Blob> {
  return requestBlob("/vocab/export.json", { auth: true });
}

export function updateVocabStatus(vocabId: string, status: VocabStatus): Promise<VocabItemResponse> {
  return requestJson<VocabItemResponse>(`/vocab/${vocabId}/status`, {
    method: "PATCH",
    body: { status },
    auth: true,
  });
}

export function createHighlight(input: HighlightCreateRequest): Promise<HighlightResponse> {
  return requestJson<HighlightResponse>("/reader-data/highlights", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function listHighlights(articleId: string): Promise<HighlightResponse[]> {
  const search = new URLSearchParams({ article_id: articleId }).toString();
  return requestJson<HighlightResponse[]>(`/reader-data/highlights?${search}`, { auth: true });
}

export function updateHighlightNote(
  highlightId: string,
  input: HighlightNoteUpdateRequest
): Promise<HighlightResponse> {
  return requestJson<HighlightResponse>(`/reader-data/highlights/${highlightId}/note`, {
    method: "PATCH",
    body: input,
    auth: true,
  });
}

export function upsertReadingProgress(input: ReadingProgressUpsertRequest): Promise<ReadingProgressResponse> {
  return requestJson<ReadingProgressResponse>("/reader-data/progress", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function getReadingProgress(articleId: string): Promise<ReadingProgressResponse | null> {
  return requestJson<ReadingProgressResponse | null>(`/reader-data/progress/${articleId}`, { auth: true });
}

export function createAiExplanation(input: AIExplanationCreateRequest): Promise<AIExplanationResponse> {
  return requestJson<AIExplanationResponse>("/ai-explanations", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export function listAiExplanations(articleId: string): Promise<AIExplanationHistoryItem[]> {
  const search = new URLSearchParams({ article_id: articleId }).toString();
  return requestJson<AIExplanationHistoryItem[]>(`/ai-explanations?${search}`, { auth: true });
}

export function getProductAnalyticsStats(articleId?: string): Promise<ProductAnalyticsStatsResponse> {
  const search = new URLSearchParams();
  if (articleId) {
    search.set("article_id", articleId);
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return requestJson<ProductAnalyticsStatsResponse>(`/analytics/stats${suffix}`, { auth: true });
}

export function getTodayLearningStats(): Promise<TodayLearningStatsResponse> {
  return requestJson<TodayLearningStatsResponse>("/analytics/today", { auth: true });
}
