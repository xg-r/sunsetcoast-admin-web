"use client";

import { useState } from "react";
import { ColumnChart } from "@/components/charts";
import { Alert, Card, EmptyState, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { formatMonth, formatNumber, formatWon, platformLabel } from "@/lib/format";
import type { Platform, RevenueComparison, RevenueTotals } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useCurrentMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";

type Metric = "gross" | "net" | "roomNights";

const metricLabel: Record<Metric, string> = { gross: "매출", net: "정산액", roomNights: "객실·박" };

function value(t: RevenueTotals | null, metric: Metric): number | null {
  return t ? t[metric] : null;
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300">-</span>;
  const up = value > 0;
  return (
    <span className={value === 0 ? "text-slate-500" : up ? "text-emerald-700" : "text-rose-600"}>
      {up ? "▲" : value < 0 ? "▼" : ""} {Math.abs(value)}%
    </span>
  );
}

export default function RevenuePage() {
  const current = useCurrentMonth();
  const { properties } = useProperty();
  const [pickedYear, setYear] = useState<number | null>(null);
  const [propertyId, setPropertyId] = useState<number | "ALL">("ALL");
  const [metric, setMetric] = useState<Metric>("gross");
  const year = pickedYear ?? (current ? Number(current.slice(0, 4)) : null);

  const { data, error, loading } = useApi<RevenueComparison>(
    year ? `/analytics/revenue?year=${year}${propertyId === "ALL" ? "" : `&propertyId=${propertyId}`}` : null,
  );
  const fmt = (v: number) => (metric === "roomNights" ? `${formatNumber(v)}박` : formatWon(v));
  const missingPrev = data?.months.filter((m) => m.current && !m.previous).map((m) => Number(m.month.slice(5))) ?? [];

  return (
    <>
      <PageHeader
        title="매출 전년 비교"
        description="예약(정산 행) 기준 월 매출을 작년 같은 달과 비교합니다. 월은 숙박일 기준(연박은 박마다 그 달), 외부 소유주 객실(Villa II·III)은 뺍니다."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {year && (
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5">
            <button type="button" onClick={() => setYear(year - 1)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="이전 해">
              ‹
            </button>
            <span className="min-w-20 text-center text-sm font-semibold">
              {year} vs {year - 1}
            </span>
            <button type="button" onClick={() => setYear(year + 1)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="다음 해">
              ›
            </button>
          </div>
        )}
        <Segmented<number | "ALL">
          value={propertyId}
          onChange={setPropertyId}
          options={[{ value: "ALL", label: "전체" }, ...properties.map((p) => ({ value: p.id, label: p.name }))]}
        />
        {loading && data && <Spinner className="text-slate-400" />}
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!data && loading ? (
        <Card>
          <EmptyState>
            <Spinner />
          </EmptyState>
        </Card>
      ) : data && year ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={`${year}년 매출 (비교 가능한 달)`}
              value={formatWon(data.comparableCurrent?.gross ?? null)}
              hint={data.comparableMonths.length ? `${data.comparableMonths.map((m) => Number(m.slice(5))).join("·")}월` : "작년 데이터 없음"}
            />
            <Stat label={`${year - 1}년 같은 달`} value={formatWon(data.comparablePrevious?.gross ?? null)} hint="같은 달끼리만 더함" />
            <Stat label="매출 증감" value={<Change value={data.comparableGrossChange} />} hint={<>정산액 <Change value={data.comparableNetChange} /></>} />
            <Stat
              label="객실 1박 평균가 (ADR)"
              value={formatWon(data.comparableCurrent?.adr ?? null)}
              hint={data.comparablePrevious?.adr ? `작년 ${formatWon(data.comparablePrevious.adr)}` : undefined}
            />
          </div>

          {missingPrev.length > 0 && (
            <Alert tone="orange">
              {year - 1}년 {missingPrev.join("·")}월은 정산 데이터가 없어 비교하지 못했습니다. 작년 정산 파일(떠나요 AdjustCalendar, 여기어때·NOL 정산 파일)을 정산 파일 업로드에서
              올리면 채워집니다.
            </Alert>
          )}

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">월별 {metricLabel[metric]}</h2>
              <Segmented<Metric>
                value={metric}
                onChange={setMetric}
                options={[
                  { value: "gross", label: "매출" },
                  { value: "net", label: "정산액" },
                  { value: "roomNights", label: "객실·박" },
                ]}
              />
            </div>
            <ColumnChart
              ariaLabel={`${year}년과 ${year - 1}년 월별 ${metricLabel[metric]}`}
              categories={data.months.map((m) => `${Number(m.month.slice(5))}월`)}
              series={[
                { key: "cur", label: `${year}년`, values: data.months.map((m) => value(m.current, metric)) },
                { key: "prev", label: `${year - 1}년`, values: data.months.map((m) => value(m.previous, metric)) },
              ]}
              formatValue={fmt}
            />
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">월</th>
                    <th className="px-3 py-2.5 text-right font-medium">{year} 매출</th>
                    <th className="px-3 py-2.5 text-right font-medium">{year - 1} 매출</th>
                    <th className="px-3 py-2.5 text-right font-medium">증감</th>
                    <th className="px-3 py-2.5 text-right font-medium">객실·박</th>
                    <th className="px-3 py-2.5 text-right font-medium">증감</th>
                    <th className="px-3 py-2.5 text-right font-medium">ADR</th>
                    <th className="px-3 py-2.5 text-right font-medium">증감</th>
                    <th className="px-4 py-2.5 font-medium">{year} 플랫폼</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.months.map((m) => (
                    <tr key={m.month} className={m.current || m.previous ? "" : "text-slate-300"}>
                      <td className="whitespace-nowrap px-4 py-2.5">{formatMonth(m.month)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium">{m.current ? formatWon(m.current.gross) : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-500">{m.previous ? formatWon(m.previous.gross) : m.current ? "데이터 없음" : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <Change value={m.grossChange} />
                      </td>
                      <td className="px-3 py-2.5 text-right">{m.current ? formatNumber(m.current.roomNights) : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <Change value={m.roomNightsChange} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{m.current?.adr ? formatWon(m.current.adr) : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <Change value={m.adrChange} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {m.current &&
                          (Object.entries(m.current.byPlatform) as [Platform, number][])
                            .sort((a, b) => b[1] - a[1])
                            .map(([p, v]) => `${platformLabel[p]} ${Math.round((v / m.current!.gross) * 100)}%`)
                            .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
