"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

const noopSubscribe = () => () => {};

/** 로그인 실패로 돌아오면 ?error 가 붙는다 */
function useLoginError(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).has("error"),
    () => false,
  );
}

const DEV_ROLES: { role: UserRole; label: string }[] = [
  { role: "SUPER_ADMIN", label: "슈퍼어드민" },
  { role: "SITE_MANAGER", label: "현장관리자" },
  { role: "USER", label: "일반사용자" },
];

export default function LoginPage() {
  const router = useRouter();
  const { state, reload } = useAuth();
  const failed = useLoginError();
  const [devError, setDevError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "signed-in") router.replace("/");
  }, [state.status, router]);

  const devLogin = async (role: UserRole) => {
    setDevError(null);
    try {
      await api.post(`/auth/dev-login?role=${role}`);
      reload();
    } catch (e) {
      setDevError((e as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-orange-50 via-slate-50 to-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-rose-500 text-lg font-bold text-white shadow-lg shadow-orange-500/20">
            S
          </span>
          <h1 className="mt-4 text-xl font-bold">선셋코스트 관리자</h1>
          <p className="mt-1 text-sm text-slate-500">본사·현장 관리자 계정으로 로그인하세요.</p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {failed && <Alert>로그인하지 못했습니다. 다시 시도해 주세요.</Alert>}
          <a
            href="/oauth2/authorization/naver"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#03C75A] text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M13.56 10.7 6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z" />
            </svg>
            네이버로 로그인
          </a>
          <a
            href="/oauth2/authorization/kakao"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#FEE500] text-[15px] font-semibold text-black/85 transition-opacity hover:opacity-90"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3C6.48 3 2 6.48 2 10.78c0 2.76 1.84 5.18 4.62 6.56l-.94 3.44c-.08.3.26.54.52.37l4.1-2.72c.55.07 1.12.11 1.7.11 5.52 0 10-3.48 10-7.76S17.52 3 12 3z" />
            </svg>
            카카오 로그인
          </a>
          <p className="pt-1 text-center text-xs text-slate-400">처음 로그인하면 일반사용자로 가입되며, 본사에서 권한을 드려야 관리자 화면을 쓸 수 있습니다.</p>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4">
            <p className="mb-2 text-xs font-medium text-slate-500">개발용 로그인 (로컬에서만)</p>
            <div className="flex flex-wrap gap-2">
              {DEV_ROLES.map(({ role, label }) => (
                <Button key={role} size="sm" onClick={() => void devLogin(role)}>
                  {label}
                </Button>
              ))}
            </div>
            {devError && <p className="mt-2 text-xs text-rose-600">{devError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
