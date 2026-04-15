import type { ErrorResponse, ValidationErrorResponse } from "@yomuyomu/shared-types";

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

function getErrorMessage(body: ErrorResponse | ValidationErrorResponse | null, status: number): string {
  if (!body) {
    return `Request failed: ${status}`;
  }

  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item) => item?.msg?.trim())
      .filter((message): message is string => Boolean(message));
    if (messages.length > 0) {
      return messages.join("; ");
    }
  }

  return `Request failed: ${status}`;
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, auth = false, baseUrl = env.apiBaseUrl } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
  } catch {
    const webOrigin = typeof window !== "undefined" ? window.location.origin : "unknown";
    throw new Error(
      `无法连接到服务端。当前 API：${baseUrl}。当前 Web：${webOrigin}。请确认 API 已启动；如果你把 Web 跑在新的端口，请把当前 Web 地址加入 CORS 白名单。`
    );
  }

  if (auth && response.status === 401) {
    useAuthStore.getState().clearAuth();
    throw new UnauthorizedError("Session expired");
  }

  return response;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | ValidationErrorResponse | null;
    throw new Error(getErrorMessage(body, response.status));
  }
  return (await response.json()) as T;
}

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await request(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | ValidationErrorResponse | null;
    throw new Error(getErrorMessage(body, response.status));
  }
  return await response.blob();
}

export async function requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await request(path, options);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | ValidationErrorResponse | null;
    throw new Error(getErrorMessage(body, response.status));
  }
}
