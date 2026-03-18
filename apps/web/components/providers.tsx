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
  const { theme, fontSize, lineHeight } = useUISettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.setProperty("--reader-font-size", `${fontSize}px`);
    root.style.setProperty("--reader-line-height", `${lineHeight}`);
  }, [theme, fontSize, lineHeight]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
