"use client";

import { useMemo, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { ScopeFilters, useScope } from "@/components/scope-filters";
import { Alert, Card, EmptyState, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { formatMonth, formatNumber, formatWon, monthRange, salesChannelLabel, shiftMonth } from "@/lib/format";
import type { Reservation, SalesChannel } from "@/lib/types";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";
import { useReservations } from "@/lib/use-reservations";

/** 막대 색 (한 계열이라 한 색). 검증된 팔레트의 1번 */
const BAR = "#2a78d6";

const BUCKETS = [
  { label: "당일", min: 0, max: 0 },
  { label: "1–3일", min: 1, max: 3 },
  { label: "4–7일", min: 4, max: 7 },
  { label: "8–14일", min: 8, max: 14 },
  { label: "15–30일", min: 15, max: 30 },
  { label: "31–60일", min: 31, max: 60 },
  { label: "61–90일", min: 61, max: 90 },
  { label: "91일+", min: 91, max: Infinity },
];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Span = 1 | 3 | 6 | 12;
type Include = "STAY" | "ALL";

interface Lead {
  r: Reservation;
  days: number;
  reservedDate: string;
  /** 예약 시각을 알 때만 (여기어때) */
  hour: number | null;
}

export default function BookingLeadPage() {
  const { properties, error: propertyError } = useProperty();
  const scope = useScope(properties);
  const [month, setMonth] = useMonth();
  const [span, setSpan] = useState<Span>(3);
  const [include, setInclude] = useState<Include>("STAY");

  const months = useMemo(() => (month ? Array.from({ length: span }, (_, i) => shiftMonth(month, i - span + 1)) : []), [month, span]);
  const range = months.length ? { from: monthRange(months[0]).from, to: monthRange(months[months.length - 1]).to } : null;
  const { data, loading, error } = useReservations(scope.scopeProperties, range);

  const leads = useMemo(
    () =>
      (data ?? [])
        .filter((r) => r.rooms.some((room) => scope.selectedRooms.has(room.id)))
        .filter((r) => include === "ALL" || r.status === "CONFIRMED")
        .map(toLead)
        .filter((l): l is Lead => l !== null),
    [data, scope.selectedRooms, include],
  );
  const missing = (data ?? []).filter((r) => r.rooms.some((room) => scope.selectedRooms.has(room.id)) && r.checkInDate && !r.reservedAt).length;

  const stats = useMemo(() => {
    const days = leads.map((l) => l.days).sort((a, b) => a - b);
    const n = days.length;
    return {
      n,
      avg: n ? days.reduce((s, d) => s + d, 0) / n : null,
      median: n ? (n % 2 ? days[(n - 1) / 2] : (days[n / 2 - 1] + days[n / 2]) / 2) : null,
      lastMinute: days.filter((d) => d <= 3).length,
      early: days.filter((d) => d > 30).length,
    };
  }, [leads]);

  const buckets = useMemo(
    () =>
      BUCKETS.map((b) => {
        const items = leads.filter((l) => l.days >= b.min && l.days <= b.max);
        const stays = items.filter((l) => l.r.status === "CONFIRMED" && l.r.paymentReceiver === "US");
        const nights = stays.reduce((s, l) => s + (l.r.nights ?? 0), 0);
        return {
          label: b.label,
          count: items.length,
          cancelled: items.filter((l) => l.r.status === "CANCELLED").length,
          adr: nights ? stays.reduce((s, l) => s + l.r.grossAmount, 0) / nights : null,
          avgNights: stays.length ? nights / stays.length : null,
        };
      }),
    [leads],
  );

  const channels = useMemo(() => {
    const map = new Map<SalesChannel, number[]>();
    leads.forEach((l) => map.set(l.r.salesChannel, [...(map.get(l.r.salesChannel) ?? []), l.days]));
    return [...map.entries()]
      .map(([channel, days]) => {
        const sorted = [...days].sort((a, b) => a - b);
        const n = sorted.length;
        return {
          channel,
          n,
          avg: sorted.reduce((s, d) => s + d, 0) / n,
          median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
          lastMinute: sorted.filter((d) => d <= 3).length / n,
          early: sorted.filter((d) => d > 30).length / n,
        };
      })
      .sort((a, b) => b.n - a.n);
  }, [leads]);

  const weekdays = useMemo(() => WEEKDAYS.map((label, i) => ({ label, count: leads.filter((l) => new Date(l.reservedDate + "T00:00:00").getDay() === i).length })), [leads]);
  const timed = leads.filter((l) => l.hour !== null);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => ({ label: String(h), count: timed.filter((l) => l.hour === h).length })), [timed]);

  const periodLabel = month ? (span === 1 ? formatMonth(month) : `${formatMonth(months[0])} ~ ${formatMonth(month)}`) : "";

  return (
    <>
      <PageHeader
        title="예약 시점"
        description="손님이 입실 며칠 전에 예약하는지, 어느 요일·시간에 예약하는지 봅니다. 입실일 기준 기간의 예약을 집계합니다."
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ScopeFilters scope={scope} />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<Span>
          value={span}
          onChange={setSpan}
          options={[
            { value: 1, label: "1개월" },
            { value: 3, label: "3개월" },
            { value: 6, label: "6개월" },
            { value: 12, label: "12개월" },
          ]}
        />
        <MonthPicker month={month} onChange={setMonth} />
        <Segmented<Include>
          value={include}
          onChange={setInclude}
          options={[
            { value: "STAY", label: "투숙 예약" },
            { value: "ALL", label: "취소 포함" },
          ]}
        />
        <span className="text-xs text-slate-500">입실 {periodLabel}</span>
        {loading && <Spinner className="text-slate-400" />}
      </div>

      {(propertyError || scope.ownersError || error) && (
        <div className="mb-4">
          <Alert>{propertyError || scope.ownersError || error}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="평균 리드타임" value={stats.avg !== null ? `${stats.avg.toFixed(1)}일` : "-"} hint={`예약 ${formatNumber(stats.n)}건 기준`} />
        <Stat label="중앙값" value={stats.median !== null ? `${stats.median}일` : "-"} hint="절반이 이보다 늦게 예약" />
        <Stat label="임박 예약 (3일 이내)" value={stats.n ? pct(stats.lastMinute, stats.n) : "-"} hint={`${formatNumber(stats.lastMinute)}건`} />
        <Stat label="조기 예약 (30일 초과)" value={stats.n ? pct(stats.early, stats.n) : "-"} hint={`${formatNumber(stats.early)}건`} />
      </div>

      {!loading && leads.length === 0 ? (
        <Card>
          <EmptyState>입실 {periodLabel} 예약이 없습니다.</EmptyState>
        </Card>
      ) : (
        <>
          <Card className="mb-5 p-5">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">입실 며칠 전에 예약했나</h2>
              <p className="text-xs text-slate-500">막대에 마우스를 올리면 건수·객단가가 나옵니다</p>
            </div>
            <ColumnChart
              data={buckets.map((b) => ({
                label: b.label,
                value: b.count,
                tooltip: [
                  `${formatNumber(b.count)}건 (${pct(b.count, stats.n)})`,
                  b.adr !== null ? `객단가 ${formatWon(Math.round(b.adr))}` : null,
                  b.avgNights !== null ? `평균 ${b.avgNights.toFixed(1)}박` : null,
                  b.cancelled ? `취소 ${b.cancelled}건` : null,
                ],
              }))}
              total={stats.n}
              height={200}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">예약 시점</th>
                    {buckets.map((b) => (
                      <th key={b.label} className="px-2 py-2 text-right font-medium">
                        {b.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-right">
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-left text-slate-500">비중</td>
                    {buckets.map((b) => (
                      <td key={b.label} className="px-2 py-2 font-medium">
                        {pct(b.count, stats.n)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-left text-slate-500">객단가 (ADR)</td>
                    {buckets.map((b) => (
                      <td key={b.label} className="px-2 py-2 text-slate-600">
                        {b.adr !== null ? formatCompact(b.adr) : "-"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-left text-slate-500">평균 박수</td>
                    {buckets.map((b) => (
                      <td key={b.label} className="px-2 py-2 text-slate-600">
                        {b.avgNights !== null ? `${b.avgNights.toFixed(1)}박` : "-"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-1 font-semibold">예약한 요일</h2>
              <p className="mb-3 text-xs text-slate-500">입실 요일이 아니라 예약을 넣은 요일입니다.</p>
              <ColumnChart data={weekdays.map((d) => ({ label: d.label, value: d.count, tooltip: [`${formatNumber(d.count)}건 (${pct(d.count, stats.n)})`] }))} total={stats.n} height={150} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-1 font-semibold">예약한 시간대</h2>
              <p className="mb-3 text-xs text-slate-500">
                예약 시각은 여기어때 파일에만 있어 {formatNumber(timed.length)}건으로 봅니다 (떠나요·NOL은 날짜만 있음).
              </p>
              {timed.length ? (
                <ColumnChart
                  data={hours.map((h) => ({ label: h.label, value: h.count, tooltip: [`${h.label}시대 ${formatNumber(h.count)}건 (${pct(h.count, timed.length)})`] }))}
                  total={timed.length}
                  height={150}
                  labelEvery={3}
                />
              ) : (
                <EmptyState>예약 시각이 있는 예약이 없습니다.</EmptyState>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <h2 className="font-semibold">채널별 리드타임</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full whitespace-nowrap text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">채널</th>
                    <th className="px-3 py-2.5 text-right font-medium">예약</th>
                    <th className="w-2/5 px-3 py-2.5 font-medium">평균 리드타임</th>
                    <th className="px-3 py-2.5 text-right font-medium">중앙값</th>
                    <th className="px-3 py-2.5 text-right font-medium">3일 이내</th>
                    <th className="px-5 py-2.5 text-right font-medium">30일 초과</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {channels.map((c) => {
                    const max = Math.max(...channels.map((x) => x.avg), 1);
                    return (
                      <tr key={c.channel}>
                        <td className="px-5 py-3 font-medium">{salesChannelLabel[c.channel]}</td>
                        <td className="px-3 py-3 text-right text-slate-500">{formatNumber(c.n)}건</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full" style={{ width: `${(c.avg / max) * 100}%`, background: BAR }} />
                            </div>
                            <span className="w-14 text-right font-semibold">{c.avg.toFixed(1)}일</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">{c.median}일</td>
                        <td className="px-3 py-3 text-right text-slate-600">{(c.lastMinute * 100).toFixed(0)}%</td>
                        <td className="px-5 py-3 text-right text-slate-600">{(c.early * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">
              리드타임 = 입실일 − 예약일. NOL은 정산 파일에 예약 일시가 없어 예약번호 앞 6자리(예약일)로 계산합니다. 직접 입력 예약은 입력한 날을 예약일로 봅니다.
              {missing > 0 && ` 예약일을 모르는 ${missing}건은 빠졌습니다.`}
            </p>
          </Card>
        </>
      )}
    </>
  );
}

/** 세로 막대 (한 계열). 막대보다 넓은 칸 전체가 마우스 영역이다 */
function ColumnChart({
  data,
  total,
  height,
  labelEvery = 1,
}: {
  data: { label: string; value: number; tooltip: (string | null)[] }[];
  total: number;
  height: number;
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const peak = data.findIndex((d) => d.value === max);
  return (
    <div className="pt-6">
      <div className="relative flex items-end gap-[2px] border-b border-slate-200" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.label} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
            {i === peak && d.value > 0 && hover === null && (
              <span className="absolute -translate-y-1 text-xs font-semibold text-slate-700" style={{ bottom: `${(d.value / max) * 100}%` }}>
                {total ? `${Math.round((d.value / total) * 100)}%` : d.value}
              </span>
            )}
            <div
              className={`w-full max-w-12 rounded-t transition-opacity ${hover !== null && hover !== i ? "opacity-40" : ""}`}
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, background: BAR }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                <p className="font-semibold">{d.label}</p>
                {d.tooltip.filter(Boolean).map((t) => (
                  <p key={t} className="text-slate-300">
                    {t}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-center text-[11px] text-slate-500">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 truncate">
            {i % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function toLead(r: Reservation): Lead | null {
  if (!r.checkInDate || !r.reservedAt) return null;
  const reservedDate = r.reservedAt.slice(0, 10);
  const days = Math.round((Date.parse(r.checkInDate + "T00:00:00Z") - Date.parse(reservedDate + "T00:00:00Z")) / 86_400_000);
  if (days < 0) return null;
  // 여기어때만 예약 시각이 있다 (떠나요·NOL은 날짜만, 직접 입력은 입력 시각)
  const hour = r.source === "YEOGI" && r.reservedAt.length >= 13 ? Number(r.reservedAt.slice(11, 13)) : null;
  return { r, days, reservedDate, hour };
}

function pct(part: number, whole: number): string {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : "-";
}

function formatCompact(value: number): string {
  return value >= 10_000 ? `${(value / 10_000).toFixed(1)}만원` : formatWon(Math.round(value));
}
