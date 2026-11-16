"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Segmented, Spinner } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { AdminUser } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useToday } from "@/lib/use-month";

type EventType = "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "LOGOUT";
type TypeFilter = "ALL" | EventType;
type Period = 1 | 7 | 30 | 90 | 365;

interface LoginEvent {
  id: number;
  at: string;
  type: EventType;
  userId: number | null;
  provider: string | null;
  nickname: string | null;
  roles: string[];
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface LoginEventPage {
  items: LoginEvent[];
  page: number;
  size: number;
  totalCount: number;
  totalPages: number;
  todaySuccess: number;
  failuresLast7Days: number;
  retentionYears: number;
}

const PAGE_SIZE = 50;
const PROVIDER_LABEL: Record<string, string> = { NAVER: "네이버", KAKAO: "카카오", DEV: "개발용" };
const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "슈퍼어드민", SITE_MANAGER: "현장관리자", USER: "일반사용자" };
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-11-16T15:31:32" → { date: "11/16 (월)", time: "15:31:32" } */
function splitAt(at: string): { date: string; time: string } {
  const [day, time] = at.split("T");
  const d = new Date(`${day}T00:00:00`);
  return { date: `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY[d.getDay()]})`, time: time ?? "" };
}

/** 브라우저 정보(User-Agent)를 "Windows · Edge" 처럼 */
function deviceLabel(ua: string | null): string {
  if (!ua) return "알 수 없음";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Whale\//.test(ua)
      ? "웨일"
      : /SamsungBrowser\//.test(ua)
        ? "삼성 인터넷"
        : /KAKAOTALK/i.test(ua)
          ? "카카오톡"
          : /NAVER/.test(ua)
            ? "네이버 앱"
            : /Chrome\//.test(ua)
              ? "Chrome"
              : /Firefox\//.test(ua)
                ? "Firefox"
                : /Safari\//.test(ua)
                  ? "Safari"
                  : null;
  if (!os && !browser) return ua.split(/[\s/]/)[0] || "알 수 없음";
  return [os, browser].filter(Boolean).join(" · ");
}

function ipLabel(ip: string | null): string {
  if (!ip) return "-";
  if (ip === "0:0:0:0:0:0:0:1" || ip === "::1" || ip === "127.0.0.1") return "이 PC (서버와 같은 컴퓨터)";
  return ip;
}

