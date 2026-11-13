"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { propertyShortName } from "@/components/property-tabs";
import { STATUS_COLOR, type RoomCell, type RoomStatus } from "@/components/room-scene-3d";
import { Alert, Card, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { MonthPicker } from "@/components/month-picker";
import { addDays, formatDate, monthRange, roomLabel, roomTypeLabel, salesChannelLabel } from "@/lib/format";
import type { BusinessOwner, Reservation, Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth, useToday } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";
import { useReservations } from "@/lib/use-reservations";

const RoomScene3D = dynamic(() => import("@/components/room-scene-3d").then((m) => m.RoomScene3D), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-100 sm:h-[520px]" />,
});

const STATUS_LABEL: Record<RoomStatus, string> = {
  CHECK_IN: "오늘 입실",
  STAY: "연박 중",
  EMPTY: "빈 방",
};

interface RoomInfo extends RoomCell {
  /** 선택한 날 투숙 중인 예약 */
  current: Reservation | null;
  nightsInMonth: number;
}

export default function RoomBoardPage() {
  const { properties, error: propertyError } = useProperty();
  const { data: owners, error: ownersError } = useApi<BusinessOwner[]>("/business-owners");
  const [month, setMonth] = useMonth();
  const today = useToday();
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const { from, to } = month ? monthRange(month) : { from: "", to: "" };
  const daysInMonth = month ? Number(to.slice(8)) : 0;
  // 지난달에 입실해 이번 달까지 머무는 예약도 필요하다
  const range = month ? { from: addDays(from, -31), to } : null;
  const { data, loading, error } = useReservations(properties, range);

  const day = Math.min(pickedDay ?? (today && month && today.startsWith(month) ? Number(today.slice(8)) : 1), daysInMonth || 1);
  const date = month ? `${month}-${String(day).padStart(2, "0")}` : "";

  const rooms = useMemo(() => (owners ?? []).flatMap((o) => o.rooms).sort((a, b) => a.id - b.id), [owners]);
  const ownerName = useMemo(() => {
    const map = new Map<number, string>();
    (owners ?? []).forEach((o) => map.set(o.id, o.name));
    return map;
  }, [owners]);

  const infos = useMemo(() => buildInfos(rooms, data ?? [], date, from, to, daysInMonth), [rooms, data, date, from, to, daysInMonth]);
  const byRoom = useMemo(() => new Map(infos.map((i) => [i.room.id, i])), [infos]);
  const cells = useMemo<RoomCell[]>(() => infos.map(({ room, status, occupancy }) => ({ room, status, occupancy })), [infos]);
  const propertyNames = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, propertyShortName(p)])), [properties]);

  const visible = infos.filter((i) => focus === null || i.room.propertyId === focus);
  const occupiedToday = visible.filter((i) => i.status !== "EMPTY").length;
  const checkIns = visible.filter((i) => i.status === "CHECK_IN").length;
  const avgOccupancy = visible.length ? visible.reduce((s, i) => s + i.occupancy, 0) / visible.length : 0;
  const selected = selectedRoomId === null ? null : (byRoom.get(selectedRoomId) ?? null);

  const describe = (roomId: number) => {
    const info = byRoom.get(roomId);
    if (!info) return null;
    return <RoomSummary info={info} daysInMonth={daysInMonth} />;
  };

  return (
    <>
      <PageHeader
        title="객실 현황"
        description="객실마다 블록 하나입니다. 색은 고른 날의 투숙 상태, 높이는 그 달 가동률입니다. 드래그해서 돌리고, 블록을 누르면 상세가 나옵니다."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          options={[{ value: 0, label: "전체" }, ...properties.map((p) => ({ value: p.id, label: propertyShortName(p) }))]}
          value={focus ?? 0}
          onChange={(v) => setFocus(v === 0 ? null : v)}
        />
        <MonthPicker
          month={month}
          onChange={(m) => {
            setMonth(m);
            setPickedDay(null);
          }}
        />
        {loading && <Spinner className="text-slate-400" />}
      </div>

      {(propertyError || ownersError || error) && (
        <div className="mb-4">
          <Alert>{propertyError || ownersError || error}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${formatDate(date)} 투숙 객실`} value={`${occupiedToday} / ${visible.length}`} hint={visible.length ? `${Math.round((occupiedToday / visible.length) * 100)}%` : undefined} />
        <Stat label="이날 입실" value={`${checkIns}객실`} />
        <Stat label="이달 평균 가동률" value={`${Math.round(avgOccupancy * 100)}%`} hint="투숙한 박 수 ÷ 그 달 일수" />
        <Stat label="이달 판매 박수" value={`${visible.reduce((s, i) => s + i.nightsInMonth, 0)}박`} />
      </div>

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3">
          <DaySlider day={day} days={daysInMonth} month={month} onChange={setPickedDay} />
          <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            {(Object.keys(STATUS_LABEL) as RoomStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm ring-1 ring-black/5" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-slate-500">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 20V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              높이 = 이달 가동률
            </span>
          </div>
        </div>
        <div className="bg-gradient-to-b from-sky-50 via-white to-orange-50/40">
          {rooms.length ? (
            <RoomScene3D
              cells={cells}
              propertyOrder={properties.map((p) => p.id)}
              propertyNames={propertyNames}
              focusPropertyId={focus}
              selectedRoomId={selectedRoomId}
              onSelect={setSelectedRoomId}
              describe={describe}
            />
          ) : (
            <div className="h-[360px] animate-pulse sm:h-[520px]" />
          )}
        </div>
        {selected && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <RoomSummary info={selected} daysInMonth={daysInMonth} owner={ownerName.get(selected.room.businessOwnerId)} wide />
              <button type="button" onClick={() => setSelectedRoomId(null)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-200">
                닫기
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="px-4 pt-4 pb-2 text-left text-sm font-semibold">
            객실별 표 <span className="font-normal text-slate-400">· {formatDate(date)} 기준</span>
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 whitespace-nowrap">
              <th className="px-4 py-2 font-medium">업소</th>
              <th className="px-4 py-2 font-medium">객실</th>
              <th className="px-4 py-2 font-medium">상태</th>
              <th className="px-4 py-2 font-medium">예약</th>
              <th className="px-4 py-2 text-right font-medium">이달 가동률</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((info) => (
              <tr
                key={info.room.id}
                onClick={() => setSelectedRoomId(info.room.id)}
                className={`cursor-pointer border-b border-slate-100 whitespace-nowrap last:border-0 hover:bg-slate-50 ${selectedRoomId === info.room.id ? "bg-brand-50/50" : ""}`}
              >
                <td className="px-4 py-2 text-slate-500">{propertyNames[info.room.propertyId]}</td>
                <td className="px-4 py-2 font-medium">
                  {roomLabel(info.room.name)} <span className="text-xs font-normal text-slate-400">{roomTypeLabel[info.room.type]}</span>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-black/5" style={{ background: STATUS_COLOR[info.status] }} />
                    {STATUS_LABEL[info.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{info.current ? reservationLine(info.current) : <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 sm:block">
                      <span className="block h-full rounded-full bg-brand-500" style={{ width: `${info.occupancy * 100}%` }} />
                    </span>
                    <span className="w-16 tabular-nums">
                      {Math.round(info.occupancy * 100)}% <span className="text-xs text-slate-400">{info.nightsInMonth}박</span>
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function DaySlider({ day, days, month, onChange }: { day: number; days: number; month: string | null; onChange: (day: number) => void }) {
  const dow = month ? new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00`).getDay() : 0;
  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:max-w-md sm:flex-1">
      <button type="button" onClick={() => onChange(Math.max(1, day - 1))} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="전날">
        ‹
      </button>
      <input
        type="range"
        min={1}
        max={days || 1}
        value={day}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-brand-600"
        aria-label="날짜"
      />
      <button type="button" onClick={() => onChange(Math.min(days, day + 1))} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="다음날">
        ›
      </button>
      <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">
        {day}일 <span className={`text-xs font-medium ${dow === 0 ? "text-rose-500" : dow === 6 ? "text-sky-600" : "text-slate-400"}`}>{"일월화수목금토"[dow]}</span>
      </span>
    </div>
  );
}

