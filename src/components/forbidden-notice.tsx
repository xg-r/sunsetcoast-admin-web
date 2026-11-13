"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { roleLabel } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

type Notice = { title: string; reason: string; next: string };

/** 화면별로 왜 막혔는지, 대신 무엇을 하면 되는지를 알려 준다 */
const notices: { path: string; notice: Notice }[] = [
  {
    path: "/management-fees",
    notice: {
      title: "현장 관리비는 본사에서 정산합니다",
      reason:
        "관리비 금액은 예약 건별로 본사가 계산하고 확정한 뒤 지급하는 정산 자료라서, 지급이 끝나기 전 수정이나 혼선을 막기 위해 슈퍼어드민(본사)만 열어 볼 수 있게 해 두었습니다.",
      next: "이번 달 지급 예정 금액이나 지급 내역이 궁금하시면 본사에 문의해 주세요. 객실별 투숙 일정은 '객실 현황'에서 확인할 수 있습니다.",
    },
  },
  {
    path: "/reservations",
    notice: {
      title: "예약 내역은 본사에서 관리합니다",
      reason:
        "예약 내역에는 고객 정보와 결제·정산 금액이 함께 들어 있고 전화 예약 입력·취소도 이 화면에서 하기 때문에, 슈퍼어드민(본사)만 열어 볼 수 있게 해 두었습니다.",
      next: "오늘 들어오는 손님이나 객실별 투숙 일정은 '객실 현황'에서 볼 수 있습니다. 전화 예약을 새로 받았거나 취소해야 하면 본사에 알려 주세요.",
    },
  },
  {
    path: "/admin",
    notice: {
      title: "사용자 관리는 본사 전용 화면입니다",
      reason: "직원 계정에 권한을 주거나 회수하는 화면이라 슈퍼어드민(본사)만 사용할 수 있습니다.",
      next: "새 직원의 권한이 필요하면 본사에 계정 정보를 전달해 요청해 주세요.",
    },
  },
];

const fallback: Notice = {
  title: "이 화면을 볼 권한이 없습니다",
  reason: "본사(슈퍼어드민) 전용 화면입니다.",
  next: "필요한 정보가 있으면 본사에 문의해 주세요.",
};

function noticeFor(pathname: string): Notice {
  return notices.find(({ path }) => pathname === path || pathname.startsWith(path + "/"))?.notice ?? fallback;
}

export function ForbiddenNotice({ pathname, role }: { pathname: string; role: UserRole }) {
  const { title, reason, next } = noticeFor(pathname);
  return (
    <div className="flex justify-center py-10 md:py-16">
      <Card className="w-full max-w-lg p-6 md:p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="mt-4 text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">현재 계정: {roleLabel[role]}</p>
        <p className="mt-4 text-sm leading-6 text-slate-600">{reason}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{next}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Link
            href="/room-board"
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            객실 현황 보기
          </Link>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            처음 화면으로
          </Link>
        </div>
      </Card>
    </div>
  );
}
