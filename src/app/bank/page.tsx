"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarList, ColumnChart } from "@/components/charts";
import { MonthPicker } from "@/components/month-picker";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatMonth, formatWon, platformLabel, shiftMonth } from "@/lib/format";
import { ownerLabel } from "@/components/scope-filters";
import type { BankAccount, BankAnalysis, BankCategoryInfo, BankUpload, BusinessOwner, ImportJobsCreated } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useImportJobs } from "@/lib/use-import-jobs";
import { useMonth } from "@/lib/use-month";

type Range = 1 | 3 | 6 | 12;

const insightStyle = {
  GOOD: { tone: "green" as const, label: "좋음", icon: "✓" },
  INFO: { tone: "blue" as const, label: "참고", icon: "i" },
  WARN: { tone: "orange" as const, label: "확인", icon: "!" },
};

export default function BankPage() {
  const { data: accounts, reload: reloadAccounts } = useApi<BankAccount[]>("/bank/accounts");
  const { data: categories } = useApi<BankCategoryInfo[]>("/bank/categories");
  const { data: uploads, reload: reloadUploads } = useApi<BankUpload[]>("/bank/uploads");
  const { data: owners } = useApi<BusinessOwner[]>("/business-owners");
  const ownerName = (id: number | null) => {
    const owner = owners?.find((o) => o.id === id);
    return owner ? ownerLabel(owner.name) : null;
  };
  const [accountId, setAccountId] = useState<number | null>(null);
  const [month, setMonth] = useMonth();
  const [range, setRange] = useState<Range>(6);
  const [refresh, setRefresh] = useState(0);

  const account = accounts?.find((a) => a.id === accountId) ?? accounts?.[0] ?? null;
  const from = month ? shiftMonth(month, -(range - 1)) : null;
  const { data, error, loading } = useApi<BankAnalysis>(
    account && month && from ? `/bank/analysis?accountId=${account.id}&from=${from}&to=${month}` : null,
    refresh,
  );
  const categoryInfo = useMemo(() => new Map((categories ?? []).map((c) => [c.code, c])), [categories]);

  const afterChange = useCallback(() => {
    reloadAccounts();
    reloadUploads();
    setRefresh((n) => n + 1);
  }, [reloadAccounts, reloadUploads]);

  const active = data?.months.filter((m) => m.transactionCount > 0) ?? [];
  const totals = data && {
    deposits: data.months.reduce((s, m) => s + m.deposits, 0),
    withdrawals: data.months.reduce((s, m) => s + m.withdrawals, 0),
    revenue: data.months.reduce((s, m) => s + m.revenue, 0),
    expense: data.months.reduce((s, m) => s + m.expense, 0),
    closing: [...data.months].reverse().find((m) => m.closingBalance !== null)?.closingBalance ?? null,
  };
  const deduction = data?.categories.find((c) => c.category === "AFFILIATE_SETTLEMENT_OUT") ?? null;
  const byGroup = (group: string) =>
    (data?.categories ?? [])
      .filter((c) => categoryInfo.get(c.category)?.group === group && c.category !== "AFFILIATE_SETTLEMENT_OUT")
      .map((c) => ({
        key: c.category,
        label: categoryInfo.get(c.category)?.label ?? c.category,
        value: c.amount,
        hint: c.share !== null ? `${c.share}% · ${c.count}건` : `${c.count}건`,
      }));

  return (
    <>
      <PageHeader
        title="계좌 분석"
        description="은행에서 받은 거래내역 엑셀을 매달 올리면 현금흐름·비용 구조를 보여 주고, OTA 입금과 정산 파일, 관리비 출금과 계산된 관리비를 맞춰 봅니다."
        actions={
          <Link href="/bank/transactions" className="text-sm font-medium text-brand-700 hover:underline">
            거래 목록·분류 고치기 →
          </Link>
        }
      />

      <UploadCard owners={(owners ?? []).filter((o) => o.ownershipType === "FAMILY")} onDone={afterChange} />

      {accounts && accounts.length === 0 ? (
        <Card className="mt-5">
          <EmptyState>아직 올린 거래내역이 없습니다. 위에서 은행 엑셀 파일을 올려 주세요.</EmptyState>
        </Card>
      ) : (
        <>
          <div className="mb-5 mt-6 flex flex-wrap items-center gap-3">
            {accounts && accounts.length > 1 && (
              <select
                value={account?.id ?? ""}
                onChange={(e) => setAccountId(Number(e.target.value))}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {ownerName(a.businessOwnerId) ?? a.holderName ?? "계좌"} {a.accountNumber}
                  </option>
                ))}
              </select>
            )}
            {account && accounts?.length === 1 && (
              <span className="text-sm text-slate-600">
                {ownerName(account.businessOwnerId) ?? account.holderName} <span className="text-slate-400">{account.accountNumber}</span>
              </span>
            )}
            <MonthPicker month={month} onChange={setMonth} />
            <Segmented<Range>
              value={range}
              onChange={setRange}
              options={[
                { value: 1, label: "1개월" },
                { value: 3, label: "3개월" },
                { value: 6, label: "6개월" },
                { value: 12, label: "12개월" },
              ]}
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
          ) : data && totals ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="매출성 입금" value={formatWon(totals.revenue)} hint={`전체 입금 ${formatWon(totals.deposits)}`} />
                <Stat label="운영비 출금" value={formatWon(totals.expense)} hint={`전체 출금 ${formatWon(totals.withdrawals)}`} />
                <Stat
                  label="순현금흐름"
                  value={`${totals.deposits - totals.withdrawals >= 0 ? "+" : ""}${formatWon(totals.deposits - totals.withdrawals)}`}
                  hint={from && month ? `${formatMonth(from)} ~ ${formatMonth(month)}` : undefined}
                />
                <Stat label="기말 잔액" value={formatWon(totals.closing)} hint={active.length ? `거래 있는 달 ${active.length}개` : "거래 없음"} />
              </div>

              {data.insights.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-3 text-sm font-semibold">인사이트</h2>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {data.insights.map((i) => (
                      <li key={i.title} className="flex gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                        <span className="mt-0.5">
                          <Badge tone={insightStyle[i.level].tone}>
                            {insightStyle[i.level].icon} {insightStyle[i.level].label}
                          </Badge>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{i.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{i.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold">월별 입금·출금</h2>
                <ColumnChart
                  ariaLabel="월별 입금과 출금"
                  categories={data.months.map((m) => `${Number(m.month.slice(5))}월`)}
                  series={[
                    { key: "in", label: "입금", values: data.months.map((m) => (m.transactionCount ? m.deposits : null)) },
                    { key: "out", label: "출금", values: data.months.map((m) => (m.transactionCount ? m.withdrawals : null)) },
                  ]}
                  formatValue={formatWon}
                />
                <MonthTable data={data} />
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="mb-1 text-sm font-semibold">매출 구성</h2>
                  <p className="mb-4 text-xs text-slate-500">OTA 정산·카드 매출·관계사 정산 입금. 비율은 들어온 매출 합계 대비</p>
                  {byGroup("REVENUE").length ? <BarList items={byGroup("REVENUE")} formatValue={formatWon} /> : <p className="text-sm text-slate-400">없음</p>}
                  {deduction && (
                    <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                      <span className="text-slate-600">관계사 정산 지급 (매출 차감)</span>
                      <span className="font-medium text-slate-800">−{formatWon(deduction.amount)}</span>
                    </p>
                  )}
                </Card>
                <Card className="p-5">
                  <h2 className="mb-1 text-sm font-semibold">비용 구조</h2>
                  <p className="mb-4 text-xs text-slate-500">운영비 출금. 분류가 틀리면 거래 목록에서 고치세요</p>
                  {byGroup("EXPENSE").length ? <BarList items={byGroup("EXPENSE")} formatValue={formatWon} /> : <p className="text-sm text-slate-400">없음</p>}
                </Card>
              </div>

              <Card className="overflow-hidden">
                <div className="px-5 pt-5">
                  <h2 className="text-sm font-semibold">OTA 입금 ↔ 정산 파일</h2>
                  <p className="mt-1 text-xs text-slate-500">입금액과 금액이 똑같은 정산 파일(정산일 ±10일)을 찾습니다.</p>
                </div>
                {data.otaDeposits.length === 0 ? (
                  <EmptyState>이 기간에 OTA 입금이 없습니다.</EmptyState>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="whitespace-nowrap border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                          <th className="px-5 py-2 font-medium">입금일</th>
                          <th className="px-4 py-2 font-medium">플랫폼</th>
                          <th className="px-4 py-2 text-right font-medium">입금액</th>
                          <th className="px-4 py-2 font-medium">정산 파일</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.otaDeposits.map((o) => (
                          <tr key={o.transactionId}>
                            <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">{formatDate(o.transactedAt.slice(0, 10))}</td>
                            <td className="px-4 py-2.5">
                              <Badge>{platformLabel[o.platform]}</Badge>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">{formatWon(o.amount)}</td>
                            <td className="px-4 py-2.5">
                              {o.importBatchId ? (
                                <span className="text-slate-700">
                                  <Badge tone="green">✓ 일치</Badge>{" "}
                                  <span className="text-xs text-slate-500">
                                    {o.settlementAccount ?? o.fileName} · 정산일 {o.issuedOn && formatDate(o.issuedOn)}
                                  </span>
                                </span>
                              ) : (
                                <span>
                                  <Badge tone="orange">! 파일 없음</Badge>{" "}
                                  <Link href="/settlements/coverage" className="text-xs text-brand-700 hover:underline">
                                    파일 현황 확인
                                  </Link>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {data.feeComparisons.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="px-5 pt-5">
                    <h2 className="text-sm font-semibold">관리비 출금 ↔ 계산된 관리비</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      거래내용의 &lsquo;N월&rsquo;로 어느 달 관리비인지 봅니다. 일치하면 관리비 화면에서 그 달을 입금 완료로 표시하세요.
                    </p>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="whitespace-nowrap border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                          <th className="px-5 py-2 font-medium">관리비 월</th>
                          <th className="px-4 py-2 font-medium">출금</th>
                          <th className="px-4 py-2 text-right font-medium">출금 합계</th>
                          <th className="px-4 py-2 text-right font-medium">계산</th>
                          <th className="px-4 py-2 font-medium">결과</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.feeComparisons.map((f) => (
                          <tr key={f.feeMonth}>
                            <td className="whitespace-nowrap px-5 py-2.5 font-medium">{formatMonth(f.feeMonth)}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">
                              {f.withdrawals.map((w) => (
                                <p key={w.id}>
                                  {w.description} {formatWon(w.withdrawal)}
                                </p>
                              ))}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">{formatWon(f.withdrawnTotal)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right">{formatWon(f.calculatedTotal)}</td>
                            <td className="px-4 py-2.5">
                              {f.calculatedTotal === null ? (
                                <span className="text-xs text-slate-500">비교할 관리비 데이터 없음</span>
                              ) : f.difference === 0 ? (
                                <span>
                                  <Badge tone="green">✓ 일치</Badge>{" "}
                                  <Link href={`/management-fees?month=${f.feeMonth}`} className="text-xs text-brand-700 hover:underline">
                                    {f.unpaidCount ? `미입금 ${f.unpaidCount}건 표시하러 가기` : "관리비 화면"}
                                  </Link>
                                </span>
                              ) : (
                                <span>
                                  <Badge tone="orange">! 차이 {formatWon(Math.abs(f.difference ?? 0))}</Badge>{" "}
                                  <Link href={`/management-fees?month=${f.feeMonth}`} className="text-xs text-brand-700 hover:underline">
                                    관리비 확인
                                  </Link>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          ) : null}

          <UploadHistory uploads={uploads ?? []} onDeleted={afterChange} />
        </>
      )}
    </>
  );
}

function MonthTable({ data }: { data: BankAnalysis }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-slate-500">표로 보기</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="whitespace-nowrap border-b border-slate-200 text-left text-xs text-slate-500">
            <tr>
              <th className="py-2 pr-4 font-medium">월</th>
              <th className="px-3 py-2 text-right font-medium">기초 잔액</th>
              <th className="px-3 py-2 text-right font-medium">입금</th>
              <th className="px-3 py-2 text-right font-medium">출금</th>
              <th className="px-3 py-2 text-right font-medium">순현금흐름</th>
              <th className="px-3 py-2 text-right font-medium">기말 잔액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.months.map((m) => (
              <tr key={m.month} className={m.transactionCount ? "" : "text-slate-300"}>
                <td className="whitespace-nowrap py-2 pr-4">{formatMonth(m.month)}</td>
                <td className="px-3 py-2 text-right">{formatWon(m.openingBalance)}</td>
                <td className="px-3 py-2 text-right">{formatWon(m.deposits)}</td>
                <td className="px-3 py-2 text-right">{formatWon(m.withdrawals)}</td>
                <td className="px-3 py-2 text-right">{formatWon(m.net)}</td>
                <td className="px-3 py-2 text-right">{formatWon(m.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function UploadCard({ owners, onDone }: { owners: BusinessOwner[]; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rejected, setRejected] = useState<ImportJobsCreated["rejected"]>([]);
  const [error, setError] = useState<string | null>(null);
  const { jobs, finished, error: pollError, track, clear } = useImportJobs("bank-import-jobs");
  const reported = useRef(false);

  // 작업이 모두 끝나면 분석을 다시 읽는다
  useEffect(() => {
    if (finished && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [finished, onDone]);

  const upload = async (files: FileList | null) => {
    if (!files?.length || ownerId === null) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    setUploading(true);
    setError(null);
    try {
      const created = await api.post<ImportJobsCreated>(`/bank/import-jobs?businessOwnerId=${ownerId}`, form);
      setRejected(created.rejected);
      reported.current = false;
      track(created.jobs.map((j) => j.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">거래내역 올리기</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            인터넷뱅킹 &lsquo;거래내역조회&rsquo;에서 받은 엑셀(.xlsx). 기간이 겹쳐도 이미 올린 거래는 건너뜁니다. 서버에서 처리하고, 실패하면 알림으로 알려 드립니다.
          </p>
        </div>
        <Button variant="primary" loading={uploading} disabled={ownerId === null} onClick={() => input.current?.click()}>
          파일 선택
        </Button>
        <input ref={input} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      </div>
      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-slate-600">어느 사업자의 계좌인가요?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {owners.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                ownerId === o.id ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name="bank-owner" value={o.id} checked={ownerId === o.id} onChange={() => setOwnerId(o.id)} className="accent-brand-600" />
              {ownerLabel(o.name)}
            </label>
          ))}
        </div>
        {ownerId === null && <p className="mt-2 text-xs text-slate-400">사업자를 고르면 파일을 선택할 수 있습니다.</p>}
      </fieldset>
      {(error || pollError) && (
        <div className="mt-3">
          <Alert>{error ?? pollError}</Alert>
        </div>
      )}
      {rejected.length > 0 && (
        <div className="mt-3">
          <Alert tone="orange">접수하지 않은 파일: {rejected.map((r) => `${r.fileName} (${r.message})`).join(", ")}</Alert>
        </div>
      )}
      {jobs.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <span className="font-medium">{j.fileName}</span>{" "}
              {j.status === "QUEUED" && <Badge>대기</Badge>}
              {j.status === "RUNNING" && <Badge tone="blue">처리 중</Badge>}
              {j.status === "SUCCEEDED" && j.bank && (
                <span className="text-slate-600">
                  · 새 거래 {j.bank.insertedRows}건{j.bank.duplicateRows > 0 && `, 이미 있던 거래 ${j.bank.duplicateRows}건 건너뜀`}
                </span>
              )}
              {j.status === "FAILED" && <span className="text-rose-600">· {j.errorMessage}</span>}
              {j.bank && j.bank.balanceBreaks.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  잔액이 이어지지 않는 곳 {j.bank.balanceBreaks.length}곳 (빠진 거래가 있을 수 있음): {j.bank.balanceBreaks.slice(0, 2).join(" / ")}
                </p>
              )}
            </li>
          ))}
          {finished && (
            <li className="text-right">
              <Button variant="ghost" size="sm" onClick={() => { clear(); setRejected([]); }}>
                닫기
              </Button>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

function UploadHistory({ uploads, onDeleted }: { uploads: BankUpload[]; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (uploads.length === 0) return null;

  const remove = async (u: BankUpload) => {
    if (!confirm(`'${u.fileName}' 업로드를 삭제할까요?\n이 업로드로 새로 들어온 거래 ${u.insertedRows}건이 지워집니다.`)) return;
    setDeleting(u.id);
    setError(null);
    try {
      await api.delete(`/bank/uploads/${u.id}`);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card className="mt-5 overflow-hidden">
      <h2 className="px-5 pt-5 text-sm font-semibold">올린 파일</h2>
      {error && (
        <div className="px-5 pt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="whitespace-nowrap border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-5 py-2 font-medium">올린 시각</th>
              <th className="px-4 py-2 font-medium">파일</th>
              <th className="px-4 py-2 font-medium">거래 기간</th>
              <th className="px-3 py-2 text-right font-medium">새 거래</th>
              <th className="px-3 py-2 text-right font-medium">건너뜀</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {uploads.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap px-5 py-2 text-slate-500">{formatDateTime(u.createdAt)}</td>
                <td className="max-w-xs truncate px-4 py-2" title={u.fileName}>
                  {u.fileName}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                  {u.periodFrom && formatDate(u.periodFrom.slice(0, 10))} ~ {u.periodTo && formatDate(u.periodTo.slice(0, 10))}
                </td>
                <td className="px-3 py-2 text-right">{u.insertedRows}</td>
                <td className="px-3 py-2 text-right text-slate-400">{u.duplicateRows}</td>
                <td className="px-4 py-1.5 text-right">
                  <Button variant="danger" size="sm" loading={deleting === u.id} disabled={deleting !== null} onClick={() => remove(u)}>
                    삭제
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
