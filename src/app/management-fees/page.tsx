"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { ownerLabel, ScopeFilters, scopeRoomsSummary, useScope } from "@/components/scope-filters";
import { Alert, Badge, Button, Card, EmptyState, Modal, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import {
  feeBasisLabel,
  feePaymentLabel,
  feePaymentTone,
  formatDate,
  formatDateTime,
  formatMonth,
  formatNumber,
  formatWon,
  platformLabel,
  roomLabel,
} from "@/lib/format";
import type { FeeBasis, ManagementFee, ManagementFeeExtraItem, MonthlyManagementFee } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";

type Filter = "ALL" | "NOT_VERIFIED" | "REVERIFY" | "VERIFIED" | "UNPAID" | "PAID" | "CHANGED" | "ZERO" | "OVERRIDDEN" | "EXTRAS";

/** 확인 상태별 줄 색 (왼쪽 굵은 선 + 연한 바탕) */
const verifyRowStyle: Record<ManagementFee["verificationStatus"], string> = {
  NONE: "",
  VERIFIED: "bg-emerald-50/70",
  CHANGED: "bg-amber-50",
};
const verifyBarStyle: Record<ManagementFee["verificationStatus"], string> = {
  NONE: "border-l-4 border-l-transparent",
  VERIFIED: "border-l-4 border-l-emerald-500",
  CHANGED: "border-l-4 border-l-amber-400",
};

const basisTone: Record<FeeBasis, "gray" | "orange"> = {
  CHARGED: "gray",
  CANCELLED: "gray",
  NO_STAY: "gray",
  NO_RATE: "orange",
};

export default function ManagementFeesPage() {
  const { properties, error: propertyError } = useProperty();
  const scope = useScope(properties);
  const [month, setMonth] = useMonth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<ManagementFee | null>(null);
  const [editingExtras, setEditingExtras] = useState<ManagementFee | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);
  // 확인 버튼을 누른 결과를 바로 보여 준다 (목록을 다시 읽지 않아 스크롤이 유지된다). 목록을 다시 읽으면 버린다
  const [patch, setPatch] = useState<{ base: MonthlyManagementFee | null | undefined; fees: Map<number, ManagementFee> }>({ base: null, fees: new Map() });
  // 옵티미스틱 업데이트: 누르는 즉시 색을 바꾸고, 저장에 실패하면 서버가 마지막으로 확인해 준 상태로 되돌린다
  const confirmedFees = useRef(new Map<number, ManagementFee>());
  const latestRequest = useRef(new Map<number, number>());
  const requestSeq = useRef(0);

  const params = [
    month && `month=${month}`,
    scope.propertyId !== null && `propertyId=${scope.propertyId}`,
    scope.ownerId !== null && `businessOwnerId=${scope.ownerId}`,
  ].filter(Boolean);
  const { data, error, loading, reload } = useApi<MonthlyManagementFee>(month ? `/management-fees?${params.join("&")}` : null);
  const items = useMemo(() => {
    const patched = patch.base === data ? patch.fees : null;
    return (data?.items ?? []).filter((f) => scope.selectedRooms.has(f.roomId)).map((f) => patched?.get(f.id) ?? f);
  }, [data, scope.selectedRooms, patch]);
  const owner = scope.owners.find((o) => o.id === scope.ownerId);

  const rows = useMemo(() => {
    switch (filter) {
      case "NOT_VERIFIED":
        return items.filter((f) => f.verificationStatus === "NONE");
      case "REVERIFY":
        return items.filter((f) => f.verificationStatus === "CHANGED");
      case "VERIFIED":
        return items.filter((f) => f.verificationStatus === "VERIFIED");
      case "UNPAID":
        return items.filter((f) => f.paymentStatus === "UNPAID");
      case "PAID":
        return items.filter((f) => f.paymentStatus === "PAID" || f.paymentStatus === "PAID_CHANGED");
      case "CHANGED":
        return items.filter((f) => f.paymentStatus === "PAID_CHANGED");
      case "ZERO":
        return items.filter((f) => f.payableAmount === 0);
      case "EXTRAS":
        return items.filter((f) => f.extras.length > 0);
      case "OVERRIDDEN":
        return items.filter((f) => f.overrideAmount !== null);
      default:
        return items;
    }
  }, [items, filter]);

  // 지급액 = 관리비 + 추가요금 (현장에 이체하는 금액)
  const total = items.reduce((sum, f) => sum + f.payableAmount, 0);
  const feeTotal = items.reduce((sum, f) => sum + f.amount, 0);
  const extraTotal = items.reduce((sum, f) => sum + f.extraAmount, 0);
  const withExtras = items.filter((f) => f.extras.length > 0).length;
  const grossTotal = items.reduce((sum, f) => sum + (f.grossAmount ?? 0), 0);
  const netTotal = items.reduce((sum, f) => sum + (f.netAmount ?? 0), 0);
  const unknownRevenue = items.filter((f) => f.grossAmount === null).length;
  const feeRatio = grossTotal > 0 ? (feeTotal / grossTotal) * 100 : null;
  const charged = items.filter((f) => f.payableAmount > 0).length;
  const overridden = items.filter((f) => f.overrideAmount !== null).length;
  const zero = items.length - charged;
  const noRate = items.filter((f) => f.basis === "NO_RATE").length;
  const unpaid = items.filter((f) => f.paymentStatus === "UNPAID");
  const unpaidTotal = unpaid.reduce((sum, f) => sum + f.payableAmount, 0);
  const paidItems = items.filter((f) => f.paymentStatus === "PAID" || f.paymentStatus === "PAID_CHANGED");
  const paidTotal = paidItems.reduce((sum, f) => sum + (f.paidAmount ?? 0), 0);
  const changed = items.filter((f) => f.paymentStatus === "PAID_CHANGED").length;
  const verifiedCount = items.filter((f) => f.verificationStatus === "VERIFIED").length;
  const reverifyCount = items.filter((f) => f.verificationStatus === "CHANGED").length;
  const notVerifiedCount = items.length - verifiedCount - reverifyCount;
  const verifiedPercent = items.length ? Math.round((verifiedCount / items.length) * 100) : 0;

  /** 보이는 관리비 한 줄을 바꾼다 (목록을 다시 읽지 않음) */
  const showFee = (fee: ManagementFee) =>
    setPatch((prev) => {
      const fees = new Map(prev.base === data ? prev.fees : []);
      fees.set(fee.id, fee);
      return { base: data, fees };
    });

  /**
   * 확인 버튼: 확인 안 함·다시 확인 → 확인, 확인됨 → 취소.
   * 누르는 즉시 화면을 바꾸고(옵티미스틱), 서버 응답이 오면 그 값으로 맞춘다.
   * 같은 줄을 빠르게 여러 번 누르면 마지막 요청의 결과만 반영한다.
   */
  const toggleVerified = async (fee: ManagementFee) => {
    const verify = fee.verificationStatus !== "VERIFIED";
    if (!confirmedFees.current.has(fee.id)) confirmedFees.current.set(fee.id, fee);
    const seq = ++requestSeq.current;
    latestRequest.current.set(fee.id, seq);
    setNotice(null);
    showFee({
      ...fee,
      verificationStatus: verify ? "VERIFIED" : "NONE",
      verifiedAt: verify ? localNow() : null,
      verifiedAmount: verify ? fee.payableAmount : null,
    });
    try {
      const [updated] = await api.post<ManagementFee[]>("/management-fees/verifications", { ids: [fee.id], verified: verify });
      confirmedFees.current.set(fee.id, updated);
      if (latestRequest.current.get(fee.id) === seq) showFee(updated);
    } catch (e) {
      if (latestRequest.current.get(fee.id) !== seq) return;
      const confirmed = confirmedFees.current.get(fee.id);
      if (confirmed) showFee(confirmed);
      setNotice(`${roomLabel(fee.roomName)} ${fee.bookerName ?? ""} 확인을 저장하지 못해 되돌렸습니다: ${(e as Error).message}`);
    }
  };

  // 보이는 행 중 선택한 것만 처리한다 (필터를 바꾸면 안 보이는 선택은 빠진다)
  const selectable = rows.filter((f) => f.paymentStatus !== "NONE");
  const selectedRows = selectable.filter((f) => selected.has(f.id));
  const selectedUnpaid = selectedRows.filter((f) => f.paymentStatus === "UNPAID");
  const selectedPaid = selectedRows.filter((f) => f.paymentStatus !== "UNPAID");
  const allSelected = selectable.length > 0 && selectedRows.length === selectable.length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((f) => f.id)));

  const markPayments = async (fees: ManagementFee[], paid: boolean) => {
    if (fees.length === 0) return;
    const sum = fees.reduce((s, f) => s + (paid ? f.payableAmount : (f.paidAmount ?? f.payableAmount)), 0);
    const notVerified = fees.filter((f) => f.verificationStatus !== "VERIFIED").length;
    const message = paid
      ? `선택한 ${fees.length}건(${formatWon(sum)})을 입금 완료로 표시할까요?\n현장에 실제로 입금한 건만 표시하세요.` +
        (notVerified ? `\n\n⚠ 이 중 ${notVerified}건은 아직 '확인'하지 않았습니다.` : "")
      : `선택한 ${fees.length}건(${formatWon(sum)})의 입금 완료를 취소할까요?`;
    if (!confirm(message)) return;
    setMarking(true);
    setNotice(null);
    try {
      await api.post("/management-fees/payments", { ids: fees.map((f) => f.id), paid });
      setNotice(paid ? `${fees.length}건(${formatWon(sum)})을 입금 완료로 표시했습니다.` : `${fees.length}건의 입금 완료를 취소했습니다.`);
      setSelected(new Set());
      reload();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setMarking(false);
    }
  };

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
        description="예약 1건의 객실마다 1회 지급합니다 (박수 무관, 취소 0원). 입실일이 속한 달에 포함되고, 객실 명의 사업자가 지급합니다. 손님이 바베큐·추가인원 요금을 숙박비와 함께 우리 계좌로 보냈다면 '추가요금'에 적어 관리비와 같이 이체합니다. 현장에 입금한 뒤 행을 골라 '입금 완료'로 표시합니다."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/management-fees/paid" className="text-sm font-medium text-brand-700 hover:underline">
              입금 내역 보기 →
            </Link>
            <Button onClick={recalculate} loading={recalculating}>
              전체 재계산
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ScopeFilters scope={scope} />
        <MonthPicker month={month} onChange={setMonth} />
        {owner && <span className="text-xs text-slate-500">명의 객실 {owner.rooms.length}개 · {scopeRoomsSummary(owner.rooms, properties)}</span>}
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

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label={`${owner ? `${ownerLabel(owner.name)} · ` : ""}${month ? formatMonth(month) : ""} 지급 합계`}
          value={data ? formatWon(total) : "-"}
          hint={
            noRate ? (
              <span className="text-amber-600">단가 없음 {noRate}건 확인 필요</span>
            ) : data ? (
              <>
                관리비 {formatWon(feeTotal)}
                {extraTotal > 0 && <span className="text-brand-700"> + 추가요금 {formatWon(extraTotal)} ({withExtras}건)</span>}
                <br />
                지급 대상 {formatNumber(charged)}건 · 0원 {zero}건 · 직접 수정 {overridden}건
              </>
            ) : undefined
          }
        />
        <Stat
          label="매출 (판매가)"
          value={data ? formatWon(grossTotal) : "-"}
          hint={
            data ? (
              <>
                정산금액 {formatWon(netTotal)}
                {feeRatio !== null && ` · 관리비 비율 ${feeRatio.toFixed(1)}%`}
                {unknownRevenue > 0 && <span className="text-amber-600"> · 매출 모름 {unknownRevenue}건</span>}
              </>
            ) : undefined
          }
        />
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">확인 진행</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {data ? (
              <>
                {formatNumber(verifiedCount)} <span className="text-base font-normal text-slate-400">/ {formatNumber(items.length)}건</span>
              </>
            ) : (
              "-"
            )}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={verifiedPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${verifiedPercent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {reverifyCount > 0 ? (
              <span className="font-medium text-amber-700">다시 확인 {reverifyCount}건 · </span>
            ) : null}
            {notVerifiedCount > 0 ? `남은 ${formatNumber(notVerifiedCount)}건` : data && items.length ? "모두 확인했습니다" : ""}
          </p>
        </Card>
        <Stat
          label="미입금"
          value={data ? formatWon(unpaidTotal) : "-"}
          hint={data ? `${formatNumber(unpaid.length)}건` : undefined}
        />
        <Stat
          label="입금 완료"
          value={data ? formatWon(paidTotal) : "-"}
          hint={changed ? <span className="text-rose-600">입금 후 금액 변경 {changed}건 확인 필요</span> : data ? `${formatNumber(paidItems.length)}건` : undefined}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="overflow-x-auto">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: `전체 ${items.length}` },
              { value: "NOT_VERIFIED", label: `확인 안 함 ${notVerifiedCount}` },
              ...(reverifyCount ? [{ value: "REVERIFY" as const, label: `다시 확인 ${reverifyCount}` }] : []),
              { value: "VERIFIED", label: `확인함 ${verifiedCount}` },
              { value: "UNPAID", label: `미입금 ${unpaid.length}` },
              { value: "PAID", label: "입금 완료" },
              ...(changed ? [{ value: "CHANGED" as const, label: `금액 변경 ${changed}` }] : []),
              { value: "ZERO", label: "0원" },
              { value: "OVERRIDDEN", label: "수정됨" },
              ...(withExtras ? [{ value: "EXTRAS" as const, label: `추가요금 ${withExtras}` }] : []),
            ]}
          />
        </div>
        {selectedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">{selectedRows.length}건 선택</span>
            {selectedUnpaid.length > 0 && (
              <Button variant="primary" size="sm" loading={marking} onClick={() => markPayments(selectedUnpaid, true)}>
                입금 완료로 표시 ({selectedUnpaid.length})
              </Button>
            )}
            {selectedPaid.length > 0 && (
              <Button size="sm" disabled={marking} onClick={() => markPayments(selectedPaid, false)}>
                입금 완료 취소 ({selectedPaid.length})
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-l-4 border-l-emerald-500 bg-emerald-50" aria-hidden />
          확인함 (실제 자료와 맞음)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border-l-4 border-l-amber-400 bg-amber-50" aria-hidden />
          확인한 뒤 금액이 바뀜 · 다시 확인해 주세요
        </span>
        <span>오른쪽 &lsquo;확인&rsquo; 버튼을 다시 누르면 취소됩니다.</span>
      </p>

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
                  <th className="w-10 py-2.5 pl-4">
                    <input
                      type="checkbox"
                      aria-label="보이는 행 모두 선택"
                      checked={allSelected}
                      disabled={selectable.length === 0}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">입실</th>
                  <th className="px-4 py-2.5 font-medium">객실</th>
                  <th className="px-4 py-2.5 font-medium">예약</th>
                  <th className="px-3 py-2.5 text-right font-medium">박수</th>
                  <th className="px-4 py-2.5 font-medium">구분</th>
                  <th className="px-4 py-2.5 text-right font-medium" title="이 객실의 판매가 합계 (취소수수료 포함). 아래는 수수료를 뺀 정산금액">
                    매출
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">관리비</th>
                  <th className="px-4 py-2.5 font-medium">추가요금</th>
                  <th className="px-4 py-2.5 text-right font-medium">지급액</th>
                  <th className="px-4 py-2.5 font-medium">입금</th>
                  <th className="px-3 py-2.5 text-center font-medium">확인</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((fee) => (
                  <tr
                    key={fee.id}
                    className={`transition-colors ${
                      fee.verificationStatus !== "NONE" ? verifyRowStyle[fee.verificationStatus] : selected.has(fee.id) ? "bg-brand-50/40" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className={`py-2.5 pl-3 ${verifyBarStyle[fee.verificationStatus]}`}>
                      {fee.paymentStatus !== "NONE" && (
                        <input
                          type="checkbox"
                          aria-label={`${fee.reservationNumber} 선택`}
                          checked={selected.has(fee.id)}
                          onChange={() => toggle(fee.id)}
                          className="h-4 w-4 accent-brand-600"
                        />
                      )}
                    </td>
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
                      {/* 지급 대상은 평소 상태라 글자로만, 예외(취소·투숙 없음·단가 없음)만 배지로 */}
                      {fee.basis === "CHARGED" ? (
                        <span className="text-slate-500">{feeBasisLabel[fee.basis]}</span>
                      ) : (
                        <Badge tone={basisTone[fee.basis]}>{feeBasisLabel[fee.basis]}</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      {fee.grossAmount === null ? (
                        <span className="text-slate-300" title="정산 행이 없는 다중 객실 예약이라 객실별 매출을 모릅니다">
                          -
                        </span>
                      ) : (
                        <div>
                          <span className="text-slate-700">{formatWon(fee.grossAmount)}</span>
                          {fee.netAmount !== null && fee.netAmount !== fee.grossAmount && (
                            <p className="text-xs text-slate-400">정산 {formatWon(fee.netAmount)}</p>
                          )}
                        </div>
                      )}
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
                    <td className="px-4 py-2.5">
                      <ExtrasCell fee={fee} onEdit={() => setEditingExtras(fee)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <span className={fee.payableAmount === 0 ? "text-slate-300" : "font-semibold text-slate-900"}>{formatWon(fee.payableAmount)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {fee.paymentStatus === "NONE" ? (
                        <span className="text-slate-300">-</span>
                      ) : (
                        <div>
                          {fee.paymentStatus === "UNPAID" ? (
                            <span className="text-slate-500">{feePaymentLabel[fee.paymentStatus]}</span>
                          ) : (
                            <Badge tone={feePaymentTone[fee.paymentStatus]}>{feePaymentLabel[fee.paymentStatus]}</Badge>
                          )}
                          {fee.paidAt && <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(fee.paidAt)}</p>}
                          {fee.paymentStatus === "PAID_CHANGED" && (
                            <p className="text-xs text-rose-600">
                              입금 {formatWon(fee.paidAmount ?? 0)} → 현재 {formatWon(fee.payableAmount)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <VerifyButton fee={fee} onClick={() => void toggleVerified(fee)} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={fee.paidAt !== null}
                        title={fee.paidAt !== null ? "입금 완료된 관리비는 입금 완료를 취소한 뒤 고칠 수 있습니다" : undefined}
                        onClick={() => setEditing(fee)}
                      >
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

      {editingExtras && (
        <ExtrasDialog
          key={editingExtras.id}
          fee={editingExtras}
          onClose={() => setEditingExtras(null)}
          onSaved={() => {
            setEditingExtras(null);
            reload();
          }}
        />
      )}
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

/** 줄마다 크게 보이는 확인 버튼 */
function VerifyButton({ fee, onClick }: { fee: ManagementFee; onClick: () => void }) {
  const base =
    "inline-flex h-9 min-w-[6.5rem] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60";
  if (fee.verificationStatus === "VERIFIED") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${fee.verifiedAt ? formatDateTime(fee.verifiedAt) + " 확인 · " : ""}누르면 확인을 취소합니다`}
        aria-label={`${fee.reservationNumber} 확인됨. 누르면 취소`}
        className={`${base} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
        확인됨
      </button>
    );
  }
  if (fee.verificationStatus === "CHANGED") {
    return (
      <div>
        <button
          type="button"
          onClick={onClick}
            aria-label={`${fee.reservationNumber} 금액이 바뀌어 다시 확인`}
          className={`${base} bg-amber-400 text-amber-950 hover:bg-amber-500 focus-visible:ring-amber-300`}
        >
          다시 확인
        </button>
        <p className="mt-0.5 text-[11px] text-amber-800">확인 때 {formatWon(fee.verifiedAmount ?? 0)}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${fee.reservationNumber} 확인`}
      className={`${base} border-2 border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-emerald-400`}
    >
      <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current" aria-hidden />
      확인
    </button>
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

/** 지금 시각 (서버 형식 "2026-11-16T15:30:00", 화면에 바로 보여 줄 확인 시각) */
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const extraItems: Record<ManagementFeeExtraItem, { label: string; unitPrice: number | null; perNight: boolean }> = {
  BBQ: { label: "바베큐", unitPrice: 30000, perNight: false },
  EXTRA_PERSON: { label: "추가인원", unitPrice: 20000, perNight: true },
  OTHER: { label: "기타", unitPrice: null, perNight: false },
};

/** 추가요금 한 건 요약: "추가인원 2명 × 1박", "바베큐 1회" */
function extraSummary(e: { item: ManagementFeeExtraItem; quantity: number; nights: number | null; memo: string | null }): string {
  if (e.item === "EXTRA_PERSON") return `추가인원 ${e.quantity}명 × ${e.nights ?? "-"}박`;
  if (e.item === "BBQ") return `바베큐 ${e.quantity}회`;
  return `${e.memo ?? "기타"}${e.quantity > 1 ? ` × ${e.quantity}` : ""}`;
}

/** 표의 추가요금 칸: 없으면 '+ 추가' 버튼, 있으면 합계와 항목 (누르면 편집) */
function ExtrasCell({ fee, onEdit }: { fee: ManagementFee; onEdit: () => void }) {
  const locked = fee.paidAt !== null;
  const title = locked ? "입금 완료된 관리비는 입금 완료를 취소한 뒤 고칠 수 있습니다" : "추가요금 입력";
  if (fee.extras.length === 0) {
    if (fee.status === "CANCELLED") return <span className="text-slate-300">-</span>;
    return (
      <button
        type="button"
        onClick={onEdit}
        disabled={locked}
        title={title}
        className="rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-40"
      >
        + 추가
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      disabled={locked}
      title={title}
      className="-mx-2 rounded-md px-2 py-1 text-left hover:bg-brand-50 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className="font-medium text-brand-700">{formatWon(fee.extraAmount)}</span>
      {fee.extras.map((e) => (
        <p key={e.id} className="whitespace-nowrap text-xs text-slate-500">
          {extraSummary(e)}
        </p>
      ))}
    </button>
  );
}

interface ExtraDraft {
  key: number;
  item: ManagementFeeExtraItem;
  quantity: string;
  unitPrice: string;
  nights: string;
  memo: string;
}

const digits = (v: string) => v.replace(/[^\d]/g, "");

/** 편집 중인 추가요금 줄의 React key */
let draftSeq = 0;

function ExtrasDialog({ fee, onClose, onSaved }: { fee: ManagementFee; onClose: () => void; onSaved: () => void }) {
  const draftOf = (item: ManagementFeeExtraItem, from?: ManagementFee["extras"][number]): ExtraDraft => ({
    key: ++draftSeq,
    item,
    quantity: String(from?.quantity ?? 1),
    unitPrice: String(from?.unitPrice ?? extraItems[item].unitPrice ?? ""),
    nights: extraItems[item].perNight ? String(from?.nights ?? fee.nights ?? 1) : "",
    memo: from?.memo ?? "",
  });
  const [drafts, setDrafts] = useState<ExtraDraft[]>(() =>
    fee.extras.length ? fee.extras.map((e) => draftOf(e.item, e)) : [draftOf("BBQ")],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<ExtraDraft>) => setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const amountOf = (d: ExtraDraft) => {
    const n = extraItems[d.item].perNight ? Number(d.nights || 0) : 1;
    return Number(d.unitPrice || 0) * Number(d.quantity || 0) * n;
  };
  const problem = (d: ExtraDraft): string | null => {
    if (!(Number(d.quantity) > 0)) return "수량을 입력해 주세요";
    if (!(Number(d.unitPrice) > 0)) return "단가를 입력해 주세요";
    if (extraItems[d.item].perNight && !(Number(d.nights) > 0)) return "박수를 입력해 주세요";
    if (d.item === "OTHER" && !d.memo.trim()) return "내용을 적어 주세요";
    return null;
  };
  const extraTotal = drafts.reduce((s, d) => s + amountOf(d), 0);
  const valid = drafts.every((d) => problem(d) === null);

  const save = async (list: ExtraDraft[]) => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/management-fees/${fee.id}/extras`, {
        extras: list.map((d) => ({
          item: d.item,
          quantity: Number(d.quantity),
          unitPrice: Number(d.unitPrice),
          nights: extraItems[d.item].perNight ? Number(d.nights) : null,
          memo: d.memo.trim() || null,
        })),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const input = "h-9 w-full rounded-lg border border-slate-300 px-2.5 text-right focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <Modal open onClose={onClose} title="추가요금">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium">
          {roomLabel(fee.roomName)} · {fee.bookerName ?? "예약자 없음"}
        </p>
        <p className="mt-0.5 text-slate-500">
          {formatDate(fee.checkInDate)} 입실 · {fee.nights ?? "-"}박 · {platformLabel[fee.source]} {fee.reservationNumber}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          손님이 현장에 낼 요금을 숙박비와 함께 우리 계좌로 보낸 경우에만 적습니다. 관리비와 합쳐 현장에 이체합니다.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {drafts.map((d) => {
          const meta = extraItems[d.item];
          return (
            <div key={d.key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={d.item}
                  onChange={(e) => {
                    const item = e.target.value as ManagementFeeExtraItem;
                    const m = extraItems[item];
                    update(d.key, {
                      item,
                      unitPrice: m.unitPrice !== null ? String(m.unitPrice) : "",
                      nights: m.perNight ? String(fee.nights ?? 1) : "",
                    });
                  }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium focus:border-brand-500 focus:outline-none"
                  aria-label="항목"
                >
                  {(Object.keys(extraItems) as ManagementFeeExtraItem[]).map((k) => (
                    <option key={k} value={k}>
                      {extraItems[k].label}
                    </option>
                  ))}
                </select>
                <span className="ml-auto text-sm font-semibold">{formatWon(amountOf(d))}</span>
                <button
                  type="button"
                  onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="이 항목 지우기"
                >
                  삭제
                </button>
              </div>
              <div className={`mt-2 grid gap-2 ${meta.perNight ? "grid-cols-3" : "grid-cols-2"}`}>
                <label className="block text-xs text-slate-500">
                  {d.item === "EXTRA_PERSON" ? "인원" : "수량"}
                  <input inputMode="numeric" value={d.quantity} onChange={(e) => update(d.key, { quantity: digits(e.target.value) })} className={`mt-1 ${input}`} />
                </label>
                {meta.perNight && (
                  <label className="block text-xs text-slate-500">
                    박수
                    <input inputMode="numeric" value={d.nights} onChange={(e) => update(d.key, { nights: digits(e.target.value) })} className={`mt-1 ${input}`} />
                  </label>
                )}
                <label className="block text-xs text-slate-500">
                  단가{meta.perNight ? " (1박 1인)" : ""}
                  <input inputMode="numeric" value={d.unitPrice} onChange={(e) => update(d.key, { unitPrice: digits(e.target.value) })} className={`mt-1 ${input}`} />
                </label>
              </div>
              <input
                value={d.memo}
                onChange={(e) => update(d.key, { memo: e.target.value })}
                placeholder={d.item === "OTHER" ? "내용 (필수), 예: 숯 추가" : "메모 (선택)"}
                className="mt-2 h-9 w-full rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              {problem(d) && <p className="mt-1 text-xs text-amber-700">{problem(d)}</p>}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(extraItems) as ManagementFeeExtraItem[]).map((k) => (
            <Button key={k} size="sm" variant="ghost" onClick={() => setDrafts((prev) => [...prev, draftOf(k)])}>
              + {extraItems[k].label}
            </Button>
          ))}
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>관리비</span>
            <span>{formatWon(fee.amount)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>추가요금</span>
            <span>{formatWon(extraTotal)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold">
            <span>현장에 이체할 금액</span>
            <span>{formatWon(fee.amount + extraTotal)}</span>
          </div>
          {fee.verificationStatus === "VERIFIED" && extraTotal !== fee.extraAmount && (
            <p className="mt-1 text-xs text-amber-700">이미 확인한 건이라 저장하면 &lsquo;다시 확인&rsquo;으로 바뀝니다.</p>
          )}
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between pt-1">
          {fee.extras.length > 0 ? (
            <Button variant="danger" disabled={saving} onClick={() => confirm("추가요금을 모두 지울까요?") && save([])}>
              모두 지우기
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              취소
            </Button>
            <Button variant="primary" disabled={!valid} loading={saving} onClick={() => save(drafts)}>
              저장
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
