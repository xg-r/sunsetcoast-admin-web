"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, onUnauthorized } from "./api";
import type { Me, UserRole } from "./types";

export const roleLabel: Record<UserRole, string> = {
  SUPER_ADMIN: "슈퍼어드민",
  SITE_MANAGER: "현장관리자",
  USER: "일반사용자",
};

/** 슈퍼어드민만 들어갈 수 있는 화면 */
export const SUPER_ADMIN_PATHS = ["/management-fees", "/admin"];

export function canAccess(role: UserRole, pathname: string): boolean {
  if (role === "USER") return false;
  if (role === "SITE_MANAGER") return !SUPER_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  return true;
}

type AuthState = { status: "loading" } | { status: "anonymous" } | { status: "error"; message: string } | { status: "signed-in"; me: Me };

interface AuthContextValue {
  state: AuthState;
  reload: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Me>("/auth/me")
      .then((me) => !cancelled && setState({ status: "signed-in", me }))
      .catch((e: ApiError) => {
        if (cancelled) return;
        setState(e.status === 401 ? { status: "anonymous" } : { status: "error", message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // 다른 요청이 401을 받으면 (세션 만료) 로그인 상태를 다시 확인한다
  useEffect(() => onUnauthorized(() => setState({ status: "anonymous" })), []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setState({ status: "anonymous" });
    }
  }, []);

  return <AuthContext.Provider value={{ state, reload, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider 안에서만 쓸 수 있습니다.");
  return value;
}

/** 로그인한 사용자 (로그인 전이면 null) */
export function useMe(): Me | null {
  const { state } = useAuth();
  return state.status === "signed-in" ? state.me : null;
}
