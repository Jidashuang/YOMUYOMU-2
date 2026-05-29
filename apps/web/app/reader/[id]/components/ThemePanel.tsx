"use client";

import { type ReaderTheme, useUISettingsStore } from "../../../../lib/ui-settings-store";

/**
 * Reading-theme panel: a small, fixed set of reading surfaces (white / paper / dark).
 * Reuses the shared ui-settings-store; providers.tsx maps readerTheme to
 * data-reader-theme (+ the dark class for "dark") and the CSS variables in globals.css.
 * Intentionally minimal — not a full theming system.
 *
 * Interaction idea inspired by Flow (AGPL-3.0); no source copied. See
 * docs/third-party-flow-reader-shell.md.
 */

const THEME_OPTIONS: Array<{ value: ReaderTheme; label: string; swatch: string; textOn: string }> = [
  { value: "white", label: "白色", swatch: "#ffffff", textOn: "#18181b" },
  { value: "paper", label: "纸色", swatch: "#f8f3e8", textOn: "#3a342b" },
  { value: "dark", label: "深色", swatch: "#18181b", textOn: "#e4e4e7" },
];

export function ThemePanel() {
  const readerTheme = useUISettingsStore((state) => state.readerTheme);
  const setReaderTheme = useUISettingsStore((state) => state.setReaderTheme);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">选择阅读背景，立即生效并记住你的偏好。</p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((option) => {
          const active = readerTheme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-testid={`reader-theme-${option.value}`}
              aria-pressed={active}
              onClick={() => setReaderTheme(option.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition ${
                active
                  ? "border-brand-500 ring-2 ring-brand-500/40"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <span
                className="grid h-10 w-full place-items-center rounded-md border border-black/10 text-sm font-medium"
                style={{ backgroundColor: option.swatch, color: option.textOn }}
              >
                あ
              </span>
              <span className="text-xs text-zinc-700 dark:text-zinc-200">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
