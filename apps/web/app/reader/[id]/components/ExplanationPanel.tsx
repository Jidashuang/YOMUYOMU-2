"use client";

import type {
  AIExplanationHistoryItem,
  AIExplanationResponse,
  SuggestedVocabItem,
} from "@yomuyomu/shared-types";

interface ExplanationPanelProps {
  latestAi: AIExplanationResponse | null;
  history?: AIExplanationHistoryItem[];
  isGenerating?: boolean;
  addingSuggestedKey?: string | null;
  savedKeys?: Set<string>;
  onAddSuggestedVocab?: (item: SuggestedVocabItem) => void;
}

function ProviderFooter({
  provider,
  model,
  promptVersion,
  fromCache,
  errorType,
}: {
  provider: string;
  model: string;
  promptVersion: string;
  fromCache: boolean;
  errorType?: string | null;
}) {
  return (
    <p className="mt-3 text-[11px] text-zinc-400">
      调试信息 · {provider} / {model} / prompt {promptVersion} / {fromCache ? "命中缓存" : "新生成"}
      {errorType ? ` / 错误：${errorType}` : ""}
    </p>
  );
}

export function ExplanationPanel({
  latestAi,
  history,
  isGenerating = false,
  addingSuggestedKey,
  savedKeys,
  onAddSuggestedVocab,
}: ExplanationPanelProps) {
  return (
    <div
      data-testid="explanation-panel"
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">AI 中文解释</h3>
        <p className="text-xs text-zinc-500">划句之后让 AI 用中文给你拆开这句</p>
      </div>

      {isGenerating ? (
        <div
          data-testid="explanation-loading"
          className="mt-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-100"
        >
          正在生成中文解释…
        </div>
      ) : null}

      {latestAi ? (
        <div className="mt-3 rounded-md border border-brand-200 p-3 dark:border-brand-700">
          <p className="text-xs text-zinc-500">原句</p>
          <p className="mt-1 text-sm font-medium">{latestAi.sentence}</p>

          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-zinc-500">中文翻译</p>
              <p data-testid="explanation-translation" className="mt-1 text-base font-medium">
                {latestAi.response_json.translation_zh || "（无）"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-500">逐字直译</p>
              <p data-testid="explanation-literal" className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {latestAi.response_json.literal_translation || "（无）"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-500">语法点</p>
              <ul
                data-testid="explanation-grammar-points"
                className="mt-1 list-disc space-y-1 pl-5 text-xs text-zinc-700 dark:text-zinc-300"
              >
                {latestAi.response_json.grammar_points.map((point, index) => (
                  <li key={index}>
                    <span className="font-medium">{point.name}</span>：{point.explanation}
                  </li>
                ))}
                {latestAi.response_json.grammar_points.length === 0 ? <li>（无）</li> : null}
              </ul>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-500">逐词拆解</p>
              <div
                data-testid="explanation-token-breakdown"
                className="mt-1 space-y-1 text-xs text-zinc-700 dark:text-zinc-300"
              >
                {latestAi.response_json.token_breakdown.map((item, index) => (
                  <p key={index}>
                    <span className="font-medium">{item.surface}</span>（{item.reading}）→ {item.meaning}
                    <span className="text-zinc-500"> · {item.role}</span>
                  </p>
                ))}
                {latestAi.response_json.token_breakdown.length === 0 ? <p>（无）</p> : null}
              </div>
            </div>

            {latestAi.response_json.nuance ? (
              <p data-testid="explanation-nuance" className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">语气与言外之意：</span>
                {latestAi.response_json.nuance}
              </p>
            ) : null}

            {latestAi.response_json.examples.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-zinc-500">参考例句</p>
                <ul
                  data-testid="explanation-examples"
                  className="mt-1 list-disc space-y-1 pl-5 text-xs text-zinc-700 dark:text-zinc-300"
                >
                  {latestAi.response_json.examples.map((example, index) => (
                    <li key={index}>
                      {example.jp} → {example.zh}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul data-testid="explanation-examples" className="hidden" aria-hidden="true" />
            )}
          </div>

          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">值得记住的词（一键加入生词本）</p>
              <p className="text-[11px] text-zinc-500">从这句里挑出来，背完就能再读到</p>
            </div>
            <div className="mt-2 space-y-2 text-xs" data-testid="suggested-vocab-list">
              {(latestAi.suggested_vocab ?? []).map((item) => {
                const key = `${item.lemma}:${item.pos}`;
                const alreadySaved = savedKeys?.has(key) ?? false;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <p>
                      <span className="font-medium">{item.surface}</span>
                      <span className="text-zinc-500"> · {item.reading}</span>
                      <span className="ml-2">{item.meaning}</span>
                    </p>
                    <button
                      type="button"
                      className="rounded bg-brand-500 px-2 py-1 text-white hover:bg-brand-700 disabled:opacity-60"
                      disabled={!onAddSuggestedVocab || addingSuggestedKey === key || alreadySaved}
                      onClick={() => onAddSuggestedVocab?.(item)}
                    >
                      {alreadySaved ? "已收录" : addingSuggestedKey === key ? "加入中..." : "加入生词本"}
                    </button>
                  </div>
                );
              })}
              {(latestAi.suggested_vocab ?? []).length === 0 ? <p>（无）</p> : null}
            </div>
          </div>

          <ProviderFooter
            provider={latestAi.provider}
            model={latestAi.model}
            promptVersion={latestAi.prompt_version}
            fromCache={latestAi.from_cache}
            errorType={latestAi.error_type}
          />
        </div>
      ) : !isGenerating ? (
        <p className="mt-3 text-sm text-zinc-500">
          还没有解释。在正文里划一句话，再点「让 AI 解释这句」。
        </p>
      ) : null}

      {history && history.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-zinc-500">历史解释</p>
          {history.map((item) => (
            <details
              key={item.id}
              className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700"
            >
              <summary className="cursor-pointer font-medium">{item.sentence}</summary>
              <div className="mt-2 space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                <p>
                  <span className="font-medium">中文翻译：</span>
                  {item.response_json.translation_zh}
                </p>
                <p>
                  <span className="font-medium">逐字直译：</span>
                  {item.response_json.literal_translation}
                </p>
                {item.response_json.grammar_points.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {item.response_json.grammar_points.map((point, index) => (
                      <li key={index}>
                        {point.name}：{point.explanation}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <ProviderFooter
                provider={item.provider}
                model={item.model}
                promptVersion={item.prompt_version}
                fromCache={item.from_cache}
                errorType={item.error_type}
              />
            </details>
          ))}
        </div>
      ) : null}

      {history && history.length === 0 && !latestAi ? (
        <p className="mt-3 text-xs text-zinc-500">尚未生成过 AI 解释。</p>
      ) : null}
    </div>
  );
}

export type { ExplanationPanelProps };
