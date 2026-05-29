"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeMode = "light" | "dark";
export type ReaderTheme = "white" | "paper" | "dark";

export const READER_FONT_SIZE_RANGE = { min: 14, max: 30, step: 1 } as const;
export const READER_LINE_HEIGHT_RANGE = { min: 1.2, max: 2.6, step: 0.1 } as const;
export const READER_MEASURE_RANGE = { min: 30, max: 60, step: 1 } as const;

interface UISettings {
  theme: ThemeMode;
  fontSize: number;
  lineHeight: number;
  /** Reading column width ("measure"), expressed in rem and applied via --reader-measure. */
  measure: number;
  /** Reading-surface theme used by the reader workbench. */
  readerTheme: ReaderTheme;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setMeasure: (measure: number) => void;
  setReaderTheme: (readerTheme: ReaderTheme) => void;
}

export const useUISettingsStore = create<UISettings>()(
  persist(
    (set) => ({
      theme: "light",
      fontSize: 18,
      lineHeight: 1.9,
      measure: 42,
      readerTheme: "paper",
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMeasure: (measure) => set({ measure }),
      setReaderTheme: (readerTheme) => set({ readerTheme }),
    }),
    { name: "yomuyomu-ui-settings" }
  )
);
