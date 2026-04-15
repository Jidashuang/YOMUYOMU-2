"use client";

import { create } from "zustand";

interface UserInfo {
  id: string;
  email: string;
}

interface AuthState {
  user: UserInfo | null;
  sessionResolved: boolean;
  setUser: (user: UserInfo) => void;
  markSessionResolved: () => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  sessionResolved: false,
  setUser: (user) => set({ user, sessionResolved: true }),
  markSessionResolved: () => set({ sessionResolved: true }),
  clearAuth: () => set({ user: null, sessionResolved: true }),
}));
