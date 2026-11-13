"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups = [
  {
    title: "정산",
    items: [
      { href: "/settlements/upload", label: "정산 파일 업로드", icon: UploadIcon },
      { href: "/settlements/history", label: "업로드 내역", icon: ListIcon },
    ],
  },
  {
    title: "운영",
    items: [
      { href: "/reservations", label: "예약 내역", icon: BedIcon },
      { href: "/management-fees", label: "현장 관리비", icon: WalletIcon },
      { href: "/stay-calendar", label: "성수기 달력", icon: CalendarIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-5 py-4 md:py-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-rose-500 text-sm font-bold text-white">
          S
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">선셋코스트</p>
          <p className="text-xs text-slate-500">관리자</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-6 md:pb-0">
        {groups.map((group) => (
          <div key={group.title} className="flex gap-1 md:flex-col">
            <p className="hidden px-2 pb-1 text-xs font-medium text-slate-400 md:block">{group.title}</p>
            {group.items.map(({ href, label, icon: Icon }) => {
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
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg className={`h-4 w-4 ${className ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
