"use client";

import { useEffect, useMemo, useState } from "react";
import { propertyShortName } from "@/components/property-tabs";
import { EXTERNAL_ROOM_NAMES } from "@/components/room-filter";
import { Alert, Badge, Button, Segmented, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { addDays, formatDate, formatWon, paymentMethodLabel, platformLabel, roomLabel, roomTypeLabel } from "@/lib/format";
import type { DirectQuote, PaymentMethod, Property, ReservationConflict, ReservationDetail, Room } from "@/lib/types";

type Channel = "PHONE" | "WALK_IN" | "OTHER";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "PHONE", label: "전화" },
  { value: "WALK_IN", label: "현장" },
  { value: "OTHER", label: "기타" },
];

const priceKey = (roomId: number, date: string) => `${roomId}|${date}`;

/**
 * 직접 예약 입력·수정 폼. 객실과 날짜를 고르면 요금표·성수기·주말로 1박 금액을 채우고, 겹치는 예약을 보여준다.
 */
export function DirectReservationForm({
  properties,
  initialPropertyId,
  editing,
  onSaved,
  onCancel,
}: {
  properties: Property[];
  initialPropertyId: number | null;
  /** 수정할 예약 (없으면 새 예약) */
  editing?: ReservationDetail;
  onSaved: (detail: ReservationDetail) => void;
  onCancel: () => void;
}) {
  const r = editing?.reservation;
  const [pickedPropertyId, setPropertyId] = useState<number | null>(initialPropertyId);
  // 업소를 고르기 전에는 첫 업소 (업소 목록이 늦게 와도 따라간다)
  const propertyId = pickedPropertyId ?? properties[0]?.id ?? null;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomIds, setRoomIds] = useState<number[]>(r?.rooms.map((x) => x.id) ?? []);
  const [checkIn, setCheckIn] = useState(r?.checkInDate ?? "");
  const [nights, setNights] = useState(r?.nights ?? 1);
  const [bookerName, setBookerName] = useState(r?.bookerName ?? "");
  const [guestCount, setGuestCount] = useState(r?.guestCount ? String(r.guestCount) : "");
  const [channel, setChannel] = useState<Channel>(((r?.salesChannel as Channel) ?? "PHONE") as Channel);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((editing?.lines ?? []).filter((l) => l.lineType === "ROOM_NIGHT").map((l) => [priceKey(roomIdOf(editing!, l.roomName), l.stayDate), String(l.grossAmount)])),
  );
  // 직접 고친 금액은 요금표 제안으로 덮어쓰지 않는다 (수정 중인 예약의 금액도)
  const [touched, setTouched] = useState<Set<string>>(() => new Set(Object.keys(prices)));
  const [discount, setDiscount] = useState(editing ? String(editing.lines.reduce((s, l) => s + l.partnerDiscount, 0) || "") : "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(r?.paymentMethod ?? "BANK_TRANSFER");
  const [paid, setPaid] = useState(r?.paid ?? false);
  const [memo, setMemo] = useState(r?.memo ?? "");
  const [quote, setQuote] = useState<{ key: string; data: DirectQuote } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ReservationConflict[] | null>(null);

  // 수정할 때는 예약의 업소로 연다
  useEffect(() => {
    if (!r || !properties.length) return;
    let cancelled = false;
    Promise.all(properties.map((p) => api.get<Room[]>(`/properties/${p.id}/rooms`).then((list) => ({ p, list }))))
      .then((all) => {
        if (cancelled) return;
        const found = all.find(({ list }) => list.some((room) => room.id === r.roomId));
        if (found) setPropertyId(found.p.id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [r, properties]);

  useEffect(() => {
    if (propertyId === null) return;
    let cancelled = false;
    api
      .get<Room[]>(`/properties/${propertyId}/rooms`)
      .then((list) => !cancelled && setRooms(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const dates = useMemo(() => (checkIn && nights > 0 ? Array.from({ length: nights }, (_, i) => addDays(checkIn, i)) : []), [checkIn, nights]);
  const quoteKey = roomIds.length && dates.length ? `${roomIds.join(",")}|${checkIn}|${nights}` : null;

  // 객실·날짜가 바뀌면 금액 제안과 겹치는 예약을 다시 불러온다
  useEffect(() => {
    if (!quoteKey) return;
    let cancelled = false;
    const exclude = r ? `&excludeReservationId=${r.id}` : "";
    api
      .get<DirectQuote>(`/reservations/direct/quote?roomIds=${roomIds.join(",")}&checkIn=${checkIn}&nights=${nights}${exclude}`)
      .then((data) => {
        if (cancelled) return;
        setQuote({ key: quoteKey, data });
        setPrices((prev) => {
          const next = { ...prev };
          data.nights.forEach((n) =>
            roomIds.forEach((roomId) => {
              const key = priceKey(roomId, n.date);
              const suggested = n.prices[String(roomId)];
              if (!touched.has(key) && suggested != null) next[key] = String(suggested);
            }),
          );
          return next;
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // touched는 제안을 덮어쓸지 판단할 때만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const currentQuote = quote?.key === quoteKey ? quote.data : null;
  const subtotal = roomIds.reduce((sum, roomId) => sum + dates.reduce((s, d) => s + (Number(prices[priceKey(roomId, d)]) || 0), 0), 0);
  const discountValue = Number(discount.replaceAll(",", "")) || 0;
  const missingPrice = roomIds.some((roomId) => dates.some((d) => prices[priceKey(roomId, d)] === undefined || prices[priceKey(roomId, d)] === ""));
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const ownerPaid = roomIds.some((id) => EXTERNAL_ROOM_NAMES.includes(roomsById.get(id)?.name ?? ""));
  const valid = roomIds.length > 0 && dates.length > 0 && bookerName.trim() !== "" && !missingPrice && discountValue <= subtotal;

  const toggleRoom = (id: number) => setRoomIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fillSuggested = () => {
    if (!currentQuote) return;
    const next = { ...prices };
    currentQuote.nights.forEach((n) =>
      roomIds.forEach((roomId) => {
        const s = n.prices[String(roomId)];
        if (s != null) next[priceKey(roomId, n.date)] = String(s);
      }),
    );
    setPrices(next);
    setTouched(new Set());
  };

  const save = async (allowOverlap: boolean) => {
    setSaving(true);
    setError(null);
    const body = {
      roomIds,
      checkInDate: checkIn,
      nights,
      guestCount: guestCount ? Number(guestCount) : null,
      bookerName: bookerName.trim(),
      salesChannel: channel,
      nightlyPrices: roomIds.flatMap((roomId) => dates.map((date) => ({ roomId, date, amount: Number(prices[priceKey(roomId, date)]) }))),
      discount: discountValue,
      paymentMethod,
      paid,
      memo: memo.trim() || null,
      allowOverlap,
    };
    try {
      const detail = r
        ? await api.put<ReservationDetail>(`/reservations/direct/${r.id}`, body)
        : await api.post<ReservationDetail>("/reservations/direct", body);
      onSaved(detail);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const list = (e.body as { conflicts?: ReservationConflict[] })?.conflicts ?? [];
        setConflicts(list);
      } else {
        setError((e as Error).message);
      }
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-bold">{r ? "예약 수정" : "예약 입력"}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {r ? `${r.reservationNumber} · 직접 입력한 예약` : "전화·현장 예약처럼 플랫폼 파일에 나오지 않는 예약을 입력합니다."}
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <Section title="객실">
          {properties.length > 1 && (
            <div className="mb-3">
              <Segmented<number>
                value={propertyId}
                onChange={(id) => {
                  setPropertyId(id);
                  setRoomIds([]);
                }}
                options={properties.map((p) => ({ value: p.id, label: propertyShortName(p) }))}
              />
            </div>
          )}
          {!rooms.length ? (
            <Spinner className="text-slate-400" />
          ) : (
            <div className="space-y-2.5">
              {groupByType(rooms).map(([type, list]) => (
                <div key={type}>
                  <p className="mb-1 text-xs text-slate-400">{roomTypeLabel[type] ?? type}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((room) => {
                      const order = roomIds.indexOf(room.id);
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => toggleRoom(room.id)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                            order >= 0 ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {order >= 0 && roomIds.length > 1 && (
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
          {ownerPaid && (
            <p className="mt-2 text-xs text-slate-500">Villa II·III는 외부 소유주 객실이라 소유주 계좌로 입금되는 예약으로 저장됩니다 (매출 제외, 관리비 0원).</p>
          )}
        </Section>

        <Section title="숙박">
          <div className="grid grid-cols-2 gap-3">
            <Field label="입실일">
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} />
            </Field>
            <Field label="박수">
              <div className="flex items-center gap-1">
                <StepButton onClick={() => setNights(Math.max(1, nights - 1))}>−</StepButton>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={nights}
                  onChange={(e) => setNights(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
                  className={`${inputClass} text-center`}
                />
                <StepButton onClick={() => setNights(Math.min(90, nights + 1))}>+</StepButton>
              </div>
            </Field>
          </div>
          {checkIn && <p className="mt-2 text-sm text-slate-500">{`${formatDate(checkIn)} → ${formatDate(addDays(checkIn, nights))} 퇴실 · ${nights}박`}</p>}
        </Section>

        {currentQuote && currentQuote.conflicts.length > 0 && !conflicts && (
          <Alert tone="orange">
            <p className="font-semibold">같은 객실·날짜에 예약이 있습니다</p>
            <ConflictList conflicts={currentQuote.conflicts} />
          </Alert>
        )}

        {roomIds.length > 0 && dates.length > 0 && (
          <Section
            title="숙박 금액"
            action={
              currentQuote && (
                <button type="button" onClick={fillSuggested} className="text-xs font-medium text-brand-700 hover:underline">
                  요금표 금액으로 다시 채우기
                </button>
              )
            }
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="whitespace-nowrap bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">숙박일</th>
                    {roomIds.map((id) => (
                      <th key={id} className="px-3 py-2 text-right font-medium">
                        {roomLabel(roomsById.get(id)?.name ?? String(id))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dates.map((date) => {
                    const night = currentQuote?.nights.find((n) => n.date === date);
                    return (
                      <tr key={date}>
                        <td className="whitespace-nowrap px-3 py-2">
                          {formatDate(date)}
                          <span className="ml-1.5 inline-flex gap-1">
                            {night?.peak && <Badge tone="orange">성수기</Badge>}
                            {night?.weekend && <Badge tone="violet">주말</Badge>}
                          </span>
                        </td>
                        {roomIds.map((roomId) => {
                          const key = priceKey(roomId, date);
                          return (
                            <td key={roomId} className="px-2 py-1.5">
                              <input
                                inputMode="numeric"
                                value={prices[key] ?? ""}
                                placeholder={night ? "요금표 없음" : ""}
                                onChange={(e) => {
                                  setPrices({ ...prices, [key]: e.target.value.replace(/\D/g, "") });
                                  setTouched(new Set(touched).add(key));
                                }}
                                className="h-8 w-full min-w-24 rounded-md border border-slate-200 px-2 text-right focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">요금표·성수기 달력·주말(금·토, 공휴일 전날)로 채운 금액입니다. 실제 받은 금액으로 고치세요.</p>
          </Section>
        )}

        <Section title="예약자">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
            <Field label="이름">
              <input value={bookerName} onChange={(e) => setBookerName(e.target.value)} placeholder="홍길동" className={inputClass} />
            </Field>
            <Field label="인원">
              <input inputMode="numeric" value={guestCount} onChange={(e) => setGuestCount(e.target.value.replace(/\D/g, ""))} placeholder="명" className={inputClass} />
            </Field>
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-slate-500">예약 경로</p>
            <Segmented<Channel> value={channel} onChange={setChannel} options={CHANNELS} />
          </div>
        </Section>

        <Section title="결제">
          <div className="grid grid-cols-2 gap-3">
            <Field label="할인 (우리 부담)">
              <input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} placeholder="0" className={`${inputClass} text-right`} />
            </Field>
            <Field label="결제수단">
              <select value={paymentMethod ?? ""} onChange={(e) => setPaymentMethod((e.target.value || null) as PaymentMethod | null)} className={inputClass}>
                <option value="">선택 안 함</option>
                {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            입금 완료
          </label>
          <Field label="메모" className="mt-3">
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} maxLength={1000} placeholder="요청 사항, 연락 내용 등" className={`${inputClass} h-auto py-2`} />
          </Field>
        </Section>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
        <dl className="mb-3 space-y-1 text-sm">
          <Row label="숙박 금액" value={formatWon(subtotal)} />
          {discountValue > 0 && <Row label="할인" value={`- ${formatWon(discountValue)}`} />}
          <Row label={ownerPaid ? "결제 금액 (소유주 입금)" : "결제 금액"} value={formatWon(subtotal - discountValue)} strong />
        </dl>
        {discountValue > subtotal && <p className="mb-2 text-xs text-rose-600">할인이 숙박 금액보다 큽니다.</p>}
        {error && (
          <div className="mb-3">
            <Alert>{error}</Alert>
          </div>
        )}
        {conflicts && (
          <div className="mb-3">
            <Alert tone="orange">
              <p className="font-semibold">같은 객실·날짜에 예약이 있어 저장하지 않았습니다</p>
              <ConflictList conflicts={conflicts} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="primary" loading={saving} onClick={() => save(true)}>
                  겹쳐도 저장
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConflicts(null)}>
                  돌아가서 고치기
                </Button>
              </div>
            </Alert>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            닫기
          </Button>
          <Button variant="primary" disabled={!valid || !!conflicts} loading={saving && !conflicts} onClick={() => save(false)}>
            {r ? "수정 저장" : "예약 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConflictList({ conflicts }: { conflicts: ReservationConflict[] }) {
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {conflicts.map((c) => (
        <li key={`${c.reservationId}-${c.roomName}`}>
          {roomLabel(c.roomName)} · {formatDate(c.checkInDate)} ~ {formatDate(c.checkOutDate)} · {platformLabel[c.source]} {c.bookerName ?? ""} ({c.reservationNumber})
        </li>
      ))}
    </ul>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-10 w-10 shrink-0 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
      {children}
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-base font-bold" : "text-slate-500"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function groupByType(rooms: Room[]): [string, Room[]][] {
  const groups = new Map<string, Room[]>();
  rooms.forEach((room) => groups.set(room.type, [...(groups.get(room.type) ?? []), room]));
  return [...groups.entries()];
}

function roomIdOf(detail: ReservationDetail, roomName: string): number {
  return detail.reservation.rooms.find((room) => room.name === roomName)?.id ?? detail.reservation.roomId;
}
