"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { PropertyTabs } from "@/components/property-tabs";
import { Alert, Badge, Card, Drawer, EmptyState, PageHeader, SearchInput, Segmented, Spinner, Stat } from "@/components/ui";
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
  platformLabel,
  roomLabel,
  salesChannelLabel,
} from "@/lib/format";
import type { Platform, Reservation, ReservationDetail, SettlementLine } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";

type StatusFilter = "ALL" | "CONFIRMED" | "CANCELLED";
type SortKey = "date" | "gross" | "net";

export default function ReservationsPage() {
  const { properties, propertyId, select, error: propertyError } = useProperty();
  const [month, setMonth] = useMonth();
  const [platform, setPlatform] = useState<"ALL" | Platform>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: false });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const range = month ? monthRange(month) : null;
  const { data, error, loading } = useApi<Reservation[]>(
    propertyId === null || range === null ? null : `/reservations?propertyId=${propertyId}&from=${range.from}&to=${range.to}`,
  );
  const all = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s/g, "");
    const filtered = all.filter(
      (r) =>
        (platform === "ALL" || r.source === platform) &&
        (status === "ALL" || r.status === status) &&
        (!q ||
          [r.bookerName, r.reservationNumber, r.roomName, roomLabel(r.roomName)].some((v) => v?.toLowerCase().replace(/\s/g, "").includes(q))),
    );
    const value = (r: Reservation) => (sort.key === "gross" ? r.grossAmount : sort.key === "net" ? r.netAmount : (r.baseDate ?? ""));
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : a.id - b.id;
      return sort.desc ? -cmp : cmp;
    });
  }, [all, platform, status, query, sort]);

  const stats = useMemo(() => {
    const confirmed = rows.filter((r) => r.status === "CONFIRMED");
    const gross = rows.reduce((s, r) => s + r.grossAmount, 0);
    const commission = rows.reduce((s, r) => s + r.commissionAmount, 0);
    return {
      count: rows.length,
      cancelled: rows.length - confirmed.length,
      nights: confirmed.reduce((s, r) => s + (r.nights ?? 0), 0),
      gross,
      net: rows.reduce((s, r) => s + r.netAmount, 0),
      commissionRate: gross > 0 ? (commission / gross) * 100 : null,
    };
  }, [rows]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "date" }));
  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const filtered = platform !== "ALL" || status !== "ALL" || query.trim() !== "";

  return (
    <>
      <PageHeader title="예약 내역" description="정산 파일로 들어온 예약입니다. 입실일 기준이고, 입실일을 알 수 없는 취소 예약은 매출인식일 기준으로 보여줍니다." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PropertyTabs properties={properties} value={propertyId} onChange={select} />
        <MonthPicker month={month} onChange={setMonth} />
        {loading && data && <Spinner className="text-slate-400" />}
      </div>

      {(propertyError || error) && (
        <div className="mb-4">
          <Alert>{propertyError || error}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="예약" value={data ? `${formatNumber(stats.count)}건` : "-"} hint={data ? (stats.cancelled ? `취소 ${stats.cancelled}건 포함` : "취소 없음") : undefined} />
        <Stat label="판매 박수" value={data ? `${formatNumber(stats.nights)}박` : "-"} hint="취소 제외" />
        <Stat label="매출" value={data ? formatWon(stats.gross) : "-"} hint={stats.commissionRate !== null ? `평균 수수료율 ${stats.commissionRate.toFixed(1)}%` : undefined} />
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
            ]}
          />
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: "ALL", label: "모든 상태" },
              { value: "CONFIRMED", label: "투숙" },
              { value: "CANCELLED", label: "취소" },
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
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{roomLabel(r.roomName)}</td>
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

      <ReservationDrawer id={selectedId} onClose={closeDrawer} />
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

function ReservationDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, error, loading } = useApi<ReservationDetail>(id === null ? null : `/reservations/${id}`);
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
    </Drawer>
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
      </div>
      <h2 className="mt-2 text-xl font-bold">
        {roomLabel(r.roomName)} <span className="font-normal text-slate-400">·</span> {r.bookerName ?? "예약자 없음"}
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
  const fee = detail.managementFees[0];

  return (
    <div className="space-y-6">
      <section>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Info label="예약번호" value={<span className="break-all">{r.reservationNumber}</span>} />
          <Info label="예약 일시" value={r.reservedAt ? formatDateTime(r.reservedAt) : "-"} />
          <Info label="예약 채널" value={r.salesChannelRaw ?? salesChannelLabel[r.salesChannel]} />
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
        {fee ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={fee.basis === "CHARGED" ? "green" : fee.basis === "NO_RATE" ? "orange" : "gray"}>{feeBasisLabel[fee.basis]}</Badge>
              {fee.overrideAmount !== null && <span className="text-xs text-slate-500">수정됨 · {fee.overrideReason}</span>}
            </div>
            <span className="font-semibold">{formatWon(fee.amount)}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-400">아직 계산되지 않았습니다.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">정산 내역 {detail.lines.length}건</h3>
        <ul className="space-y-2">
          {detail.lines.map((line) => (
            <LineItem key={line.id} line={line} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function LineItem({ line }: { line: SettlementLine }) {
  const tone = line.lineType === "ROOM_NIGHT" ? "blue" : line.lineType === "CANCELLATION_FEE" ? "orange" : "red";
  return (
    <li className="rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{lineTypeLabel[line.lineType]}</Badge>
          <span className="text-sm font-medium">{formatDate(line.stayDate)}</span>
          {line.splitEstimated && (
            <span className="text-xs text-slate-400" title="떠나요 연박 금액을 박수로 나눈 값">
              균등 분할
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
      {line.fileName && (
        <p className="mt-1 truncate text-[11px] text-slate-400" title={line.fileName}>
          {line.fileName}
        </p>
      )}
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
