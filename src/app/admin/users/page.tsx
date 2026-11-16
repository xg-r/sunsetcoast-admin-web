"use client";

import { useState } from "react";
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { roleLabel, useAuth, useMe } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { AdminUser, UserRole } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const ROLES: UserRole[] = ["SUPER_ADMIN", "SITE_MANAGER", "USER"];
const PROVIDER_LABEL: Record<AdminUser["provider"], string> = { NAVER: "네이버", KAKAO: "카카오", DEV: "개발용" };

export default function UsersPage() {
  const me = useMe();
  const { reload: reloadMe } = useAuth();
  const { data, error, loading, reload } = useApi<AdminUser[]>("/admin/users");
  const [saving, setSaving] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "red" | "blue"; text: string } | null>(null);

  const change = async (user: AdminUser, role: UserRole) => {
    if (role === user.role) return;
    const self = user.id === me?.id;
    if (self && !confirm("내 역할을 바꾸면 이 화면을 더 이상 볼 수 없을 수 있습니다. 바꿀까요?")) return;
    setSaving(user.id);
    setNotice(null);
    try {
      await api.put(`/admin/users/${user.id}/role`, { role });
      setNotice({ tone: "blue", text: `${user.nickname ?? user.providerKey}님을 ${roleLabel[role]}(으)로 바꿨습니다.` });
      reload();
      if (self) reloadMe();
    } catch (e) {
      setNotice({ tone: "red", text: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };

  const pending = (data ?? []).filter((u) => u.role === "USER").length;

  return (
    <>
      <PageHeader
        title="사용자 관리"
        description="네이버·카카오로 처음 로그인하면 일반사용자로 가입됩니다. 본사 직원은 슈퍼어드민, 현장 관리자는 현장관리자로 바꿔 주세요. 바꾼 역할은 바로 적용됩니다."
      />

      {(error || notice) && (
        <div className="mb-4">
          <Alert tone={notice?.tone ?? "red"}>{notice?.text ?? error}</Alert>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <span>
          전체 {data?.length ?? 0}명 · 권한 대기(일반사용자) <span className={pending ? "font-semibold text-amber-700" : ""}>{pending}명</span>
        </span>
        {loading && <Spinner className="text-slate-400" />}
      </div>

      <Card className="overflow-x-auto">
        {data && !data.length ? (
          <EmptyState>아직 로그인한 사용자가 없습니다.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs whitespace-nowrap text-slate-500">
                <th className="px-4 py-2.5 font-medium">사용자</th>
                <th className="px-4 py-2.5 font-medium">계정</th>
                <th className="px-4 py-2.5 font-medium">가입</th>
                <th className="px-4 py-2.5 font-medium">마지막 로그인</th>
                <th className="px-4 py-2.5 font-medium">역할</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((user) => (
                <tr key={user.id} className="border-b border-slate-100 whitespace-nowrap last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{user.nickname ?? "(닉네임 없음)"}</span>
                    {user.id === me?.id && (
                      <span className="ml-1.5">
                        <Badge tone="blue">나</Badge>
                      </span>
                    )}
                    {user.email && <span className="block text-xs text-slate-400">{user.email}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {PROVIDER_LABEL[user.provider]} <span className="font-mono text-xs text-slate-400">{user.providerKey.split(":")[1]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDateTime(user.createdAt)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "-"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <select
                        value={user.role}
                        disabled={saving === user.id}
                        onChange={(e) => void change(user, e.target.value as UserRole)}
                        className={`h-8 rounded-lg border px-2 text-sm ${
                          user.role === "USER" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white"
                        }`}
                        aria-label={`${user.nickname ?? user.providerKey} 역할`}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel[role]}
                          </option>
                        ))}
                      </select>
                      {saving === user.id && <Spinner className="text-slate-400" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