function RoomSummary({ info, daysInMonth, owner, wide }: { info: RoomInfo; daysInMonth: number; owner?: string; wide?: boolean }) {
  const r = info.current;
  return (
    <div className={wide ? "grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2" : "space-y-1"}>
      <div>
        <p className="font-semibold">
          {roomLabel(info.room.name)} <span className="text-xs font-normal text-slate-400">{roomTypeLabel[info.room.type]}</span>
        </p>
        {owner && <p className="text-xs text-slate-500">사업자 {owner}</p>}
        <p className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[info.status] }} />
          {STATUS_LABEL[info.status]}
        </p>
        <p className="text-slate-500">
          이달 {info.nightsInMonth}/{daysInMonth}박 · 가동률 {Math.round(info.occupancy * 100)}%
        </p>
      </div>
      {r && (
        <div className="text-slate-600">
          <p>{reservationLine(r)}</p>
          <p className="text-slate-500">
            {formatDate(r.checkInDate)} → {formatDate(addDays(r.checkInDate!, r.nights ?? 1))} ({r.nights ?? 1}박)
          </p>
          <p className="text-xs text-slate-400">{r.reservationNumber}</p>
        </div>
      )}
    </div>
  );
}

function reservationLine(r: Reservation): string {
  return [r.bookerName, salesChannelLabel[r.salesChannel], r.rooms.length > 1 ? `${r.rooms.length}객실 예약` : null].filter(Boolean).join(" · ");
}

function buildInfos(rooms: Room[], reservations: Reservation[], date: string, from: string, to: string, daysInMonth: number): RoomInfo[] {
  const nights = new Map<number, Set<string>>();
  const current = new Map<number, { r: Reservation; checkIn: boolean }>();
  reservations.forEach((r) => {
    if (r.status !== "CONFIRMED" || !r.checkInDate) return;
    const n = r.nights ?? 1;
    for (let i = 0; i < n; i++) {
      const d = addDays(r.checkInDate, i);
      r.rooms.forEach((room) => {
        if (d >= from && d <= to) {
          const set = nights.get(room.id) ?? new Set<string>();
          set.add(d);
          nights.set(room.id, set);
        }
        if (d === date) current.set(room.id, { r, checkIn: i === 0 });
      });
    }
  });
  return rooms.map((room) => {
    const now = current.get(room.id);
    const n = nights.get(room.id)?.size ?? 0;
    return {
      room,
      status: now ? (now.checkIn ? "CHECK_IN" : "STAY") : "EMPTY",
      occupancy: daysInMonth ? n / daysInMonth : 0,
      current: now?.r ?? null,
      nightsInMonth: n,
    };
  });
}
