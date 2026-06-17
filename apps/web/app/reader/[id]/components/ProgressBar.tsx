"use client";

interface ProgressBarProps {
  progressPercent: number;
  isSaving?: boolean;
  saveMessage?: string | null;
  onSave?: () => void;
}

export function ProgressBar({ progressPercent, isSaving = false, saveMessage = null, onSave }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, progressPercent));
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          阅读进度：<span data-testid="reader-progress-percent">{pct.toFixed(0)}%</span>
        </span>
        <div className="flex items-center gap-2">
          {saveMessage ? (
            <span data-testid="reader-progress-status" className="text-zinc-500">
              {saveMessage}
            </span>
          ) : null}
          {onSave ? (
            <button
              type="button"
              data-testid="reader-save-progress"
              disabled={isSaving}
              onClick={onSave}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isSaving ? "保存中..." : "保存阅读进度"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export type { ProgressBarProps };
