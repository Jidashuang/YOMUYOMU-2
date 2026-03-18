"use client";

import { useUISettingsStore } from "../../lib/ui-settings-store";

export default function SettingsPage() {
  const { theme, fontSize, lineHeight, setTheme, setFontSize, setLineHeight } = useUISettingsStore();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Theme</h2>
        <div className="mt-3 flex gap-3">
          <button
            className={`rounded-md border px-4 py-2 ${theme === "light" ? "bg-zinc-100" : ""}`}
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={`rounded-md border px-4 py-2 ${theme === "dark" ? "bg-zinc-800 text-zinc-100" : ""}`}
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-medium">Reader Typography</h2>
        <label className="mt-3 block text-sm">
          字号: {fontSize}px
          <input
            className="mt-2 w-full"
            type="range"
            min={14}
            max={30}
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          />
        </label>

        <label className="mt-4 block text-sm">
          行高: {lineHeight.toFixed(1)}
          <input
            className="mt-2 w-full"
            type="range"
            min={1.2}
            max={2.6}
            step={0.1}
            value={lineHeight}
            onChange={(event) => setLineHeight(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