export default function LoginEventsPage() {
  const today = useToday();
  const [period, setPeriod] = useState<Period>(7);
  const [type, setType] = useState<TypeFilter>("ALL");
  const [userId, setUserId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const { data: users } = useApi<AdminUser[]>("/admin/users");

  const from = today ? shiftDate(today, -(period - 1)) : null;
  const params = [
    from && `from=${from}`,
    today && `to=${today}`,
    type !== "ALL" && `type=${type}`,
    userId !== null && `userId=${userId}`,
    `page=${page}`,
    `size=${PAGE_SIZE}`,
  ].filter(Boolean);
  const { data, error, loading } = useApi<LoginEventPage>(today ? `/admin/login-events?${params.join("&")}` : null);

  const changeFilter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <>
      <PageHeader
        title="로그인 기록"
        description="누가 언제 관리자 화면에 로그인·로그아웃했는지, 실패한 시도까지 보여 줍니다. 기록은 자동으로 남고 누구도 고치거나 지울 수 없으며, 1년이 지나면 자동으로 지워집니다."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">오늘 로그인</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{data ? `${formatNumber(data.todaySuccess)}회` : "-"}</p>
        </Card>
        <Card className={`p-4 ${data && data.failuresLast7Days > 0 ? "border-rose-200 bg-rose-50" : ""}`}>
          <p className="text-xs font-medium text-slate-500">최근 7일 로그인 실패</p>
          <p className={`mt-1 text-2xl font-semibold ${data && data.failuresLast7Days > 0 ? "text-rose-700" : "text-slate-900"}`}>
            {data ? `${formatNumber(data.failuresLast7Days)}회` : "-"}
          </p>
          {data && data.failuresLast7Days > 0 && (
            <button type="button" className="mt-1 text-xs font-medium text-rose-700 hover:underline" onClick={() => { setPeriod(7); setType("LOGIN_FAILURE"); setPage(0); }}>
              실패만 보기 →
            </button>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">보관 기간</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{data ? `${data.retentionYears}년` : "-"}</p>
          <p className="mt-0.5 text-xs text-slate-500">지난 기록은 매일 새벽 자동 삭제</p>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented<Period>
          value={period}
          onChange={changeFilter(setPeriod)}
          options={[
            { value: 1, label: "오늘" },
            { value: 7, label: "7일" },
            { value: 30, label: "30일" },
            { value: 90, label: "90일" },
            { value: 365, label: "1년" },
          ]}
        />
        <Segmented<TypeFilter>
          value={type}
          onChange={changeFilter(setType)}
          options={[
            { value: "ALL", label: "전체" },
            { value: "LOGIN_SUCCESS", label: "로그인" },
            { value: "LOGIN_FAILURE", label: "실패" },
            { value: "LOGOUT", label: "로그아웃" },
          ]}
        />
        <select
          value={userId ?? ""}
          onChange={(e) => changeFilter(setUserId)(e.target.value ? Number(e.target.value) : null)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
          aria-label="사용자"
        >
          <option value="">모든 사용자</option>
          {(users ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nickname ?? "이름 없음"} ({PROVIDER_LABEL[u.provider] ?? u.provider})
            </option>
          ))}
        </select>
        {loading && data && <Spinner className="text-slate-400" />}
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card className="overflow-hidden">
        {!data && loading ? (
          <EmptyState>
            <Spinner />
          </EmptyState>
        ) : !data || data.items.length === 0 ? (
          <EmptyState>이 기간에 기록이 없습니다.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">시각</th>
                  <th className="px-4 py-2.5 font-medium">사용자</th>
                  <th className="px-4 py-2.5 font-medium">결과</th>
                  <th className="px-4 py-2.5 font-medium">기기</th>
                  <th className="px-4 py-2.5 font-medium">접속 위치 (IP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((e) => {
                  const { date, time } = splitAt(e.at);
                  const failed = e.type === "LOGIN_FAILURE";
                  return (
                    <tr key={e.id} className={failed ? "bg-rose-50" : ""}>
                      <td className={`whitespace-nowrap border-l-4 px-4 py-2.5 ${failed ? "border-l-rose-500" : "border-l-transparent"}`}>
                        <span className="font-medium text-slate-800">{date}</span> <span className="tabular-nums text-slate-500">{time}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">{e.nickname ?? (failed ? "알 수 없음" : "-")}</span>
                          {e.provider && <Badge>{PROVIDER_LABEL[e.provider] ?? e.provider}</Badge>}
                        </div>
                        {e.roles.length > 0 && <p className="mt-0.5 text-xs text-slate-400">{e.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        {e.type === "LOGIN_SUCCESS" && <Badge tone="green">✓ 로그인</Badge>}
                        {e.type === "LOGOUT" && <span className="text-slate-500">로그아웃</span>}
                        {failed && (
                          <div>
                            <span className="inline-flex items-center rounded-md bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white">실패</span>
                            {e.failureReason && <p className="mt-0.5 text-xs text-rose-800">{e.failureReason}</p>}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-700" title={e.userAgent ?? undefined}>
                        {deviceLabel(e.userAgent)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{ipLabel(e.ipAddress)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            {formatNumber(data.totalCount)}건 중 {formatNumber(data.page * data.size + 1)}–{formatNumber(Math.min((data.page + 1) * data.size, data.totalCount))}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ← 최근
            </Button>
            <Button size="sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>
              이전 기록 →
            </Button>
          </div>
        </div>
      )}
      {data && data.totalPages <= 1 && data.totalCount > 0 && <p className="mt-3 text-sm text-slate-500">{formatNumber(data.totalCount)}건</p>}
      <p className="mt-2 text-xs text-slate-400">기기 칸에 마우스를 올리면 브라우저 정보 원문이 보입니다. IP는 접속한 곳의 인터넷 주소입니다.</p>
    </>
  );
}
