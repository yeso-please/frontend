import { useAuthStore } from "@/store/auth";

import { API_BASE_URL, REQUEST_TIMEOUT_MS, USE_MOCK } from "./config";
import { ApiError, NetworkError } from "./errors";
import { mockFetch } from "./mock/server";
import type { ApiErrorBody, AuthResponse } from "./types";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** false면 Authorization 헤더를 붙이지 않습니다 (공개 API) */
  auth?: boolean;
};

type RawResponse = { status: number; json: unknown };

const buildPath = (path: string, query?: RequestOptions["query"]) => {
  if (!query) return path;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${path}?${qs}` : path;
};

async function send(method: Method, path: string, body: unknown, token: string | null): Promise<RawResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  if (USE_MOCK) return mockFetch(method, path, body, headers);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // refresh_token 쿠키를 주고받기 위해 credentials: "include" (Android는 시스템 CookieManager에 저장)
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

const toError = (raw: RawResponse, path: string) => {
  const body = (raw.json ?? {}) as Partial<ApiErrorBody>;
  return new ApiError({
    status: raw.status,
    code: body.code ?? "COMMON_INTERNAL_ERROR",
    message: body.message ?? "잠시 후 다시 시도해 주세요.",
    path,
    fieldErrors: body.fieldErrors,
    details: body.details,
  });
};

// ── access token 재발급 (single-flight) ──
// 동시에 두 번 부르면 서버가 토큰 재사용으로 보고 세션 전체를 끊으므로 진행 중인 요청을 공유합니다.
let refreshing: Promise<AuthResponse> | null = null;

export function refreshSession(): Promise<AuthResponse> {
  refreshing ??= (async () => {
    const raw = await send("POST", "/auth/refresh", undefined, null);
    if (raw.status >= 400) throw toError(raw, "/auth/refresh");
    const res = raw.json as AuthResponse;
    useAuthStore.getState().setSession(res);
    return res;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function request<T>(method: Method, path: string, { body, query, auth = true }: RequestOptions = {}): Promise<T> {
  const fullPath = buildPath(path, query);
  const token = auth ? useAuthStore.getState().accessToken : null;
  let raw = await send(method, fullPath, body, token);

  // access token 만료 → refresh 한 번 후 원래 요청 재시도
  if (auth && raw.status === 401 && (raw.json as ApiErrorBody | null)?.code === "AUTH_UNAUTHENTICATED") {
    try {
      const refreshed = await refreshSession();
      raw = await send(method, fullPath, body, refreshed.accessToken);
    } catch (e) {
      useAuthStore.getState().signOut();
      throw e;
    }
  }

  if (raw.status >= 400) throw toError(raw, fullPath);
  return raw.json as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => request<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T = void>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, opts),
};
