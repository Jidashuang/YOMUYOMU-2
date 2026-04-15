"use client";

interface ProgressBarProps {
  progressPercent: number;
  onProgressChange: (value: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function ProgressBar({ progressPercent, onProgressChange, onSave, isSaving }: ProgressBarProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
        <h3 className="font-semibold">阅读进度</h3>
          <p className="mt-1 text-xs text-zinc-500">滚动正文会自动更新；也可以手动拖动微调后保存。</p>
        </div>
        <span
          data-testid="reader-progress-current"
          className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {progressPercent.toFixed(0)}%
        </span>
      </div>
      <label className="mt-4 block text-sm">
        阅读进度: {progressPercent.toFixed(0)}%
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={progressPercent}
          className="mt-2 w-full"
          onChange={(event) => onProgressChange(Number(event.target.value))}
        />
      </label>
      <button
        type="button"
        className="mt-3 rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-700"
        onClick={onSave}
        disabled={isSaving}
      >
        {isSaving ? "保存中..." : "保存阅读进度"}
      </button>
    </div>
  );
}

export type { ProgressBarProps };
