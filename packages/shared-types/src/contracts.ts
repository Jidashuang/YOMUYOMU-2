export type SourceType = "text" | "epub";
export type ArticleStatus = "processing" | "ready" | "failed";
export type VocabStatus = "new" | "learning" | "known";
export type VocabReviewResult = "fail" | "pass";

export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1" | "Unknown";

export type FrequencyBand = "top-1k" | "top-5k" | "top-10k" | "outside-10k" | "Unknown";

export type ServiceStatus = "ok" | "degraded";

export interface HealthResponse {
  service: string;
  status: ServiceStatus;
  version: string;
  dependencies?: Record<string, "ok" | "error">;
  timestamp: string;
}

export interface ErrorResponse {
  detail: string;
}

export interface AuthRegisterRequest {
  email: string;
  password: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: "bearer";
  user: {
    id: string;
    email: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export interface ArticleCreateRequest {
  title: string;
  source_type: SourceType;
  raw_content: string;
}

export interface ArticleSummary {
  id: string;
  title: string;
  source_type: SourceType;
  status: ArticleStatus;
  processing_error?: string | null;
  created_at: string;
}

export interface ArticleToken {
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  start_offset: number;
  end_offset: number;
  jlpt_level: JlptLevel;
  frequency_band: FrequencyBand;
}

export interface ArticleBlock {
  id: string;
  block_index: number;
  text: string;
  tokens: ArticleToken[];
}

export interface ArticleDetail extends ArticleSummary {
  raw_content: string;
  normalized_content: string;
  blocks: ArticleBlock[];
}

export interface VocabItemCreateRequest {
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  meaning_snapshot?: {
    meanings?: string[];
    [key: string]: unknown;
  } | null;
  jlpt_level: JlptLevel;
  frequency_band: FrequencyBand;
  source_article_id?: string | null;
  source_sentence?: string | null;
  status?: VocabStatus;
}

export interface VocabItemResponse {
  id: string;
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  meaning_snapshot?: {
    meanings?: string[];
    [key: string]: unknown;
  } | null;
  jlpt_level: JlptLevel;
  frequency_band: FrequencyBand;
  source_article_id?: string | null;
  source_sentence?: string | null;
  status: VocabStatus;
  next_review_at?: string | null;
  review_count: number;
  created_at: string;
}

export interface VocabReviewRequest {
  result: VocabReviewResult;
}

export interface HighlightCreateRequest {
  article_id: string;
  block_id: string;
  start_offset_in_block: number;
  end_offset_in_block: number;
  text_quote: string;
  note?: string | null;
}

export interface HighlightResponse {
  id: string;
  article_id: string;
  block_id?: string | null;
  start_offset_in_block?: number | null;
  end_offset_in_block?: number | null;
  text_quote: string;
  note?: string | null;
  created_at: string;
}

export interface HighlightNoteUpdateRequest {
  note: string;
}

export interface ReadingProgressUpsertRequest {
  article_id: string;
  progress_percent: number;
  last_position?: string | null;
}

export interface ReadingProgressResponse {
  id: string;
  article_id: string;
  progress_percent: number;
  last_position?: string | null;
  updated_at: string;
}

export interface GrammarPoint {
  name: string;
  explanation: string;
}

export interface TokenBreakdownItem {
  surface: string;
  lemma: string;
  reading: string;
  meaning: string;
  role: string;
}

export interface ExamplePair {
  jp: string;
  zh: string;
}

export interface AlternativeExpression {
  jp: string;
  zh: string;
  note: string;
}

export interface AIExplanationPayload {
  translation_zh: string;
  literal_translation: string;
  grammar_points: GrammarPoint[];
  token_breakdown: TokenBreakdownItem[];
  omissions: string[];
  nuance: string;
  examples: ExamplePair[];
  why_this_expression: string;
  alternative_expressions: AlternativeExpression[];
}

export interface TokenizedResultItem {
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  start: number;
  end: number;
}

export interface DictionaryHintItem {
  lemma: string;
  reading: string;
  pos: string[];
  meanings: string[];
  primary_meaning: string;
  example_sentence: string;
  usage_note: string;
  jlpt_level: string;
  frequency_band: string;
}

export interface SuggestedVocabItem {
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  meaning: string;
  jlpt_level: JlptLevel;
  frequency_band: FrequencyBand;
}

export interface AIExplanationCreateRequest {
  article_id: string;
  highlight_id?: string | null;
  sentence: string;
  previous_sentence: string;
  next_sentence: string;
  user_level: string;
}

export interface AIExplanationResponse {
  id: string;
  article_id: string;
  highlight_id?: string | null;
  sentence: string;
  model: string;
  provider: string;
  prompt_version: string;
  error_type?: string | null;
  provider_latency_ms?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  from_cache: boolean;
  response_json: AIExplanationPayload;
  tokenized_result: TokenizedResultItem[];
  dictionary_hints: DictionaryHintItem[];
  suggested_vocab: SuggestedVocabItem[];
  created_at: string;
}

export interface AIExplanationHistoryItem {
  id: string;
  article_id: string;
  highlight_id?: string | null;
  sentence: string;
  model: string;
  provider: string;
  prompt_version: string;
  error_type?: string | null;
  provider_latency_ms?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  from_cache: boolean;
  response_json: AIExplanationPayload;
  suggested_vocab: SuggestedVocabItem[];
  created_at: string;
}

export interface TokenInfo {
  surface: string;
  lemma: string;
  reading: string;
  pos: string;
  start: number;
  end: number;
  jlpt_level?: JlptLevel;
  frequency_band?: FrequencyBand;
}

export interface TokenizeRequest {
  text: string;
}

export interface TokenizeResponse {
  tokens: TokenInfo[];
}

export interface LookupRequest {
  surface: string;
  lemma: string;
  reading?: string;
  context?: string;
}

export interface ReaderLookupRequest extends LookupRequest {
  article_id: string;
}

export interface LookupEntry {
  lemma: string;
  reading: string;
  pos: string[];
  meanings: string[];
  primary_meaning: string;
  example_sentence: string;
  usage_note: string;
  jlpt_level: JlptLevel;
  frequency_band: FrequencyBand;
}

export interface LookupResponse {
  entries: LookupEntry[];
}

export type ProductEventName =
  | "article_created"
  | "article_processed"
  | "token_lookup"
  | "vocab_added"
  | "highlight_created"
  | "ai_explanation_requested"
  | "ai_explanation_succeeded"
  | "ai_explanation_failed";

export interface UsageCounts {
  lookup_count: number;
  vocab_added_count: number;
  highlight_count: number;
  ai_explanation_count: number;
}

export interface ArticleUsageStats {
  article_id: string;
  counts: UsageCounts;
  metrics: BusinessMetrics;
  raw_event_counts: Record<string, number>;
}

export interface BusinessMetrics {
  lookup_to_vocab_rate: number;
  highlight_to_ai_rate: number;
  ai_requests_per_article: number;
  ai_requests_per_user: number;
}

export interface ProductAnalyticsStatsResponse {
  user_id: string;
  article_id?: string | null;
  totals: UsageCounts;
  metrics: BusinessMetrics;
  raw_event_counts: Record<string, number>;
  by_article: ArticleUsageStats[];
}

export interface TodayLearningStatsResponse {
  date: string;
  lookup_count: number;
  vocab_added_count: number;
  ai_explanation_count: number;
}

export interface AnnotateRequest {
  text: string;
}

export interface AnnotatedToken extends TokenInfo {
  difficulty_source: "jlpt" | "frequency" | "unknown";
}

export interface AnnotateResponse {
  tokens: AnnotatedToken[];
}
