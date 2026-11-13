"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Alert, Button, Card, Spinner } from "@/components/ui";
import { canAccess, roleLabel, useAuth } from "@/lib/auth";

/** 로그인 상태에 따라 화면 틀을 고른다. 로그인 화면은 틀 없이, 권한이 없으면 안내만 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (state.status === "anonymous" && !isLoginPage) router.replace("/login");
  }, [state.status, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (state.status === "loading" || state.status === "anonymous") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Spinner />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <Alert>{state.message}</Alert>
      </div>
    );
  }

  const { me } = state;
  if (me.role === "USER") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-lg font-bold">관리자 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-slate-600">
            {me.nickname ?? "사용자"}님은 {roleLabel[me.role]}로 가입되어 있습니다. 본사 슈퍼어드민에게 아래 계정 정보를 전달해 권한을 요청해 주세요.
          </p>
          <dl className="mt-4 space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">사용자 번호</dt>
              <dd className="font-medium">{me.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">계정</dt>
              <dd className="font-mono text-xs">{me.providerKey}</dd>
            </div>
          </dl>
          <div className="mt-5 flex justify-end">
            <Button onClick={() => void logout()}>로그아웃</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">
          {canAccess(me.role, pathname) ? (
            children
          ) : (
            <Card className="p-6">
              <h1 className="text-lg font-bold">이 화면을 볼 권한이 없습니다</h1>
              <p className="mt-2 text-sm text-slate-600">현장 관리비와 사용자 관리는 슈퍼어드민(본사)만 볼 수 있습니다.</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
