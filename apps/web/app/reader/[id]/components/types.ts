import type { ArticleToken } from "@yomuyomu/shared-types";

export interface SelectedTokenState {
  token: ArticleToken;
  blockId: string;
  blockText: string;
  x: number;
  y: number;
}

export interface SelectionMenuState {
  blockId: string;
  startOffsetInBlock: number;
  endOffsetInBlock: number;
  textQuote: string;
  x: number;
  y: number;
}

export interface SentenceContext {
  sentence: string;
  previousSentence: string;
  nextSentence: string;
}
