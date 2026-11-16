"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { onNotificationsChanged } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import type { NotificationInbox, NotificationItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const POLL_MS = 30_000;

const levelStyle: Record<NotificationItem["level"], { dot: string; label: string }> = {
  ERROR: { dot: "bg-rose-500", label: "실패" },
  WARN: { dot: "bg-amber-500", label: "확인" },
  INFO: { dot: "bg-sky-500", label: "알림" },
};

/**
 * 사이드바 알림 (업로드 실패 등). 30초마다, 그리고 업로드 작업이 끝나면 다시 읽는다.
 * 새로 온 실패·확인 알림은 오른쪽 아래에 잠깐 띄운다.
 */
export function NotificationBell() {
  const router = useRouter();
  const { data, reload } = useApi<NotificationInbox>("/notifications");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const seen = useRef<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => onNotificationsChanged(reload), [reload]);
  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // 처음 읽은 것보다 새 알림이 오면 띄운다 (화면을 처음 열 때는 띄우지 않음)
  useEffect(() => {
    if (!data) return;
    const latest = data.items[0]?.id ?? 0;
    if (seen.current !== null && latest > seen.current) {
      const fresh = data.items.find((i) => i.id > (seen.current ?? 0) && !i.read && i.level !== "INFO");
      if (fresh) setToast(fresh);
    }
    seen.current = latest;
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openItem = async (item: NotificationItem) => {
    setOpen(false);
    setToast(null);
    if (!item.read) {
      await api.post(`/notifications/${item.id}/read`).catch(() => undefined);
      reload();
    }
    if (item.link) router.push(item.link);
  };

  const readAll = async () => {
    await api.post("/notifications/read-all").catch(() => undefined);
    reload();
  };

  const unread = data?.unreadCount ?? 0;
  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label={unread ? `알림 ${unread}개 읽지 않음` : "알림"}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold">알림</p>
            {unread > 0 && (
              <button type="button" onClick={() => void readAll()} className="text-xs text-slate-500 hover:text-slate-800">
                모두 읽음
              </button>
            )}
          </div>
          {data?.items.length ? (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {data.items.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => void openItem(item)} className={`w-full px-4 py-3 text-left hover:bg-slate-50 ${item.read ? "opacity-60" : ""}`}>
                    <p className="flex items-start gap-2 text-sm">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelStyle[item.level].dot}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="sr-only">{levelStyle[item.level].label}: </span>
                        <span className={item.read ? "text-slate-600" : "font-medium text-slate-800"}>{item.title}</span>
                        {item.message && <span className="mt-0.5 block text-xs text-slate-500">{item.message}</span>}
                        <span className="mt-1 block text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</span>
                      </span>
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-400">알림이 없습니다.</p>
          )}
        </div>
      )}

      {toast && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-rose-200 bg-white p-4 shadow-lg">
          <p className="flex items-start gap-2 text-sm">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${levelStyle[toast.level].dot}`} aria-hidden />
            <span className="min-w-0">
              <span className="font-semibold text-slate-800">{toast.title}</span>
              {toast.message && <span className="mt-1 block text-xs text-slate-600">{toast.message}</span>}
            </span>
          </p>
          <div className="mt-3 flex justify-end gap-2 text-xs">
            <button type="button" onClick={() => setToast(null)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">
              닫기
            </button>
            {toast.link && (
              <button type="button" onClick={() => void openItem(toast)} className="rounded-md bg-slate-800 px-2.5 py-1 font-medium text-white hover:bg-slate-700">
                확인하러 가기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
