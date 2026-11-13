"use client";

import { useMemo, useState } from "react";
import { propertyShortName } from "@/components/property-tabs";
import { EXTERNAL_ROOM_NAMES, RoomFilter } from "@/components/room-filter";
import { Segmented } from "@/components/ui";
import type { BusinessOwner, Property, Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export function ownerLabel(name: string): string {
  return name.replace(/\(주\)|㈜/g, "").trim();
}

/**
 * 업소 · 사업자 · 객실 필터 상태.
 * 업소와 사업자를 함께 고르면 둘 다 맞는 객실만 남는다 (선셋코스트 사업자의 객실은 두 업소에 걸쳐 있다).
 * 객실은 고르기 전에는 외부 소유주 객실(Villa II·III)을 뺀 전체. 남는 객실이 외부 소유주 객실뿐이면 그 객실들.
 */
export function useScope(properties: Property[]) {
  const { data: owners, error } = useApi<BusinessOwner[]>("/business-owners");
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<string, Set<number>>>({});

  const allRooms = useMemo(() => (owners ?? []).flatMap((o) => o.rooms).sort((a, b) => a.id - b.id), [owners]);
  const rooms = useMemo(
    () => allRooms.filter((r) => (propertyId === null || r.propertyId === propertyId) && (ownerId === null || r.businessOwnerId === ownerId)),
    [allRooms, propertyId, ownerId],
  );
  const defaultRooms = useMemo(() => {
    const ours = rooms.filter((r) => !EXTERNAL_ROOM_NAMES.includes(r.name));
    return new Set((ours.length ? ours : rooms).map((r) => r.id));
  }, [rooms]);
  const key = `${propertyId}|${ownerId}`;
  const selectedRooms = selections[key] ?? defaultRooms;
  /** 데이터를 불러올 업소 (고른 객실이 있는 업소만) */
  const scopeProperties = useMemo(
    () => properties.filter((p) => rooms.some((r) => r.propertyId === p.id)),
    [properties, rooms],
  );

  return {
    owners: owners ?? [],
    ownersError: error,
    properties,
    propertyId,
    setPropertyId,
    ownerId,
    setOwnerId,
    rooms,
    defaultRooms,
    selectedRooms,
    roomsCustomized: key in selections,
    setSelectedRooms: (next: Set<number>) => setSelections((prev) => ({ ...prev, [key]: next })),
    scopeProperties,
    ready: owners !== undefined,
  };
}

export type Scope = ReturnType<typeof useScope>;

export function ScopeFilters({ scope, roomFilter = true }: { scope: Scope; roomFilter?: boolean }) {
  const propertyNames = useMemo(() => Object.fromEntries(scope.properties.map((p) => [p.id, propertyShortName(p)])), [scope.properties]);
  // 업소를 고르면 그 업소에 객실이 있는 사업자만 보여준다
  const owners = scope.owners.filter((o) => scope.propertyId === null || o.rooms.some((r) => r.propertyId === scope.propertyId));

  return (
    <>
      <Segmented<number | "ALL">
        value={scope.propertyId ?? "ALL"}
        onChange={(v) => {
          const next = v === "ALL" ? null : v;
          scope.setPropertyId(next);
          const owner = scope.owners.find((o) => o.id === scope.ownerId);
          if (next !== null && owner && !owner.rooms.some((r) => r.propertyId === next)) scope.setOwnerId(null);
        }}
        options={[{ value: "ALL", label: "전체 업소" }, ...scope.properties.map((p) => ({ value: p.id, label: propertyShortName(p) }))]}
      />
      <div className="relative">
        <select
          value={scope.ownerId ?? ""}
          onChange={(e) => scope.setOwnerId(e.target.value ? Number(e.target.value) : null)}
          aria-label="사업자"
          className={`h-9 appearance-none rounded-lg border pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 ${
            scope.ownerId === null ? "border-slate-300 bg-white text-slate-700" : "border-brand-500 bg-brand-50 font-medium text-brand-700"
          }`}
        >
          <option value="">전체 사업자</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {ownerLabel(o.name)}
              {o.ownershipType === "EXTERNAL" ? " (외부 소유주)" : ""}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {roomFilter && (
        <RoomFilter
          rooms={scope.rooms}
          selected={scope.selectedRooms}
          defaultSelected={scope.defaultRooms}
          onChange={scope.setSelectedRooms}
          propertyNames={propertyNames}
        />
      )}
    </>
  );
}

/** 사업자 명의 객실이 어느 업소에 몇 개인지 ("명의 객실 26개 · 선셋코스트 14 · 스테이디앤디 12") */
export function scopeRoomsSummary(rooms: Room[], properties: Property[]): string {
  const counts = new Map<number, number>();
  rooms.forEach((r) => counts.set(r.propertyId, (counts.get(r.propertyId) ?? 0) + 1));
  const names = Object.fromEntries(properties.map((p) => [p.id, propertyShortName(p)]));
  return [...counts.entries()].map(([id, n]) => `${names[id] ?? id} ${n}`).join(" · ");
}
