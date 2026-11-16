"use client";

import Link from "next/link";
import { useState } from "react";
import { ColumnChart, SERIES_COLORS } from "@/components/charts";
import { MonthPicker } from "@/components/month-picker";
import { ownerLabel } from "@/components/scope-filters";
import { Alert, Card, EmptyState, PageHeader, Segmented, Spinner } from "@/components/ui";
import { formatMonth, formatNumber, formatWon, shiftMonth } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";

type Basis = "FEE_MONTH" | "PAID_MONTH";
type Range = 3 | 6 | 12;

interface Amount {
  amount: number;
  count: number;
}

interface PaidSummary {
  from: string;
  to: string;
  basis: Basis;
  months: string[];
  owners: { businessOwnerId: number; name: string; months: Amount[]; total: number; count: number; share: number | null }[];
  monthTotals: Amount[];
  total: number;
  totalCount: number;
}

const basisHelp: Record<Basis, string> = {
  FEE_MONTH: "관리비가 속한 달(입실 월)로 묶습니다. 10월 입실 관리비를 11월에 입금했어도 10월에 들어갑니다.",
  PAID_MONTH: "관리자가 '입금 완료'로 표시한 달로 묶습니다. 실제로 돈이 나간 달에 가깝습니다.",
};

const shortMonth = (m: string) => `${Number(m.slice(5))}월`;

export default function PaidManagementFeesPage() {
  const [month, setMonth] = useMonth();
  const [range, setRange] = useState<Range>(6);
  const [basis, setBasis] = useState<Basis>("FEE_MONTH");
  const from = month ? shiftMonth(month, -(range - 1)) : null;
  const { data, error, loading } = useApi<PaidSummary>(month && from ? `/management-fees/paid-summary?from=${from}&to=${month}&basis=${basis}` : null);

  const spansYears = data ? data.months[0].slice(0, 4) !== data.months[data.months.length - 1].slice(0, 4) : false;
  const monthLabel = (m: string) => (spansYears ? `${m.slice(2, 4)}.${Number(m.slice(5))}월` : shortMonth(m));

  return (
    <>
      <PageHeader
        title="관리비 입금 내역"
        description="입금 완료로 표시한 관리비만 모아, 사업자별로 매달 얼마가 나갔는지 보여 줍니다. 금액은 입금 완료로 표시할 때의 지급액입니다."
        actions={
          <Link href="/management-fees" className="text-sm font-medium text-brand-700 hover:underline">
            ← 현장 관리비
          </Link>
        }
      />

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <MonthPicker month={month} onChange={setMonth} />
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: 3, label: "3개월" },
            { value: 6, label: "6개월" },
            { value: 12, label: "12개월" },
          ]}
        />
        <Segmented<Basis>
          value={basis}
          onChange={setBasis}
          options={[
            { value: "FEE_MONTH", label: "입실 월 기준" },
            { value: "PAID_MONTH", label: "입금한 달 기준" },
          ]}
        />
        {loading && data && <Spinner className="text-slate-400" />}
      </div>
      <p className="mb-5 text-xs text-slate-500">
        {from && month && `${formatMonth(from)} ~ ${formatMonth(month)} · `}
        {basisHelp[basis]}
      </p>

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
      ) : data && data.totalCount === 0 ? (
        <Card>
          <EmptyState>
            이 기간에 입금 완료로 표시한 관리비가 없습니다.{" "}
            <Link href="/management-fees" className="font-medium text-brand-700 hover:underline">
              관리비 화면
            </Link>
            에서 입금한 건을 골라 &lsquo;입금 완료로 표시&rsquo;하면 여기에 모입니다.
          </EmptyState>
        </Card>
      ) : data ? (
        <div className="space-y-5">
          {/* 총액과 사업자별 합계 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs font-medium text-slate-500">총 입금액</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{formatWon(data.total)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatNumber(data.totalCount)}건 · 월평균 {formatWon(Math.round(data.total / data.months.length))}
              </p>
            </Card>
            {data.owners.map((o) => (
              <Card key={o.businessOwnerId} className="p-5">
                <p className="truncate text-xs font-medium text-slate-500">{ownerLabel(o.name)}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{formatWon(o.total)}</p>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full" style={{ width: `${o.share ?? 0}%`, background: SERIES_COLORS[0] }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {o.share ?? 0}% · {formatNumber(o.count)}건
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">월별 입금액</h2>
            <ColumnChart
              ariaLabel="월별 관리비 입금액"
              categories={data.months.map(monthLabel)}
              series={[{ key: "total", label: "입금액", values: data.monthTotals.map((t) => t.amount) }]}
              formatValue={formatWon}
            />
          </Card>

          {/* 사업자 × 월 표 */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-4 py-2.5 text-left font-medium">사업자</th>
                    {data.months.map((m) => (
                      <th key={m} className="px-3 py-2.5 text-right font-medium">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="border-l border-slate-200 px-4 py-2.5 text-right font-semibold text-slate-700">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.owners.map((o) => (
                    <tr key={o.businessOwnerId} className="hover:bg-slate-50">
                      <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2.5 font-medium">{ownerLabel(o.name)}</td>
                      {o.months.map((a, i) => (
                        <td key={data.months[i]} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums" title={a.count ? `${a.count}건` : undefined}>
                          {a.amount ? formatWon(a.amount) : <span className="text-slate-300">-</span>}
                        </td>
                      ))}
                      <td className="whitespace-nowrap border-l border-slate-200 px-4 py-2.5 text-right font-semibold tabular-nums">{formatWon(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  <tr>
                    <td className="sticky left-0 bg-slate-50 px-4 py-2.5">총액</td>
                    {data.monthTotals.map((t, i) => (
                      <td key={data.months[i]} className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                        {t.amount ? formatWon(t.amount) : <span className="font-normal text-slate-300">-</span>}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-l border-slate-200 px-4 py-2.5 text-right tabular-nums text-brand-700">{formatWon(data.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <p className="text-xs text-slate-400">칸 위에 마우스를 올리면 건수가 보입니다. 사업자는 객실 명의 기준입니다 (관리비를 지급하는 사업자).</p>
        </div>
      ) : null}
    </>
  );
}
