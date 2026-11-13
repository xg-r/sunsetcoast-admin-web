"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { roomLabel, roomTypeLabel } from "@/lib/format";
import type { Room } from "@/lib/types";

/** 외부 소유주 객실. 예약·매출을 볼 때 기본으로 빼 둔다 */
export const EXTERNAL_ROOM_NAMES = ["VILLA_2", "VILLA_3"];

export function defaultRoomSelection(rooms: Room[]): Set<number> {
  return new Set(rooms.filter((r) => !EXTERNAL_ROOM_NAMES.includes(r.name)).map((r) => r.id));
}

interface Group {
  key: string;
  label: string;
  rooms: Room[];
}

/**
 * 객실 다중 선택 필터. 버튼에 선택 요약을 보여주고, 누르면 유형(또는 업소)별 객실 칩이 열린다.
 */
export function RoomFilter({
  rooms,
  selected,
  onChange,
  defaultSelected,
  propertyNames,
}: {
  rooms: Room[];
  selected: Set<number>;
  onChange: (selected: Set<number>) => void;
  /** "기본값" 버튼으로 돌아갈 선택. 없으면 전체 */
  defaultSelected?: Set<number>;
  /** 여러 업소의 객실이면 업소별로 묶는다 */
  propertyNames?: Record<number, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = useMemo(() => groupRooms(rooms, propertyNames), [rooms, propertyNames]);
  const count = rooms.filter((r) => selected.has(r.id)).length;
  const excluded = rooms.filter((r) => !selected.has(r.id));
  const summary =
    count === rooms.length
      ? "전체 객실"
      : count === 0
        ? "선택한 객실 없음"
        : excluded.length <= 2
          ? `${excluded.map((r) => roomLabel(r.name)).join(", ")} 제외`
          : `객실 ${count}/${rooms.length}`;
  const isDefault = defaultSelected ? sameSet(selected, defaultSelected) : count === rooms.length;

  const set = (ids: number[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={!rooms.length}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
          isDefault ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "border-brand-500 bg-brand-50 font-medium text-brand-700"
        }`}
      >
        <svg className="h-4 w-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M3 5h18M6 12h12M10 19h4" strokeLinecap="round" />
        </svg>
        {summary}
        <svg className={`h-3.5 w-3.5 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              객실 <span className="font-normal text-slate-400">{count}/{rooms.length}</span>
            </p>
            <div className="flex gap-1 text-xs">
              {defaultSelected && !isDefault && <QuickButton onClick={() => onChange(new Set(defaultSelected))}>기본값</QuickButton>}
              <QuickButton onClick={() => set(rooms.map((r) => r.id), true)}>전체 선택</QuickButton>
              <QuickButton onClick={() => set(rooms.map((r) => r.id), false)}>전체 해제</QuickButton>
            </div>
          </div>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {groups.map((group) => {
              const ids = group.rooms.map((r) => r.id);
              const all = ids.every((id) => selected.has(id));
              return (
                <div key={group.key}>
                  <button type="button" onClick={() => set(ids, !all)} className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        all ? "border-brand-600 bg-brand-600 text-white" : ids.some((id) => selected.has(id)) ? "border-brand-600 bg-brand-100" : "border-slate-300"
                      }`}
                    >
                      {all && (
                        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} aria-hidden>
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {group.label}
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {group.rooms.map((room) => {
                      const on = selected.has(room.id);
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => set([room.id], !on)}
                          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                            on ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-200 text-slate-400 line-through hover:text-slate-600"
                          }`}
                        >
                          {roomLabel(room.name).replace(/^리조트 /, "")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
      {children}
    </button>
  );
}

function groupRooms(rooms: Room[], propertyNames?: Record<number, string>): Group[] {
  const byProperty = propertyNames && new Set(rooms.map((r) => r.propertyId)).size > 1;
  const groups = new Map<string, Group>();
  rooms.forEach((room) => {
    const key = byProperty ? `p${room.propertyId}` : room.type;
    const label = byProperty ? (propertyNames![room.propertyId] ?? `업소 ${room.propertyId}`) : (roomTypeLabel[room.type] ?? room.type);
    const group = groups.get(key) ?? { key, label, rooms: [] };
    group.rooms.push(room);
    groups.set(key, group);
  });
  return [...groups.values()];
}

function sameSet(a: Set<number>, b: Set<number>) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}
