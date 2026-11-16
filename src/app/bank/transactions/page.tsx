"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatWon } from "@/lib/format";
import type { BankAccount, BankCategoryInfo, BankTransaction } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";

interface Rule {
  id: number;
  keyword: string;
  direction: "IN" | "OUT" | "ANY";
  category: string;
}

export default function BankTransactionsPage() {
  const { data: accounts } = useApi<BankAccount[]>("/bank/accounts");
  const { data: categories } = useApi<BankCategoryInfo[]>("/bank/categories");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [month, setMonth] = useMonth();
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const account = accounts?.find((a) => a.id === accountId) ?? accounts?.[0] ?? null;
  const { data, loading, error: loadError } = useApi<BankTransaction[]>(
    account && month ? `/bank/transactions?accountId=${account.id}&month=${month}` : null,
    refresh,
  );
  const { data: rules } = useApi<Rule[]>("/bank/rules", refresh);
  const info = useMemo(() => new Map((categories ?? []).map((c) => [c.code, c])), [categories]);
  const rows = useMemo(() => [...(data ?? [])].reverse(), [data]);

  const change = async (tx: BankTransaction, category: string) => {
    const label = info.get(category)?.label ?? category;
    const similar = confirm(
      `'${tx.description}' 거래를 '${label}'(으)로 바꿉니다.\n\n` +
        `확인: 같은 거래내용의 다른 거래와 앞으로 올릴 거래도 '${label}'(으)로 분류 (규칙 저장)\n취소: 이 거래만 바꾸기`,
    );
    setSaving(tx.id);
    setError(null);
    setNotice(null);
    try {
      const res = await api.put<{ changed: number }>(`/bank/transactions/${tx.id}/category`, { category, applyToSimilar: similar });
      setNotice(similar ? `규칙을 저장했습니다. 거래 ${res.changed}건의 분류가 바뀌었습니다.` : `'${tx.description}' 거래 하나를 '${label}'(으)로 바꿨습니다.`);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const removeRule = async (rule: Rule) => {
    if (!confirm(`'${rule.keyword}' 규칙을 지울까요? 이 규칙으로 분류된 거래는 기본 분류로 돌아갑니다.`)) return;
    try {
      const res = await api.delete<{ changed: number }>(`/bank/rules/${rule.id}`);
      setNotice(`규칙을 지웠습니다. 거래 ${res.changed}건의 분류가 바뀌었습니다.`);
      setRefresh((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, BankCategoryInfo[]>();
    (categories ?? []).forEach((c) => groups.set(c.groupLabel, [...(groups.get(c.groupLabel) ?? []), c]));
    return [...groups.entries()];
  }, [categories]);

  return (
    <>
      <PageHeader
        title="계좌 거래 목록"
        description="거래마다 자동으로 분류합니다. 틀린 분류를 고치면 같은 거래내용에 규칙으로 저장해 다음부터 자동 적용할 수 있습니다."
        actions={
          <Link href="/bank" className="text-sm font-medium text-brand-700 hover:underline">
            ← 계좌 분석
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {accounts && accounts.length > 1 && (
          <select
            value={account?.id ?? ""}
            onChange={(e) => setAccountId(Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.holderName ?? "계좌"} {a.accountNumber}
              </option>
            ))}
          </select>
        )}
        <MonthPicker month={month} onChange={setMonth} />
        {loading && data && <Spinner className="text-slate-400" />}
      </div>

      {(error || loadError) && (
        <div className="mb-4">
          <Alert>{error ?? loadError}</Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="blue">{notice}</Alert>
        </div>
      )}

      <Card className="overflow-hidden">
        {!data && loading ? (
          <EmptyState>
            <Spinner />
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>{accounts?.length === 0 ? "아직 올린 거래내역이 없습니다." : "이 달 거래가 없습니다."}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">거래일시</th>
                  <th className="px-4 py-2.5 font-medium">거래내용</th>
                  <th className="px-3 py-2.5 text-right font-medium">입금</th>
                  <th className="px-3 py-2.5 text-right font-medium">출금</th>
                  <th className="px-3 py-2.5 text-right font-medium">잔액</th>
                  <th className="px-4 py-2.5 font-medium">분류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDateTime(tx.transactedAt)}</td>
                    <td className="px-4 py-2">
                      <p className="text-slate-800">{tx.description}</p>
                      <p className="text-xs text-slate-400">{[tx.counterpartyName, tx.counterpartyBank, tx.transactionType].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-sky-700">{tx.deposit ? formatWon(tx.deposit) : ""}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{tx.withdrawal ? formatWon(tx.withdrawal) : ""}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-slate-500">{formatWon(tx.balance)}</td>
                    <td className="whitespace-nowrap px-4 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={tx.category}
                          disabled={saving === tx.id}
                          onChange={(e) => change(tx, e.target.value)}
                          className="h-8 rounded-md border border-slate-300 bg-white px-1.5 text-sm"
                        >
                          {grouped.map(([group, list]) => (
                            <optgroup key={group} label={group}>
                              {list.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {tx.categorySource === "MANUAL" && <Badge tone="violet">직접</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rules && rules.length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="mb-3 text-sm font-semibold">저장한 분류 규칙</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span>
                  &lsquo;{r.keyword}&rsquo; {r.direction === "IN" ? "입금" : r.direction === "OUT" ? "출금" : ""} →{" "}
                  <span className="font-medium">{info.get(r.category)?.label ?? r.category}</span>
                </span>
                <Button variant="danger" size="sm" onClick={() => removeRule(r)}>
                  삭제
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
