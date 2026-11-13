"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DirectReservationForm } from "@/components/direct-reservation-form";
import { MonthPicker } from "@/components/month-picker";
import { ScopeFilters, useScope } from "@/components/scope-filters";
import { Alert, Badge, Button, Card, Drawer, EmptyState, PageHeader, SearchInput, Segmented, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import {
  addDays,
  feeBasisLabel,
  formatDate,
  formatDateTime,
  formatMonth,
  formatNumber,
  formatWon,
  lineTypeLabel,
  monthRange,
  paymentMethodLabel,
  platformLabel,
  roomLabel,
  roomsLabel,
  salesChannelLabel,
} from "@/lib/format";
import type { Platform, Reservation, ReservationDetail, SettlementLine } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";
import { useReservations } from "@/lib/use-reservations";

type StatusFilter = "ALL" | "CONFIRMED" | "CANCELLED" | "UNPAID";
type SortKey = "date" | "gross" | "net";
type FormState = { mode: "create" } | { mode: "edit"; detail: ReservationDetail } | null;

export default function ReservationsPage() {
  const { properties, error: propertyError } = useProperty();
  const scope = useScope(properties);
  const [month, setMonth] = useMonth();
  const [platform, setPlatform] = useState<"ALL" | Platform>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: false });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const range = month ? monthRange(month) : null;
  const { data, error, loading } = useReservations(scope.scopeProperties, range, refreshKey);
  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s/g, "");
    const filtered = all.filter(
      (r) =>
        r.rooms.some((room) => scope.selectedRooms.has(room.id)) &&
        (platform === "ALL" || r.source === platform) &&
        (status === "ALL" || (status === "UNPAID" ? r.source === "DIRECT" && r.status === "CONFIRMED" && !r.paid : r.status === status)) &&
        (!q ||
          [r.bookerName, r.reservationNumber, ...r.rooms.flatMap((room) => [room.name, roomLabel(room.name)])].some((v) => v?.toLowerCase().replace(/\s/g, "").includes(q))),
    );
    const value = (r: Reservation) => (sort.key === "gross" ? r.grossAmount : sort.key === "net" ? r.netAmount : (r.baseDate ?? ""));
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : a.id - b.id;
      return sort.desc ? -cmp : cmp;
    });
  }, [all, platform, status, query, sort, scope.selectedRooms]);

  const stats = useMemo(() => {
    const confirmed = rows.filter((r) => r.status === "CONFIRMED");
    // 외부 소유주 계좌로 직접 입금된 예약은 우리 매출이 아니다
    const ours = rows.filter((r) => r.paymentReceiver === "US");
    const gross = ours.reduce((s, r) => s + r.grossAmount, 0);
    const commission = ours.reduce((s, r) => s + r.commissionAmount, 0);
    return {
      count: rows.length,
      cancelled: rows.length - confirmed.length,
      nights: confirmed.reduce((s, r) => s + (r.nights ?? 0), 0),
      gross,
      net: ours.reduce((s, r) => s + r.netAmount, 0),
      ownerPaid: rows.length - ours.length,
      commissionRate: gross > 0 ? (commission / gross) * 100 : null,
    };
  }, [rows]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "date" }));
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const closeForm = useCallback(() => setForm(null), []);
  const changed = (message: string) => {
    setNotice(message);
    setRefreshKey((k) => k + 1);
  };
  const filtered = platform !== "ALL" || status !== "ALL" || query.trim() !== "" || scope.roomsCustomized;

  return (
    <>
      <PageHeader
        title="예약 내역"
        description="정산 파일로 들어온 예약과 직접 입력한 예약입니다. 입실일 기준이고, 입실일을 알 수 없는 취소 예약은 매출인식일 기준으로 보여줍니다."
        actions={
          <Button variant="primary" onClick={() => setForm({ mode: "create" })}>
            + 예약 입력
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ScopeFilters scope={scope} />
        <MonthPicker month={month} onChange={setMonth} />
        {loading && data && <Spinner className="text-slate-400" />}
      </div>

      {(propertyError || scope.ownersError || error) && (
        <div className="mb-4">
          <Alert>{propertyError || scope.ownersError || error}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="blue">{notice}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="예약" value={data ? `${formatNumber(stats.count)}건` : "-"} hint={data ? (stats.cancelled ? `취소 ${stats.cancelled}건 포함` : "취소 없음") : undefined} />
        <Stat label="판매 박수" value={data ? `${formatNumber(stats.nights)}박` : "-"} hint="취소 제외" />
        <Stat
          label="매출"
          value={data ? formatWon(stats.gross) : "-"}
          hint={stats.ownerPaid ? `소유주 입금 ${stats.ownerPaid}건 제외` : stats.commissionRate !== null ? `평균 수수료율 ${stats.commissionRate.toFixed(1)}%` : undefined}
        />
        <Stat label="정산금액 (입금)" value={data ? formatWon(stats.net) : "-"} hint="수수료·할인 차감 후" />
      </div>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Segmented<"ALL" | Platform>
            value={platform}
            onChange={setPlatform}
            options={[
              { value: "ALL", label: "전체" },
              { value: "DDNAYO", label: "떠나요" },
              { value: "YEOGI", label: "여기어때" },
              { value: "NOL", label: "NOL" },
              { value: "DIRECT", label: "직접 입력" },
            ]}
          />
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "모든 상태" },
              { value: "CONFIRMED", label: "투숙" },
              { value: "CANCELLED", label: "취소" },
              { value: "UNPAID", label: "미입금" },
            ]}
          />
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="예약자, 예약번호, 객실" />
      </div>

      <Card className="overflow-hidden">
        {!data && loading ? (
          <EmptyState>
            <Spinner />
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>{filtered ? "조건에 맞는 예약이 없습니다." : `${month ? formatMonth(month) : "이 달"} 예약이 없습니다.`}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <SortHeader label="입실" active={sort.key === "date"} desc={sort.desc} onClick={() => toggleSort("date")} />
                  <th className="px-4 py-2.5 font-medium">객실</th>
                  <th className="px-4 py-2.5 font-medium">예약자</th>
                  <th className="px-4 py-2.5 font-medium">채널</th>
                  <th className="px-4 py-2.5 font-medium">구분</th>
                  <SortHeader label="매출" align="right" active={sort.key === "gross"} desc={sort.desc} onClick={() => toggleSort("gross")} />
                  <SortHeader label="정산금액" align="right" active={sort.key === "net"} desc={sort.desc} onClick={() => toggleSort("net")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${selectedId === r.id ? "bg-brand-50/60" : ""} ${
                      r.status === "CANCELLED" ? "text-slate-400" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className={r.status === "CANCELLED" ? "" : "text-slate-900"}>{formatDate(r.baseDate)}</p>
                      <p className="text-xs text-slate-400">{r.checkInDate ? `${r.nights ?? "-"}박` : "매출인식일"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {roomsLabel(r.rooms)}
                      {r.rooms.length > 1 && <p className="text-xs font-normal text-slate-400">{r.rooms.length}객실</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap">{r.bookerName ?? "-"}</p>
                      <p className="text-xs text-slate-400">{r.reservationNumber}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ChannelLabel reservation={r} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.status === "CANCELLED" && <Badge tone="red">취소</Badge>}
                        {r.source === "DIRECT" && r.status === "CONFIRMED" && !r.paid && <Badge tone="orange">미입금</Badge>}
                        {r.paymentReceiver === "OWNER" && <Badge>소유주 입금</Badge>}
                        {r.peakSeason && <Badge tone="orange">성수기</Badge>}
                        {r.weekend && <Badge tone="violet">주말</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatWon(r.grossAmount)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${r.status === "CANCELLED" ? "" : "text-slate-900"}`}>{formatWon(r.netAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReservationDrawer
        id={selectedId}
        refreshKey={refreshKey}
        onClose={closeDrawer}
        onEdit={(detail) => setForm({ mode: "edit", detail })}
        onChanged={(message, removed) => {
          if (removed) setSelectedId(null);
          changed(message);
        }}
      />

      <Drawer open={form !== null} onClose={closeForm} wide>
        {form && (
          <DirectReservationForm
            key={form.mode === "edit" ? form.detail.reservation.id : "new"}
            properties={properties}
            initialPropertyId={scope.propertyId}
            editing={form.mode === "edit" ? form.detail : undefined}
            onCancel={closeForm}
            onSaved={(detail) => {
              setForm(null);
              setSelectedId(detail.reservation.id);
              changed(`${detail.reservation.reservationNumber} 예약을 ${form.mode === "edit" ? "수정" : "저장"}했습니다.`);
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function SortHeader({ label, active, desc, align, onClick }: { label: string; active: boolean; desc: boolean; align?: "right"; onClick: () => void }) {
  return (
    <th className={`px-4 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? "text-slate-800" : ""}`}>
        {label}
        <span className={`text-[10px] ${active ? "" : "opacity-0"}`}>{desc ? "▼" : "▲"}</span>
      </button>
    </th>
  );
}

function ChannelLabel({ reservation: r }: { reservation: Reservation }) {
  const channel = salesChannelLabel[r.salesChannel];
  const sameAsPlatform = channel === platformLabel[r.source] || r.salesChannel === "OTHER";
  return (
    <div className="flex items-center gap-1">
      <Badge>{platformLabel[r.source]}</Badge>
      {!sameAsPlatform && <span className="text-xs text-slate-500">· {channel}</span>}
    </div>
  );
}

function ReservationDrawer({
  id,
  refreshKey,
  onClose,
  onEdit,
  onChanged,
}: {
  id: number | null;
  refreshKey: number;
  onClose: () => void;
  onEdit: (detail: ReservationDetail) => void;
  onChanged: (message: string, removed?: boolean) => void;
}) {
  const { data, error, loading } = useApi<ReservationDetail>(id === null ? null : `/reservations/${id}`, refreshKey);
  const detail = data && data.reservation.id === id ? data : null;

  return (
    <Drawer open={id !== null} onClose={onClose}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        {detail ? <DrawerTitle reservation={detail.reservation} /> : <div className="h-12" />}
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="닫기">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && <Alert>{error}</Alert>}
        {!detail && loading && (
          <div className="flex justify-center py-16 text-slate-400">
            <Spinner />
          </div>
        )}
        {detail && <DrawerBody detail={detail} />}
      </div>
      {detail?.reservation.source === "DIRECT" && (
        <DirectActions key={detail.reservation.id} detail={detail} onEdit={() => onEdit(detail)} onChanged={onChanged} />
      )}
    </Drawer>
  );
}

/** 직접 입력한 예약의 수정·취소·삭제 */
function DirectActions({
  detail,
  onEdit,
  onChanged,
}: {
  detail: ReservationDetail;
  onEdit: () => void;
  onChanged: (message: string, removed?: boolean) => void;
}) {
  const r = detail.reservation;
  const [cancelling, setCancelling] = useState(false);
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>, message: string, removed?: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setCancelling(false);
      onChanged(message, removed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {cancelling ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">예약 취소</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">받은 취소수수료 (환불하지 않은 금액, 전액 환불이면 비워 두세요)</span>
            <input
              inputMode="numeric"
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelling(false)} disabled={busy}>
              돌아가기
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                run(() => api.post(`/reservations/direct/${r.id}/cancel`, { cancellationFee: Number(fee) || 0 }), `${r.reservationNumber} 예약을 취소했습니다.`)
              }
            >
              취소 처리
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`${r.reservationNumber} 예약을 삭제할까요?\n잘못 입력한 예약만 삭제하세요. 실제로 취소된 예약은 "예약 취소"를 쓰세요.`)) {
                run(() => api.delete(`/reservations/direct/${r.id}`), `${r.reservationNumber} 예약을 삭제했습니다.`, true);
              }
            }}
          >
            삭제
          </Button>
          <div className="flex gap-2">
            {r.status === "CONFIRMED" && (
              <Button onClick={() => setCancelling(true)} disabled={busy}>
                예약 취소
              </Button>
            )}
            {r.status === "CONFIRMED" && (
              <Button variant="primary" onClick={onEdit} disabled={busy}>
                수정
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerTitle({ reservation: r }: { reservation: Reservation }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{platformLabel[r.source]}</Badge>
        {r.status === "CANCELLED" ? <Badge tone="red">취소</Badge> : <Badge tone="green">투숙</Badge>}
        {r.peakSeason && <Badge tone="orange">성수기</Badge>}
        {r.weekend && <Badge tone="violet">주말</Badge>}
        {r.rooms.length > 1 && <Badge tone="blue">{r.rooms.length}객실</Badge>}
      </div>
      <h2 className="mt-2 text-xl font-bold">
        {roomsLabel(r.rooms)} <span className="font-normal text-slate-400">·</span> {r.bookerName ?? "예약자 없음"}
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">
        {r.checkInDate && r.nights
          ? `${formatDate(r.checkInDate)} → ${formatDate(addDays(r.checkInDate, r.nights))} · ${r.nights}박`
          : "입실일 정보 없음 (취소수수료만 있는 예약)"}
      </p>
    </div>
  );
}

function DrawerBody({ detail }: { detail: ReservationDetail }) {
  const r = detail.reservation;
  const partnerDiscount = detail.lines.reduce((s, l) => s + l.partnerDiscount, 0);
  const platformDiscount = detail.lines.reduce((s, l) => s + l.platformDiscount, 0);
  const otherFee = detail.lines.reduce((s, l) => s + l.otherFee, 0);
  const multiRoom = r.rooms.length > 1;

  return (
    <div className="space-y-6">
      <section>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Info label="예약번호" value={<span className="break-all">{r.reservationNumber}</span>} />
          <Info label="예약 일시" value={reservedAtLabel(r)} />
          <Info label="예약 채널" value={r.salesChannelRaw ?? salesChannelLabel[r.salesChannel]} />
          {r.source === "DIRECT" && (
            <>
              <Info label="인원" value={r.guestCount ? `${r.guestCount}명` : "-"} />
              <Info label="결제" value={`${r.paymentMethod ? paymentMethodLabel[r.paymentMethod] : "결제수단 미입력"} · ${r.paid ? "입금 완료" : "미입금"}`} />
            </>
          )}
          {r.paymentReceiver === "OWNER" && <Info label="입금" value="외부 소유주 계좌 (매출 제외)" />}
          {r.memo && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">메모</dt>
              <dd className="mt-0.5 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2">{r.memo}</dd>
            </div>
          )}
          <Info label="정산 플랫폼" value={platformLabel[r.source]} />
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">금액</h3>
        <div className="rounded-xl border border-slate-200">
          <AmountRow label="매출" value={formatWon(r.grossAmount)} />
          {partnerDiscount !== 0 && <AmountRow label="우리 부담 할인" value={`- ${formatWon(partnerDiscount)}`} muted />}
          <AmountRow label="수수료" value={`- ${formatWon(r.commissionAmount)}`} muted />
          {otherFee !== 0 && <AmountRow label="기타 비용" value={`- ${formatWon(otherFee)}`} muted />}
          <AmountRow label="정산금액 (입금)" value={formatWon(r.netAmount)} strong />
        </div>
        {platformDiscount !== 0 && (
          <p className="mt-1.5 text-xs text-slate-400">플랫폼 부담 할인 {formatWon(platformDiscount)}은 플랫폼이 내므로 정산금액에서 빠지지 않습니다.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">현장 관리비</h3>
          <Link href="/management-fees" className="text-xs font-medium text-brand-700 hover:underline">
            관리비 화면에서 수정
          </Link>
        </div>
        {detail.managementFees.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {detail.managementFees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {multiRoom && <span className="font-medium">{roomLabel(fee.roomName)}</span>}
                  <Badge tone={fee.basis === "CHARGED" ? "green" : fee.basis === "NO_RATE" ? "orange" : "gray"}>{feeBasisLabel[fee.basis]}</Badge>
                  {fee.overrideAmount !== null && <span className="text-xs text-slate-500">수정됨 · {fee.overrideReason}</span>}
                </div>
                <span className="font-semibold">{formatWon(fee.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">아직 계산되지 않았습니다.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">정산 내역 {detail.lines.length}건</h3>
        {multiRoom && (
          <p className="mb-2 text-xs text-slate-500">여러 객실 예약이라 금액을 객실 정가 비율로 나눠 객실마다 저장했습니다 (추정값).</p>
        )}
        <ul className="space-y-2">
          {detail.lines.map((line) => (
            <LineItem key={line.id} line={line} showRoom={multiRoom} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function LineItem({ line, showRoom }: { line: SettlementLine; showRoom: boolean }) {
  const tone = line.lineType === "ROOM_NIGHT" ? "blue" : line.lineType === "CANCELLATION_FEE" ? "orange" : "red";
  return (
    <li className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{lineTypeLabel[line.lineType]}</Badge>
          <span className="text-sm font-medium">{formatDate(line.stayDate)}</span>
          {showRoom && <span className="text-sm text-slate-600">{roomLabel(line.roomName)}</span>}
          {line.splitEstimated && (
            <span className="text-xs text-slate-400" title="떠나요 연박은 박수로, 여러 객실 예약은 객실 정가 비율로 나눈 값">
              추정
            </span>
          )}
        </div>
        <span className={`text-sm font-semibold ${line.netAmount < 0 ? "text-rose-600" : ""}`}>{formatWon(line.netAmount)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
        <span>매출 {formatWon(line.grossAmount)}</span>
        <span>
          수수료 {formatWon(line.commissionAmount)}
          {line.commissionRate !== null && ` (${line.commissionRate}%)`}
        </span>
        {line.partnerDiscount !== 0 && <span>우리 부담 할인 {formatWon(line.partnerDiscount)}</span>}
        {line.platformDiscount !== 0 && <span>플랫폼 부담 할인 {formatWon(line.platformDiscount)}</span>}
        {line.otherFee !== 0 && <span>기타 {formatWon(line.otherFee)}</span>}
        {line.settledOn && <span>지급 {formatDate(line.settledOn)}</span>}
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-400" title={line.fileName ?? undefined}>
        {line.fileName ?? "관리자 직접 입력"}
      </p>
    </li>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function AmountRow({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 text-sm ${strong ? "border-t border-slate-200 bg-slate-50 font-semibold" : ""}`}>
      <span className={muted ? "text-slate-500" : ""}>{label}</span>
      <span className={muted ? "text-slate-500" : strong ? "text-base" : ""}>{value}</span>
    </div>
  );
}

/** "2026.07.16 00:01 · 입실 29일 전". 떠나요·NOL은 예약 시각이 없어 날짜만 */
function reservedAtLabel(r: Reservation): string {
  if (!r.reservedAt) return "-";
  const dateOnly = r.source === "DDNAYO" || r.source === "NOL";
  const text = dateOnly ? formatDateTime(r.reservedAt).slice(0, 10) : formatDateTime(r.reservedAt);
  if (!r.checkInDate) return text;
  const days = Math.round((Date.parse(r.checkInDate + "T00:00:00Z") - Date.parse(r.reservedAt.slice(0, 10) + "T00:00:00Z")) / 86_400_000);
  return days >= 0 ? `${text} · 입실 ${days === 0 ? "당일" : `${days}일 전`}` : text;
}
