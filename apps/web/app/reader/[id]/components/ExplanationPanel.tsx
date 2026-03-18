"use client";

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
  return (
    <div data-testid="explanation-panel" className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-semibold">AI 解释历史</h3>
      {latestAi ? (
        <div className="mt-3 rounded-md border border-brand-200 p-3 dark:border-brand-700">
          <p className="text-xs text-zinc-500">
            最新解释 · provider={latestAi.provider} · model={latestAi.model} · prompt={latestAi.prompt_version} · {latestAi.from_cache ? "cache" : "fresh"}
            {latestAi.error_type ? ` · error=${latestAi.error_type}` : ""}
          </p>
          <p className="mt-1 text-sm font-medium">{latestAi.sentence}</p>
          <div className="mt-2 space-y-2 text-sm">
            <p data-testid="explanation-translation"><span className="font-medium">translation_zh:</span> {latestAi.response_json.translation_zh}</p>
            <p data-testid="explanation-literal"><span className="font-medium">literal_translation:</span> {latestAi.response_json.literal_translation}</p>
            <p data-testid="explanation-why"><span className="font-medium">why_this_expression:</span> {latestAi.response_json.why_this_expression || "none"}</p>
            <div>
              <p className="font-medium">grammar_points:</p>
              <ul data-testid="explanation-grammar-points" className="mt-1 list-disc space-y-1 pl-5 text-xs">
                {latestAi.response_json.grammar_points.map((point, index) => (
                  <li key={index}>
                    <span className="font-medium">{point.name}</span>: {point.explanation}
                  </li>
                ))}
                {latestAi.response_json.grammar_points.length === 0 ? <li>none</li> : null}
              </ul>
            </div>
            <div>
              <p className="font-medium">token_breakdown:</p>
              <div data-testid="explanation-token-breakdown" className="mt-1 space-y-1 text-xs">
                {latestAi.response_json.token_breakdown.map((item, index) => (
                  <p key={index}>
                    {item.surface} ({item.reading}) → {item.meaning} [{item.role}]
                  </p>
                ))}
                {latestAi.response_json.token_breakdown.length === 0 ? <p>none</p> : null}
              </div>
            </div>
            <p data-testid="explanation-nuance"><span className="font-medium">nuance:</span> {latestAi.response_json.nuance || "none"}</p>
            <div>
              <p className="font-medium">alternative_expressions:</p>
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
              <p className="font-medium">examples:</p>
              <ul data-testid="explanation-examples" className="mt-1 list-disc space-y-1 pl-5 text-xs">
                {latestAi.response_json.examples.map((example, index) => (
                  <li key={index}>{example.jp} → {example.zh}</li>
                ))}
                {latestAi.response_json.examples.length === 0 ? <li>none</li> : null}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">自动提取关键词（可一键加入生词本）</p>
            <div className="mt-2 space-y-2 text-xs" data-testid="suggested-vocab-list">
              {latestAi.suggested_vocab.map((item) => {
                const key = `${item.lemma}:${item.pos}`;
                return (
                  <div key={key} className="flex items-center justify-between gap-2 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                    <p>
                      <span className="font-medium">{item.surface}</span> · {item.reading} · {item.meaning}
                    </p>
                    <button
                      type="button"
                      className="rounded border px-2 py-1"
                      disabled={!onAddSuggestedVocab || addingSuggestedKey === key}
                      onClick={() => onAddSuggestedVocab?.(item)}
                    >
                      {addingSuggestedKey === key ? "加入中..." : "加入生词本"}
                    </button>
                  </div>
                );
              })}
              {latestAi.suggested_vocab.length === 0 ? <p>none</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {history?.map((item) => (
          <div key={item.id} className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700">
            <p className="font-medium">{item.sentence}</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-300">
              <span className="font-medium">translation_zh:</span> {item.response_json.translation_zh}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-medium">literal_translation:</span> {item.response_json.literal_translation}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              <span className="font-medium">why_this_expression:</span> {item.response_json.why_this_expression || "none"}
            </p>
            <div className="mt-1 text-xs text-zinc-500">
              <p className="font-medium">grammar_points:</p>
              <ul className="list-disc pl-5">
                {item.response_json.grammar_points.map((point, index) => (
                  <li key={index}>{point.name}: {point.explanation}</li>
                ))}
                {item.response_json.grammar_points.length === 0 ? <li>none</li> : null}
              </ul>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              <p className="font-medium">alternative_expressions:</p>
              <ul className="list-disc pl-5">
                {item.response_json.alternative_expressions.map((alt, index) => (
                  <li key={index}>{alt.jp} → {alt.zh}</li>
                ))}
                {item.response_json.alternative_expressions.length === 0 ? <li>none</li> : null}
              </ul>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              provider={item.provider} · model={item.model} · prompt={item.prompt_version} · {item.from_cache ? "cache" : "fresh"}
              {item.error_type ? ` · error=${item.error_type}` : ""}
            </p>
          </div>
        ))}
        {history && history.length === 0 ? (
          <p className="text-sm text-zinc-500">还没有 AI 解释记录。</p>
        ) : null}
      </div>
    </div>
  );
}

export type { ExplanationPanelProps };
