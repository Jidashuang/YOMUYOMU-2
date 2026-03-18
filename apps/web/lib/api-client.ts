import { env } from "./env";
import { useAuthStore } from "./auth-store";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  baseUrl?: string;
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, auth = false, baseUrl = env.apiBaseUrl } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      throw new UnauthorizedError("Missing auth token");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    useAuthStore.getState().clearAuth();
    throw new UnauthorizedError("Session expired");
  }

  return response;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await request(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed: ${response.status}`);
  }
  return await response.blob();
}

export function withNlpBase(options: RequestOptions = {}): RequestOptions {
  return { ...options, baseUrl: env.nlpBaseUrl };
}
