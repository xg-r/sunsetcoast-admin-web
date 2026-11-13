"use client";

import { useMemo, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { ScopeFilters, useScope } from "@/components/scope-filters";
import { Alert, Card, EmptyState, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { formatMonth, formatNumber, formatWon, monthRange, platformLabel, salesChannelLabel, shiftMonth } from "@/lib/format";
import type { Platform, Reservation, SalesChannel } from "@/lib/types";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";
import { useReservations } from "@/lib/use-reservations";

/** 채널 색은 채널에 고정한다 (순위나 필터에 따라 바뀌지 않는다). 검증된 categorical 팔레트 순서 */
const CHANNEL_COLOR: Record<SalesChannel, string> = {
  NAVER: "#2a78d6",
  YANOLJA: "#eb6834",
  YEOGI: "#1baf7a",
  HOMEPAGE: "#eda100",
  DDNAYO: "#e87ba4",
  PHONE: "#008300",
  WALK_IN: "#6250d6",
  OTHER: "#a3a29c",
};
const CHANNEL_ORDER = Object.keys(CHANNEL_COLOR) as SalesChannel[];

type Span = 1 | 3 | 6 | 12;
type Metric = "gross" | "count";

interface ChannelStats {
  channel: SalesChannel;
  count: number;
  cancelled: number;
  nights: number;
  gross: number;
  stayGross: number;
  /** ADR 분모: 우리 매출인 투숙 예약의 박수 */
  stayNights: number;
  commission: number;
  net: number;
  platforms: Partial<Record<Platform, number>>;
}

export default function ChannelsPage() {
  const { properties, error: propertyError } = useProperty();
  const scope = useScope(properties);
  const [month, setMonth] = useMonth();
  const [span, setSpan] = useState<Span>(3);
  const [metric, setMetric] = useState<Metric>("gross");
  const months = useMemo(() => (month ? Array.from({ length: span }, (_, i) => shiftMonth(month, i - span + 1)) : []), [month, span]);
  const range = months.length ? { from: monthRange(months[0]).from, to: monthRange(months[months.length - 1]).to } : null;

  const { data, loading, error } = useReservations(scope.scopeProperties, range);
  const filtered = useMemo(() => (data ?? []).filter((r) => r.rooms.some((room) => scope.selectedRooms.has(room.id))), [data, scope.selectedRooms]);
  const channels = useMemo(() => aggregate(filtered), [filtered]);
  const totals = useMemo(() => sum(channels), [channels]);
  const byMonth = useMemo(
    () => months.map((m) => ({ month: m, channels: aggregate(filtered.filter((r) => r.baseDate?.startsWith(m))) })),
    [months, filtered],
  );

  const periodLabel = month ? (span === 1 ? formatMonth(month) : `${formatMonth(months[0])} ~ ${formatMonth(month)}`) : "";

  return (
    <>
      <PageHeader title="판매 채널" description="고객이 예약한 채널(네이버·야놀자·여기어때 등)별 예약과 매출입니다. 떠나요로 들어온 예약은 실제 유입 채널로 나눕니다. 입실일 기준." />

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
        <span className="text-xs text-slate-500">{periodLabel}</span>
        {loading && <Spinner className="text-slate-400" />}
      </div>

      {(propertyError || scope.ownersError || error) && (
        <div className="mb-4">
          <Alert>{propertyError || scope.ownersError || error}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="예약" value={`${formatNumber(totals.count)}건`} hint={totals.cancelled ? `취소 ${totals.cancelled}건 (${pct(totals.cancelled, totals.count)})` : "취소 없음"} />
        <Stat label="매출" value={formatWon(totals.gross)} hint={`판매 ${formatNumber(totals.nights)}박`} />
        <Stat label="정산금액 (입금)" value={formatWon(totals.net)} hint="수수료·우리 부담 할인 차감 후" />
        <Stat label="평균 수수료율" value={totals.gross ? pct(totals.commission, totals.gross) : "-"} hint={`수수료 ${formatWon(totals.commission)}`} />
      </div>

      {!loading && channels.length === 0 ? (
        <Card>
          <EmptyState>{periodLabel} 예약이 없습니다.</EmptyState>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-semibold">채널 비중</h2>
                <Segmented<Metric>
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: "gross", label: "매출" },
                    { value: "count", label: "예약 수" },
                  ]}
                />
              </div>
              <ShareBars channels={channels} metric={metric} />
            </Card>
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">월별 {metric === "gross" ? "매출" : "예약 수"}</h2>
                <Legend channels={channels.map((c) => c.channel)} />
              </div>
              <MonthlyStack data={byMonth} metric={metric} />
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">채널</th>
                    <th className="px-3 py-2.5 text-right font-medium">예약</th>
                    <th className="px-3 py-2.5 text-right font-medium">취소율</th>
                    <th className="px-3 py-2.5 text-right font-medium">판매 박수</th>
                    <th className="px-3 py-2.5 text-right font-medium">매출</th>
                    <th className="px-3 py-2.5 text-right font-medium">비중</th>
                    <th className="px-3 py-2.5 text-right font-medium">ADR</th>
                    <th className="px-3 py-2.5 text-right font-medium">수수료율</th>
                    <th className="px-4 py-2.5 text-right font-medium">정산금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {channels.map((c) => (
                    <tr key={c.channel} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CHANNEL_COLOR[c.channel] }} />
                          {salesChannelLabel[c.channel]}
                        </div>
                        <p className="mt-0.5 pl-[18px] text-xs text-slate-400">
                          {Object.entries(c.platforms)
                            .map(([p, n]) => `${platformLabel[p as Platform]} ${n}`)
                            .join(" · ")}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">{formatNumber(c.count)}건</td>
                      <td className="px-3 py-3 text-right text-slate-500">{pct(c.cancelled, c.count)}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{formatNumber(c.nights)}박</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium">{formatWon(c.gross)}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{pct(c.gross, totals.gross)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-500">{c.stayNights ? formatWon(Math.round(c.stayGross / c.stayNights)) : "-"}</td>
                      <td className="px-3 py-3 text-right text-slate-500">{c.gross ? pct(c.commission, c.gross) : "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{formatWon(c.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3">합계</td>
                    <td className="px-3 py-3 text-right">{formatNumber(totals.count)}건</td>
                    <td className="px-3 py-3 text-right">{pct(totals.cancelled, totals.count)}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(totals.nights)}박</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{formatWon(totals.gross)}</td>
                    <td className="px-3 py-3 text-right">100%</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{totals.stayNights ? formatWon(Math.round(totals.stayGross / totals.stayNights)) : "-"}</td>
                    <td className="px-3 py-3 text-right">{totals.gross ? pct(totals.commission, totals.gross) : "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatWon(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
              매출은 취소수수료를 포함합니다. ADR(객단가)과 판매 박수는 취소를 뺀 투숙 예약 기준입니다. 채널 아래 작은 글씨는 정산 플랫폼별 건수입니다.
            </p>
          </Card>
        </>
      )}
    </>
  );
}

/** 채널 비중: 순위대로 한 줄씩, 이름 · 막대 · 수치 */
function ShareBars({ channels, metric }: { channels: ChannelStats[]; metric: Metric }) {
  const value = (c: ChannelStats) => (metric === "gross" ? c.gross : c.count);
  const sorted = [...channels].sort((a, b) => value(b) - value(a));
  const total = sorted.reduce((s, c) => s + value(c), 0);
  const max = Math.max(...sorted.map(value), 1);
  return (
    <ul className="space-y-3">
      {sorted.map((c) => (
        <li key={c.channel} className="group" title={`${salesChannelLabel[c.channel]} ${metric === "gross" ? formatWon(c.gross) : `${c.count}건`} (${pct(value(c), total)})`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{salesChannelLabel[c.channel]}</span>
            <span className="text-slate-500">
              <span className="font-semibold text-slate-900">{pct(value(c), total)}</span> · {metric === "gross" ? formatCompactWon(c.gross) : `${c.count}건`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full transition-[width] duration-300 group-hover:opacity-80"
              style={{ width: `${(value(c) / max) * 100}%`, background: CHANNEL_COLOR[c.channel] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 월별 누적 가로 막대. 막대 길이는 기간 중 가장 큰 달 기준 */
function MonthlyStack({ data, metric }: { data: { month: string; channels: ChannelStats[] }[]; metric: Metric }) {
  const [hover, setHover] = useState<{ month: string; channel: SalesChannel } | null>(null);
  const value = (c: ChannelStats) => (metric === "gross" ? c.gross : c.count);
  const max = Math.max(...data.map((d) => d.channels.reduce((s, c) => s + value(c), 0)), 1);
  const fmt = (n: number) => (metric === "gross" ? formatCompactWon(n) : `${formatNumber(n)}건`);

  return (
    <ul className="space-y-2.5">
      {data.map((d) => {
        const total = d.channels.reduce((s, c) => s + value(c), 0);
        const ordered = CHANNEL_ORDER.map((ch) => d.channels.find((c) => c.channel === ch)).filter((c): c is ChannelStats => !!c && value(c) > 0);
        return (
          <li key={d.month} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm">
            <span className="text-slate-500">{d.month.replace("-", ".")}</span>
            <div className="relative flex h-6 gap-[2px]" style={{ width: `${(total / max) * 100}%` }} onMouseLeave={() => setHover(null)}>
              {ordered.map((c, i) => {
                const active = hover?.month === d.month && hover.channel === c.channel;
                return (
                  <div
                    key={c.channel}
                    onMouseEnter={() => setHover({ month: d.month, channel: c.channel })}
                    className={`relative h-full transition-opacity ${hover && !active && hover.month === d.month ? "opacity-50" : ""} ${
                      i === ordered.length - 1 ? "rounded-r" : ""
                    }`}
                    style={{ flexGrow: value(c), flexBasis: 0, background: CHANNEL_COLOR[c.channel], minWidth: 2 }}
                  >
                    {active && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                        <p className="font-semibold">{salesChannelLabel[c.channel]}</p>
                        <p className="text-slate-300">
                          {formatMonth(d.month)} · {metric === "gross" ? formatWon(c.gross) : `${c.count}건`} ({pct(value(c), total)})
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="text-right font-medium">{total ? fmt(total) : <span className="text-slate-300">-</span>}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Legend({ channels }: { channels: SalesChannel[] }) {
  const present = CHANNEL_ORDER.filter((c) => channels.includes(c));
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
      {present.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_COLOR[c] }} />
          {salesChannelLabel[c]}
        </span>
      ))}
    </div>
  );
}

function aggregate(reservations: Reservation[]): ChannelStats[] {
  const map = new Map<SalesChannel, ChannelStats>();
  reservations.forEach((r) => {
    const s = map.get(r.salesChannel) ?? {
      channel: r.salesChannel,
      count: 0,
      cancelled: 0,
      nights: 0,
      gross: 0,
      stayGross: 0,
      stayNights: 0,
      commission: 0,
      net: 0,
      platforms: {},
    };
    s.count++;
    s.platforms[r.source] = (s.platforms[r.source] ?? 0) + 1;
    if (r.status === "CANCELLED") s.cancelled++;
    else s.nights += r.nights ?? 0;
    // 외부 소유주 계좌로 입금된 예약은 우리 매출이 아니다 (건수·박수만 센다)
    if (r.paymentReceiver === "OWNER") {
      map.set(r.salesChannel, s);
      return;
    }
    s.gross += r.grossAmount;
    s.commission += r.commissionAmount;
    s.net += r.netAmount;
    if (r.status !== "CANCELLED") {
      s.stayGross += r.grossAmount;
      s.stayNights += r.nights ?? 0;
    }
    map.set(r.salesChannel, s);
  });
  return CHANNEL_ORDER.map((c) => map.get(c)).filter((s): s is ChannelStats => !!s);
}

function sum(channels: ChannelStats[]) {
  return channels.reduce(
    (t, c) => ({
      count: t.count + c.count,
      cancelled: t.cancelled + c.cancelled,
      nights: t.nights + c.nights,
      gross: t.gross + c.gross,
      stayGross: t.stayGross + c.stayGross,
      stayNights: t.stayNights + c.stayNights,
      commission: t.commission + c.commission,
      net: t.net + c.net,
    }),
    { count: 0, cancelled: 0, nights: 0, gross: 0, stayGross: 0, stayNights: 0, commission: 0, net: 0 },
  );
}

function pct(part: number, whole: number): string {
  if (!whole) return "-";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** 1,234만원 / 1.2억원 */
function formatCompactWon(value: number): string {
  if (Math.abs(value) >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (Math.abs(value) >= 10_000) return `${formatNumber(Math.round(value / 10_000))}만원`;
  return formatWon(value);
}
