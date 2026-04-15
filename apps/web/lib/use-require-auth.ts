"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuthStore } from "./auth-store";

export function useRequireAuth() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionResolved = useAuthStore((state) => state.sessionResolved);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(sessionResolved);
  }, [sessionResolved]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  return {
    hydrated,
    isAuthorized: Boolean(user),
  };
}
