"use client";

import { useMemo, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { PropertyTabs } from "@/components/property-tabs";
import { Alert, Badge, Button, Card, EmptyState, Modal, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { feeBasisLabel, formatDate, formatMonth, formatNumber, formatWon, platformLabel, roomLabel } from "@/lib/format";
import type { FeeBasis, ManagementFee, MonthlyManagementFee } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";

type Filter = "ALL" | "PAID" | "ZERO" | "OVERRIDDEN";

const basisTone: Record<FeeBasis, "green" | "gray" | "orange"> = {
  CHARGED: "green",
  CANCELLED: "gray",
  NO_STAY: "gray",
  NO_RATE: "orange",
};

export default function ManagementFeesPage() {
  const { properties, propertyId, select, error: propertyError } = useProperty();
  const [month, setMonth] = useMonth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<ManagementFee | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, error, loading, reload } = useApi<MonthlyManagementFee>(
    propertyId === null || month === null ? null : `/management-fees?propertyId=${propertyId}&month=${month}`,
  );
  const items = useMemo(() => data?.items ?? [], [data]);

  const rows = useMemo(() => {
    switch (filter) {
      case "PAID":
        return items.filter((f) => f.amount > 0);
      case "ZERO":
        return items.filter((f) => f.amount === 0);
      case "OVERRIDDEN":
        return items.filter((f) => f.overrideAmount !== null);
      default:
        return items;
    }
  }, [items, filter]);

  const overridden = items.filter((f) => f.overrideAmount !== null).length;
  const zero = items.filter((f) => f.amount === 0).length;
  const noRate = items.filter((f) => f.basis === "NO_RATE").length;

  const recalculate = async () => {
    if (!confirm("모든 예약의 관리비를 다시 계산할까요?\n관리자가 고친 금액은 그대로 유지됩니다.")) return;
    setRecalculating(true);
    setNotice(null);
    try {
      const res = await api.post<{ reservations: number }>("/management-fees/recalculate");
      setNotice(`예약 ${formatNumber(res.reservations)}건의 관리비를 다시 계산했습니다.`);
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="현장 관리비"
        description="예약 1건의 객실마다 1회 지급합니다 (박수 무관, 취소 0원). 입실일이 속한 달에 포함됩니다."
        actions={
          <Button onClick={recalculate} loading={recalculating}>
            전체 재계산
          </Button>
        }
      />

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
      {notice && (
        <div className="mb-4">
          <Alert tone="blue">{notice}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={month ? `${formatMonth(month)} 지급 합계` : "지급 합계"} value={data ? formatWon(data.totalAmount) : "-"} />
        <Stat label="지급 건수" value={data ? `${formatNumber(data.chargedCount)}건` : "-"} hint={data ? `예약 ${items.length}건 중` : undefined} />
        <Stat label="0원" value={data ? `${zero}건` : "-"} hint="취소, Villa II·III 등" />
        <Stat label="직접 수정" value={data ? `${overridden}건` : "-"} hint={noRate ? <span className="text-amber-600">단가 없음 {noRate}건 확인 필요</span> : "한달살기 등 예외"} />
      </div>

      <div className="mb-3">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: `전체 ${items.length}` },
            { value: "PAID", label: "지급" },
            { value: "ZERO", label: "0원" },
            { value: "OVERRIDDEN", label: "수정됨" },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {!data && loading ? (
          <EmptyState>
            <Spinner />
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>{items.length ? "조건에 맞는 예약이 없습니다." : `${month ? formatMonth(month) : "이 달"}에 입실한 예약이 없습니다.`}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">입실</th>
                  <th className="px-4 py-2.5 font-medium">객실</th>
                  <th className="px-4 py-2.5 font-medium">예약</th>
                  <th className="px-3 py-2.5 text-right font-medium">박수</th>
                  <th className="px-4 py-2.5 font-medium">구분</th>
                  <th className="px-4 py-2.5 text-right font-medium">지급액</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(fee.checkInDate)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium">{roomLabel(fee.roomName)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge>{platformLabel[fee.source]}</Badge>
                        <span className="text-slate-700">{fee.bookerName ?? "-"}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{fee.reservationNumber}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{fee.nights ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={basisTone[fee.basis]}>{feeBasisLabel[fee.basis]}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {fee.overrideAmount !== null ? (
                        <div title={fee.overrideReason ?? undefined}>
                          <span className="font-semibold text-brand-700">{formatWon(fee.amount)}</span>
                          <p className="text-xs text-slate-400">
                            <span className="line-through">{formatWon(fee.calculatedAmount)}</span> · 수정됨
                          </p>
                        </div>
                      ) : (
                        <span className={fee.amount === 0 ? "text-slate-300" : "font-medium"}>{formatWon(fee.amount)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(fee)}>
                        수정
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <OverrideDialog
          key={editing.id}
          fee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function OverrideDialog({ fee, onClose, onSaved }: { fee: ManagementFee; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(fee.overrideAmount !== null ? String(fee.overrideAmount) : "");
  const [reason, setReason] = useState(fee.overrideReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (body: { amount: number | null; reason: string | null }) => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/management-fees/${fee.id}`, body);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const parsed = Number(amount.replaceAll(",", ""));
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && reason.trim() !== "";

  return (
    <Modal open onClose={onClose} title="관리비 수정">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium">
          {roomLabel(fee.roomName)} · {fee.bookerName ?? "예약자 없음"}
        </p>
        <p className="mt-0.5 text-slate-500">
          {formatDate(fee.checkInDate)} 입실 · {fee.nights ?? "-"}박 · {platformLabel[fee.source]} {fee.reservationNumber}
        </p>
        <p className="mt-2 text-slate-500">
          자동 계산 <span className="font-semibold text-slate-800">{formatWon(fee.calculatedAmount)}</span> ({feeBasisLabel[fee.basis]})
        </p>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save({ amount: parsed, reason: reason.trim() });
        }}
      >
        <label className="block">
          <span className="text-sm font-medium">지급할 금액</span>
          <div className="relative mt-1">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ""))}
              placeholder={String(fee.calculatedAmount)}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 pr-8 text-right focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">원</span>
          </div>
        </label>
        <label className="block">
          <span className="text-sm font-medium">사유</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 한달살기, 주 1회 청소로 합의"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between pt-2">
          {fee.overrideAmount !== null ? (
            <Button variant="danger" disabled={saving} onClick={() => save({ amount: null, reason: null })}>
              자동 계산으로 되돌리기
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={!valid} loading={saving}>
              저장
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
