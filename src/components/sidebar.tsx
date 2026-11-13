"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { roleLabel, useAuth, useMe } from "@/lib/auth";
import { onUnmappedChanged } from "@/lib/events";
import type { UnmappedRow } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const groups = [
  {
    title: "정산",
    items: [
      { href: "/settlements/upload", label: "정산 파일 업로드", icon: UploadIcon },
      { href: "/settlements/coverage", label: "파일 현황", icon: GridIcon },
      { href: "/settlements/history", label: "업로드 내역", icon: ListIcon },
      { href: "/settlements/unmapped", label: "객실 지정", icon: LinkIcon, badge: "unmapped" as const },
    ],
  },
  {
    title: "운영",
    items: [
      { href: "/room-board", label: "객실 현황", icon: CubeIcon },
      { href: "/reservations", label: "예약 내역", icon: BedIcon, superAdminOnly: true },
      { href: "/management-fees", label: "현장 관리비", icon: WalletIcon, superAdminOnly: true },
      { href: "/stay-calendar", label: "성수기 달력", icon: CalendarIcon },
    ],
  },
  {
    title: "분석",
    items: [
      { href: "/channels", label: "판매 채널", icon: ChartIcon },
      { href: "/booking-lead", label: "예약 시점", icon: ClockIcon },
    ],
  },
  {
    title: "설정",
    items: [{ href: "/admin/users", label: "사용자 관리", icon: UsersIcon, superAdminOnly: true }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const me = useMe();
  const { logout } = useAuth();
  const isSuperAdmin = me?.role === "SUPER_ADMIN";
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => !("superAdminOnly" in item && item.superAdminOnly) || isSuperAdmin) }))
    .filter((group) => group.items.length);
  const { data: unmapped, reload } = useApi<UnmappedRow[]>("/settlements/unmapped-rows");
  useEffect(() => onUnmappedChanged(reload), [reload]);
  const badges = { unmapped: unmapped?.length ?? 0 };
  return (
    <aside className="flex flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-5 py-4 md:py-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-rose-500 text-sm font-bold text-white">S</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">선셋코스트</p>
          <p className="text-xs text-slate-500">관리자</p>
        </div>
        {me && (
          <div className="ml-auto flex items-center gap-2 md:hidden">
            <span className="text-xs text-slate-500">
              {me.nickname ?? "사용자"} · {roleLabel[me.role]}
            </span>
            <button type="button" onClick={() => void logout()} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
              로그아웃
            </button>
          </div>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-6 md:pb-0">
        {visibleGroups.map((group) => (
          <div key={group.title} className="flex shrink-0 gap-1 md:flex-col">
            <p className="hidden px-2 pb-1 text-xs font-medium text-slate-400 md:block">{group.title}</p>
            {group.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const badge = "badge" in item && item.badge ? badges[item.badge] : 0;
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={active ? "text-brand-600" : "text-slate-400"} />
                  {label}
                  {badge > 0 && <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {me && (
        <div className="hidden border-t border-slate-100 px-4 py-3 md:mt-auto md:block">
          <p className="truncate text-sm font-medium">{me.nickname ?? "사용자"}</p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">{roleLabel[me.role]}</span>
            <button type="button" onClick={() => void logout()} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              로그아웃
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      className={`h-4 w-4 ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
function UploadIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </Svg>
  );
}
function ListIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Svg>
  );
}
function WalletIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20M16 15h2" />
    </Svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}
function BedIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
    </Svg>
  );
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  );
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}
function CubeIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
    </Svg>
  );
}
function GridIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 17.5h7M17.5 14v7" />
    </Svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}
