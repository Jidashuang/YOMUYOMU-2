"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getProfile } from "../lib/api";
import { useUISettingsStore } from "../lib/ui-settings-store";
import { UnauthorizedError } from "../lib/api-client";
import { useAuthStore } from "../lib/auth-store";

function isExtensionOriginError(reason: unknown): boolean {
  if (reason instanceof Error) {
    const text = `${reason.message}\n${reason.stack ?? ""}`;
    return text.includes("Origin not allowed") || text.includes("chrome-extension://");
  }
  if (typeof reason === "string") {
    return reason.includes("Origin not allowed") || reason.includes("chrome-extension://");
  }
  return false;
}

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
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const markSessionResolved = useAuthStore((state) => state.markSessionResolved);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.setProperty("--reader-font-size", `${fontSize}px`);
    root.style.setProperty("--reader-line-height", `${lineHeight}`);
  }, [theme, fontSize, lineHeight]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isExtensionOriginError(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    let active = true;

    void getProfile()
      .then((profile) => {
        if (!active) {
          return;
        }
        setUser({ id: profile.id, email: profile.email });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          clearAuth();
          return;
        }
        clearAuth();
      })
      .finally(() => {
        if (active) {
          markSessionResolved();
        }
      });

    return () => {
      active = false;
    };
  }, [clearAuth, markSessionResolved, setUser]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
