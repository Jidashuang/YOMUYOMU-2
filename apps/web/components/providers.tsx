"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useUISettingsStore } from "../lib/ui-settings-store";
import { UnauthorizedError } from "../lib/api-client";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error instanceof UnauthorizedError) {
                return false;
              }
              return failureCount < 2;
            },
          },
        },
      })
  );
  const { theme, fontSize, lineHeight, measure, readerTheme } = useUISettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    // The reader's "dark" theme also drives the global dark class so that the
    // chrome and the fixed token/highlight popups stay visually consistent.
    root.classList.toggle("dark", theme === "dark" || readerTheme === "dark");
    root.dataset.readerTheme = readerTheme;
    root.style.setProperty("--reader-font-size", `${fontSize}px`);
    root.style.setProperty("--reader-line-height", `${lineHeight}`);
    root.style.setProperty("--reader-measure", `${measure}rem`);
  }, [theme, fontSize, lineHeight, measure, readerTheme]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
