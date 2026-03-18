import type { AIExplanationHistoryItem, AIExplanationResponse, ArticleBlock, HighlightResponse, LookupEntry } from "@yomuyomu/shared-types";

import type { ExplanationPanelProps } from "./ExplanationPanel";
import type { HighlightMenuProps } from "./HighlightMenu";
import type { ProgressBarProps } from "./ProgressBar";
import type { ReaderArticleViewProps } from "./ReaderArticleView";
import type { TokenPopupProps } from "./TokenPopup";
import type { SelectedTokenState, SelectionMenuState } from "./types";

const dummyTokenState: SelectedTokenState = {
  token: {
    surface: "来る",
    lemma: "来る",
    reading: "くる",
    pos: "verb",
    start_offset: 0,
    end_offset: 2,
    jlpt_level: "N5",
    frequency_band: "top-1k",
  },
  blockId: "block-1",
  blockText: "彼は来るはずだったのに。",
  x: 100,
  y: 120,
};

const dummySelection: SelectionMenuState = {
  blockId: "block-1",
  startOffsetInBlock: 2,
  endOffsetInBlock: 4,
  textQuote: "来る",
  x: 100,
  y: 200,
};

const dummyLookupEntries: LookupEntry[] = [
  {
    lemma: "来る",
    reading: "くる",
    pos: ["verb"],
    meanings: ["to come"],
    primary_meaning: "to come",
    example_sentence: "彼は来るはずだったのに。",
    usage_note: "Common verb usage.",
    jlpt_level: "N5",
    frequency_band: "top-1k",
  },
];

const dummyBlocks: ArticleBlock[] = [
  {
    id: "block-1",
    block_index: 0,
    text: "彼は来る。",
    tokens: [dummyTokenState.token],
  },
];

const dummyHighlights = new Map<string, HighlightResponse[]>([
  [
    "block-1",
    [
      {
        id: "h-1",
        article_id: "a-1",
        block_id: "block-1",
        start_offset_in_block: 0,
        end_offset_in_block: 2,
        text_quote: "彼は",
        note: null,
        created_at: new Date().toISOString(),
      },
    ],
  ],
]);

const dummyLatestAi: AIExplanationResponse = {
  id: "ai-1",
  article_id: "a-1",
  highlight_id: null,
  sentence: "彼は来る。",
  model: "mock-v1",
  provider: "mock",
  prompt_version: "v2",
  error_type: null,
  from_cache: false,
  response_json: {
    translation_zh: "他会来。",
    literal_translation: "他 来。",
    grammar_points: [],
    token_breakdown: [],
    omissions: [],
    nuance: "",
    examples: [],
    why_this_expression: "",
    alternative_expressions: [],
  },
  tokenized_result: [],
  dictionary_hints: [],
  suggested_vocab: [],
  created_at: new Date().toISOString(),
};

const dummyHistory: AIExplanationHistoryItem[] = [dummyLatestAi];

const progressProps: ProgressBarProps = {
  progressPercent: 40,
  onProgressChange: () => undefined,
  onSave: () => undefined,
  isSaving: false,
};

const tokenPopupProps: TokenPopupProps = {
  selectedToken: dummyTokenState,
  lookupEntries: dummyLookupEntries,
  isLookupLoading: false,
  isSavingVocab: false,
  onClose: () => undefined,
  onAddToVocab: () => undefined,
};

const highlightMenuProps: HighlightMenuProps = {
  selectionMenu: dummySelection,
  isAiPending: false,
  aiError: null,
  onRequestAi: () => undefined,
  onFavorite: () => undefined,
  onCopy: () => undefined,
  onAddToVocab: () => undefined,
};

const explanationPanelProps: ExplanationPanelProps = {
  latestAi: dummyLatestAi,
  history: dummyHistory,
};

const readerArticleViewProps: ReaderArticleViewProps = {
  blocks: dummyBlocks,
  highlightsByBlock: dummyHighlights,
  onTokenSelect: () => undefined,
  onSelectionChange: () => undefined,
};

void progressProps;
void tokenPopupProps;
void highlightMenuProps;
void explanationPanelProps;
void readerArticleViewProps;
