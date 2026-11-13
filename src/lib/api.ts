// 백엔드 호출. next.config.ts의 rewrites가 /api/* 를 sunsetcoast-api로 넘긴다.
const API_VERSION = "1.0";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 오류 응답 본문 (409 겹치는 예약 목록 등) */
    readonly body?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Version", API_VERSION);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  // 스프링 시큐리티 CSRF: 쿠키(XSRF-TOKEN) 값을 헤더로 돌려보낸다
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const token = readCookie("XSRF-TOKEN");
    if (token) headers.set("X-XSRF-TOKEN", token);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. API 서버가 켜져 있는지 확인해 주세요.", 0);
  }
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (response.status === 401) notifyUnauthorized();
  if (!response.ok) {
    throw new ApiError(errorMessage(body) ?? fallbackMessage(response.status), response.status, body);
  }
  return body as T;
}

/** 백엔드 ErrorResponse { exception, message } 의 message */
function errorMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string" && body.message) {
    return body.message;
  }
  return null;
}

function fallbackMessage(status: number): string {
  return status >= 500 ? "서버 오류가 발생했습니다. API 서버가 켜져 있는지 확인해 주세요." : `요청이 실패했습니다 (${status})`;
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** 세션이 끝나면 (401) 로그인 상태를 다시 확인하게 한다 */
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}
function notifyUnauthorized() {
  unauthorizedListeners.forEach((l) => l());
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
