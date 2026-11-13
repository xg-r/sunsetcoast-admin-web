"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Segmented, Spinner } from "@/components/ui";
import { formatDateTime, platformLabel } from "@/lib/format";
import type { ImportBatch, Platform } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Filter = "ALL" | Platform | "ATTENTION";

export default function HistoryPage() {
  const { data, error, loading, reload } = useApi<ImportBatch[]>("/settlements/import-batches");
  const [filter, setFilter] = useState<Filter>("ALL");

  const rows = useMemo(() => {
    const all = data ?? [];
    if (filter === "ALL") return all;
    if (filter === "ATTENTION") return all.filter((b) => b.changedRows + b.unmappedRows + b.failedRows > 0);
    return all.filter((b) => b.platform === filter);
  }, [data, filter]);

  return (
    <>
      <PageHeader
        title="업로드 내역"
        description="최근 올린 파일 200개입니다."
        actions={
          <Button onClick={reload} loading={loading && !!data}>
            새로고침
          </Button>
        }
      />

      <div className="mb-4 overflow-x-auto">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "ALL", label: "전체" },
            { value: "DDNAYO", label: "떠나요" },
            { value: "YEOGI", label: "여기어때" },
            { value: "NOL", label: "NOL" },
            { value: "ATTENTION", label: "확인 필요" },
          ]}
        />
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card className="overflow-hidden">
        {!data && loading ? (
          <EmptyState>
            <Spinner />
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState>업로드 내역이 없습니다.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="whitespace-nowrap border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">업로드 시각</th>
                  <th className="px-4 py-2.5 font-medium">플랫폼</th>
                  <th className="px-4 py-2.5 font-medium">파일</th>
                  <th className="px-3 py-2.5 text-right font-medium">전체</th>
                  <th className="px-3 py-2.5 text-right font-medium">신규</th>
                  <th className="px-3 py-2.5 text-right font-medium">중복</th>
                  <th className="px-4 py-2.5 font-medium">확인 필요</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDateTime(b.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <Badge>{platformLabel[b.platform]}</Badge>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5" title={b.fileName}>
                      {b.fileName}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{b.totalRows}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{b.insertedRows || <span className="text-slate-300">0</span>}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{b.duplicateRows || <span className="text-slate-300">0</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {b.changedRows > 0 && <Badge tone="violet">변경 {b.changedRows}</Badge>}
                        {b.unmappedRows > 0 && <Badge tone="orange">미매핑 {b.unmappedRows}</Badge>}
                        {b.failedRows > 0 && <Badge tone="red">실패 {b.failedRows}</Badge>}
                        {b.changedRows + b.unmappedRows + b.failedRows === 0 && <span className="text-slate-300">-</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
