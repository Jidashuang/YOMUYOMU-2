"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeMode = "light" | "dark";

interface UISettings {
  theme: ThemeMode;
  fontSize: number;
  lineHeight: number;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (fontSize: number) => void;
  setLineHeight: (lineHeight: number) => void;
}

export const useUISettingsStore = create<UISettings>()(
  persist(
    (set) => ({
      theme: "light",
      fontSize: 18,
      lineHeight: 1.9,
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
    }),
    { name: "yomuyomu-ui-settings" }
  )
);
