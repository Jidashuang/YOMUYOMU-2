"use client";

interface ProgressBarProps {
  progressPercent: number;
  onProgressChange: (value: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function ProgressBar({ progressPercent, onProgressChange, onSave, isSaving }: ProgressBarProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="block text-sm">
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
