"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Segmented, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { notifyUnmappedChanged } from "@/lib/events";
import { formatDate, formatDateTime, formatWon, lineTypeLabel, platformLabel, roomLabel, roomTypeLabel } from "@/lib/format";
import type { Property, ResolveResult, Room, UnmappedRow } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useProperty } from "@/lib/use-property";

interface PropertyRooms {
  property: Property;
  rooms: Room[];
}

export default function UnmappedPage() {
  const { data, error, loading, reload } = useApi<UnmappedRow[]>("/settlements/unmapped-rows");
  const { properties } = useProperty();
  const catalog = useRoomCatalog(properties);
  const [done, setDone] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="객실 지정"
        description="객실을 찾지 못해 저장되지 않은 정산 행입니다. 객실을 고르면 원본 행을 다시 읽어 예약과 정산 금액에 반영합니다."
        actions={
          <Button onClick={reload} loading={loading && !!data}>
            새로고침
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {done && (
        <div className="mb-4">
          <Alert tone="blue">{done}</Alert>
        </div>
      )}

      {!data && loading ? (
        <Card>
          <EmptyState>
            <Spinner />
          </EmptyState>
        </Card>
      ) : data && data.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-3 font-medium">처리할 행이 없습니다</p>
            <p className="mt-1 text-sm text-slate-500">업로드한 정산 행이 모두 객실에 연결됐습니다.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.map((row) => (
            <UnmappedCard
              key={row.id}
              row={row}
              catalog={catalog}
              onResolved={(result, rooms) => {
                const extra = result.autoResolved > 0 ? ` 같은 객실명·예약번호의 다른 행 ${result.autoResolved}개도 함께 처리했습니다.` : "";
                setDone(`${row.reservationNumber ?? `${row.rowNo}행`}을 ${rooms}(으)로 반영했습니다.${extra}`);
                reload();
                notifyUnmappedChanged();
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

/** 업소별 객실 목록 */
function useRoomCatalog(properties: Property[]): PropertyRooms[] {
  const [catalog, setCatalog] = useState<PropertyRooms[]>([]);
  useEffect(() => {
    if (!properties.length) return;
    let cancelled = false;
    Promise.all(properties.map((p) => api.get<Room[]>(`/properties/${p.id}/rooms`).then((rooms) => ({ property: p, rooms }))))
      .then((result) => !cancelled && setCatalog(result))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [properties]);
  return catalog;
}

function UnmappedCard({
  row,
  catalog,
  onResolved,
}: {
  row: UnmappedRow;
  catalog: PropertyRooms[];
  onResolved: (result: ResolveResult, rooms: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>(row.suggestedRoomIds);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const multiInName = (row.roomName ?? "").includes(",");
  // 쉼표로 이어진 다중 객실 이름은 객실 하나의 별칭으로 저장하지 않는다
  const [saveAlias, setSaveAlias] = useState(!multiInName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomsById = useMemo(() => new Map(catalog.flatMap((c) => c.rooms.map((r) => [r.id, r] as const))), [catalog]);
  // 후보 객실이 있으면 그 업소를 먼저 보여준다
  const suggestedProperty = catalog.find((c) => c.rooms.some((r) => row.suggestedRoomIds.includes(r.id)))?.property.id;
  const shownProperty = propertyId ?? suggestedProperty ?? catalog[0]?.property.id ?? null;
  const shown = catalog.find((c) => c.property.id === shownProperty);

  const toggle = (id: number) => {
    setError(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<ResolveResult>(`/settlements/unmapped-rows/${row.id}/resolve`, {
        roomIds: selected,
        saveAlias: selected.length === 1 && saveAlias,
      });
      onResolved(result, selected.map((id) => roomLabel(roomsById.get(id)?.name ?? String(id))).join(", "));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
        <div className="flex min-w-0 items-center gap-2">
          <Badge>{platformLabel[row.platform]}</Badge>
          <span className="truncate" title={row.fileName}>
            {row.fileName}
          </span>
          <span className="shrink-0">· {row.rowNo}행</span>
        </div>
        <span>{formatDateTime(row.uploadedAt)} 업로드</span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500">파일에 적힌 객실명</p>
            <p className="mt-1 break-all rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{row.roomName ?? "-"}</p>
            {row.message && <p className="mt-1.5 text-xs text-amber-700">{row.message}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="예약번호" value={row.reservationNumber ?? "-"} />
            <Info label="예약자" value={row.bookerName ?? "-"} />
            <Info
              label={row.lineType === "CANCELLATION_FEE" ? "매출인식일" : "숙박"}
              value={
                row.stayDate ? `${formatDate(row.stayDate)}${row.nights ? ` · ${row.nights}박` : ""}` : "-"
              }
            />
            <Info label="구분" value={row.lineType ? lineTypeLabel[row.lineType] : "-"} />
            <Info label="매출" value={formatWon(row.grossAmount)} />
            <Info label="정산금액" value={<span className="font-semibold">{formatWon(row.netAmount)}</span>} />
          </dl>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              객실 선택
              <span className="ml-1.5 font-normal text-slate-400">{multiInName ? "여러 객실 예약이면 모두 고르세요" : "하나 이상"}</span>
            </p>
            {catalog.length > 1 && (
              <Segmented
                value={shownProperty}
                onChange={setPropertyId}
                options={catalog.map((c) => ({ value: c.property.id, label: c.property.code === "SUNSETCOAST_CAMPING" ? "선셋코스트" : "스테이디앤디" }))}
              />
            )}
          </div>

          {!shown ? (
            <div className="flex justify-center py-8 text-slate-400">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-3">
              {groupByType(shown.rooms).map(([type, rooms]) => (
                <div key={type}>
                  <p className="mb-1.5 text-xs text-slate-400">{roomTypeLabel[type] ?? type}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rooms.map((room) => {
                      const order = selected.indexOf(room.id);
                      const active = order >= 0;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => toggle(room.id)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                            active
                              ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {active && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{order + 1}</span>
                          )}
                          {roomLabel(room.name).replace(/^리조트 /, "")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            {selected.length === 0 ? (
              <span className="text-slate-400">객실을 골라 주세요.</span>
            ) : (
              <>
                <p>
                  <span className="text-slate-500">선택: </span>
                  <span className="font-medium">{selected.map((id) => roomLabel(roomsById.get(id)?.name ?? String(id))).join(", ")}</span>
                </p>
                {selected.length > 1 ? (
                  <p className="mt-1 text-xs text-slate-500">금액은 객실 정가 비율로 나눠 객실마다 저장하고(추정값), 관리비는 객실마다 붙습니다.</p>
                ) : multiInName ? (
                  <p className="mt-1 text-xs text-slate-500">파일에는 여러 객실이 적혀 있습니다. 실제로 한 객실 예약이 맞는지 확인해 주세요.</p>
                ) : (
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={saveAlias} onChange={(e) => setSaveAlias(e.target.checked)} className="accent-brand-600" />
                    다음 업로드부터 이 객실명을 자동으로 연결
                  </label>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="mt-3">
              <Alert>{error}</Alert>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="primary" disabled={selected.length === 0} loading={saving} onClick={submit}>
              반영
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function groupByType(rooms: Room[]): [string, Room[]][] {
  const groups = new Map<string, Room[]>();
  rooms.forEach((room) => groups.set(room.type, [...(groups.get(room.type) ?? []), room]));
  return [...groups.entries()];
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
