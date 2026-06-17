"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AnnotationLevel } from "./reader-annotation";

type ThemeMode = "light" | "dark";
export type ReaderTheme = "white" | "paper" | "dark";

export const READER_FONT_SIZE_RANGE = { min: 14, max: 30, step: 1 } as const;
export const READER_LINE_HEIGHT_RANGE = { min: 1.2, max: 2.6, step: 0.1 } as const;
export const READER_MEASURE_RANGE = { min: 30, max: 84, step: 1 } as const;

interface UISettings {
  theme: ThemeMode;
  fontSize: number;
  lineHeight: number;
  /** Reading column width ("measure"), expressed in rem and applied via --reader-measure. */
  measure: number;
  /** Reading-surface theme used by the reader workbench. */
  readerTheme: ReaderTheme;
  /** Selected difficulty-annotation level; persisted so it survives reloads. */
  annotationLevel: AnnotationLevel;
  /** Whether inline furigana (ruby) is shown over kanji tokens. */
  furiganaVisible: boolean;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
  setMeasure: (measure: number) => void;
  setReaderTheme: (readerTheme: ReaderTheme) => void;
  setAnnotationLevel: (annotationLevel: AnnotationLevel) => void;
  setFuriganaVisible: (furiganaVisible: boolean) => void;
}

export const useUISettingsStore = create<UISettings>()(
  persist(
    (set) => ({
      theme: "light",
      fontSize: 18,
      lineHeight: 1.9,
      measure: 64,
      readerTheme: "paper",
      annotationLevel: "N3",
      furiganaVisible: false,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMeasure: (measure) => set({ measure }),
      setReaderTheme: (readerTheme) => set({ readerTheme }),
      setAnnotationLevel: (annotationLevel) => set({ annotationLevel }),
      setFuriganaVisible: (furiganaVisible) => set({ furiganaVisible }),
    }),
    {
      name: "yomuyomu-ui-settings",
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as UISettings;
        }
        const state = persistedState as Partial<UISettings>;
        return {
          ...state,
          measure: state.measure === undefined || state.measure === 42 ? 64 : state.measure,
        } as UISettings;
      },
    }
  )
);
