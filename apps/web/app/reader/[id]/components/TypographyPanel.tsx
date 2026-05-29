"use client";

import {
  READER_FONT_SIZE_RANGE,
  READER_LINE_HEIGHT_RANGE,
  READER_MEASURE_RANGE,
  useUISettingsStore,
} from "../../../../lib/ui-settings-store";

/**
 * Typography panel for the reader workbench (font size / line height / content width).
 * Reuses the shared ui-settings-store (persisted to localStorage), which providers.tsx
 * applies to the --reader-font-size / --reader-line-height / --reader-measure CSS
 * variables consumed by .reader-text and .reader-measure. No backend persistence.
 *
 * Interaction idea inspired by Flow (AGPL-3.0); no source copied. See
 * docs/third-party-flow-reader-shell.md.
 */
export function TypographyPanel() {
  const fontSize = useUISettingsStore((state) => state.fontSize);
  const lineHeight = useUISettingsStore((state) => state.lineHeight);
  const measure = useUISettingsStore((state) => state.measure);
  const setFontSize = useUISettingsStore((state) => state.setFontSize);
  const setLineHeight = useUISettingsStore((state) => state.setLineHeight);
  const setMeasure = useUISettingsStore((state) => state.setMeasure);

  const reset = () => {
    setFontSize(18);
    setLineHeight(1.9);
    setMeasure(42);
  };

  return (
    <div className="space-y-5">
      <label className="block text-sm">
        <span className="flex items-center justify-between text-zinc-700 dark:text-zinc-200">
          <span>字号</span>
          <span className="tabular-nums text-zinc-500">{fontSize}px</span>
        </span>
        <input
          data-testid="reader-typography-font-size"
          className="mt-2 w-full accent-brand-500"
          type="range"
          min={READER_FONT_SIZE_RANGE.min}
          max={READER_FONT_SIZE_RANGE.max}
          step={READER_FONT_SIZE_RANGE.step}
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value))}
        />
      </label>

      <label className="block text-sm">
        <span className="flex items-center justify-between text-zinc-700 dark:text-zinc-200">
          <span>行高</span>
          <span className="tabular-nums text-zinc-500">{lineHeight.toFixed(1)}</span>
        </span>
        <input
          data-testid="reader-typography-line-height"
          className="mt-2 w-full accent-brand-500"
          type="range"
          min={READER_LINE_HEIGHT_RANGE.min}
          max={READER_LINE_HEIGHT_RANGE.max}
          step={READER_LINE_HEIGHT_RANGE.step}
          value={lineHeight}
          onChange={(event) => setLineHeight(Number(event.target.value))}
        />
      </label>

      <label className="block text-sm">
        <span className="flex items-center justify-between text-zinc-700 dark:text-zinc-200">
          <span>正文宽度</span>
          <span className="tabular-nums text-zinc-500">{measure}rem</span>
        </span>
        <input
          data-testid="reader-typography-measure"
          className="mt-2 w-full accent-brand-500"
          type="range"
          min={READER_MEASURE_RANGE.min}
          max={READER_MEASURE_RANGE.max}
          step={READER_MEASURE_RANGE.step}
          value={measure}
          onChange={(event) => setMeasure(Number(event.target.value))}
        />
      </label>

      <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <p className="text-[11px] uppercase tracking-wide text-zinc-400">预览</p>
        <p className="reader-text mt-1 text-zinc-800 dark:text-zinc-100">
          彼は来るはずだったのに。
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-stone-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        恢复默认排版
      </button>
    </div>
  );
}
