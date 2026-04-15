"use client";

import { useState } from "react";
import type {
  AIExplanationHistoryItem,
  AIExplanationResponse,
  SuggestedVocabItem,
} from "@yomuyomu/shared-types";

interface ExplanationPanelProps {
  latestAi: AIExplanationResponse | null;
  history?: AIExplanationHistoryItem[];
  addingSuggestedKey?: string | null;
  onAddSuggestedVocab?: (item: SuggestedVocabItem) => void;
}

export function ExplanationPanel({
  latestAi,
  history,
  addingSuggestedKey,
  onAddSuggestedVocab,
}: ExplanationPanelProps) {
  const [showMetadata, setShowMetadata] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const recentHistory = history?.filter((item) => item.id !== latestAi?.id) ?? [];

  return (
    <div
      data-testid="explanation-panel"
      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">AI 阅读助手</h3>
          <p className="mt-1 text-xs text-zinc-500">
            先看这句的核心解释，再按需展开模型元信息和历史记录。
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
          {latestAi ? "最新解析" : "等待解析"}
        </span>
      </div>

      {latestAi ? (
        <div
          data-testid="explanation-summary"
          className="mt-4 space-y-4 rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-700/60 dark:bg-brand-950/20"
        >
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              当前句子
            </p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{latestAi.sentence}</p>
            <p data-testid="explanation-translation" className="text-base font-semibold text-zinc-950 dark:text-white">
              {latestAi.response_json.translation_zh}
            </p>
            <p data-testid="explanation-why" className="text-sm text-zinc-600 dark:text-zinc-300">
              {latestAi.response_json.why_this_expression || "这句的表达重点会在语法点里补充。"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">语法重点</p>
              <ul
                data-testid="explanation-grammar-points"
                className="mt-2 space-y-2 text-xs text-zinc-700 dark:text-zinc-200"
              >
                {latestAi.response_json.grammar_points.map((point, index) => (
                  <li key={index}>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{point.name}</span>
                    <span className="text-zinc-500"> · </span>
                    {point.explanation}
                  </li>
                ))}
                {latestAi.response_json.grammar_points.length === 0 ? <li>暂无额外语法点。</li> : null}
              </ul>
            </div>

            <div className="rounded-xl border border-white/80 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">关键词</p>
              <div className="mt-2 space-y-2 text-xs" data-testid="suggested-vocab-list">
                {latestAi.suggested_vocab.map((item) => {
                  const key = `${item.lemma}:${item.pos}`;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 rounded-xl border border-zinc-200 px-2.5 py-2 dark:border-zinc-700"
                    >
                      <p>
                        <span className="font-semibold">{item.surface}</span>
                        <span className="text-zinc-500"> · </span>
                        {item.reading}
                        <span className="text-zinc-500"> · </span>
                        {item.meaning}
                      </p>
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1"
                        disabled={!onAddSuggestedVocab || addingSuggestedKey === key}
                        onClick={() => onAddSuggestedVocab?.(item)}
                      >
                        {addingSuggestedKey === key ? "加入中..." : "加入生词本"}
                      </button>
                    </div>
                  );
                })}
                {latestAi.suggested_vocab.length === 0 ? <p>暂无建议词条。</p> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              aria-expanded={showMetadata}
              onClick={() => setShowMetadata((current) => !current)}
            >
              {showMetadata ? "收起解释元信息" : "查看解释元信息"}
            </button>
          </div>

          {showMetadata ? (
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-xs text-zinc-500">
                provider={latestAi.provider} · model={latestAi.model} · prompt={latestAi.prompt_version} · {latestAi.from_cache ? "cache" : "fresh"}
                {latestAi.error_type ? ` · error=${latestAi.error_type}` : ""}
              </p>
              <p data-testid="explanation-literal" className="text-sm">
                <span className="font-medium">literal_translation:</span> {latestAi.response_json.literal_translation}
              </p>
              <div>
                <p className="font-medium text-sm">token_breakdown:</p>
                <div data-testid="explanation-token-breakdown" className="mt-1 space-y-1 text-xs">
                  {latestAi.response_json.token_breakdown.map((item, index) => (
                    <p key={index}>
                      {item.surface} ({item.reading}) → {item.meaning} [{item.role}]
                    </p>
                  ))}
                  {latestAi.response_json.token_breakdown.length === 0 ? <p>none</p> : null}
                </div>
              </div>
              <p data-testid="explanation-nuance" className="text-sm">
                <span className="font-medium">nuance:</span> {latestAi.response_json.nuance || "none"}
              </p>
              <div>
                <p className="font-medium text-sm">alternative_expressions:</p>
                <ul data-testid="explanation-alternatives" className="mt-1 list-disc space-y-1 pl-5 text-xs">
                  {latestAi.response_json.alternative_expressions.map((item, index) => (
                    <li key={index}>
                      {item.jp} → {item.zh} ({item.note})
                    </li>
                  ))}
                  {latestAi.response_json.alternative_expressions.length === 0 ? <li>none</li> : null}
                </ul>
              </div>
              <div>
                <p className="font-medium text-sm">examples:</p>
                <ul data-testid="explanation-examples" className="mt-1 list-disc space-y-1 pl-5 text-xs">
                  {latestAi.response_json.examples.map((example, index) => (
                    <li key={index}>{example.jp} → {example.zh}</li>
                  ))}
                  {latestAi.response_json.examples.length === 0 ? <li>none</li> : null}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          划线后点击“AI解释”，这里会先出现当前句子的学习摘要，再按需展开更详细的分析。
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">历史解释</p>
            <p className="mt-1 text-xs text-zinc-500">保留最近解析过的句子，默认收起，避免打断当前阅读。</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? "收起历史解释" : "展开历史解释"}
          </button>
        </div>

        {showHistory ? (
          <div className="mt-3 space-y-2">
            {recentHistory.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                <p className="font-medium">{item.sentence}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-300">{item.response_json.translation_zh}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  provider={item.provider} · model={item.model} · prompt={item.prompt_version} · {item.from_cache ? "cache" : "fresh"}
                  {item.error_type ? ` · error=${item.error_type}` : ""}
                </p>
              </div>
            ))}
            {recentHistory.length === 0 ? (
              <p className="text-sm text-zinc-500">还没有额外历史解释。</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type { ExplanationPanelProps };
