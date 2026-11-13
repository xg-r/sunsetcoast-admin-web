"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { notifyUnmappedChanged } from "@/lib/events";
import { formatNumber, platformLabel } from "@/lib/format";
import type { FileImportResult, ImportCounts, RowResult, SettlementImportResponse } from "@/lib/types";

const ACCEPT = ".xlsx,.xls,.csv";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState<"preview" | "import" | null>(null);
  const [result, setResult] = useState<SettlementImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    setFiles((prev) => [...prev, ...incoming.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
    setResult(null);
  };

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? "preview" : "import");
    setError(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const response = await api.post<SettlementImportResponse>(`/settlements/import?dryRun=${dryRun}`, form);
      setResult(response);
      if (!dryRun) {
        setFiles([]);
        notifyUnmappedChanged();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  return (
    <>
      <PageHeader
        title="정산 파일 업로드"
        description="떠나요·여기어때·NOL 정산 파일을 한 번에 올립니다. 플랫폼은 파일 내용으로 자동 판별하고, 이미 올린 파일이나 행은 중복으로 걸러집니다."
      />

      <Card className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <svg className="h-8 w-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 text-sm font-medium">파일을 끌어다 놓거나 클릭해서 선택하세요</p>
          <p className="mt-1 text-xs text-slate-500">xlsx, xls, csv · 여러 개 선택 가능</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">선택한 파일 {files.length}개</p>
              <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                모두 지우기
              </Button>
            </div>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {files.map((file) => (
                <li key={file.name + file.size} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                    {(file.size / 1024).toFixed(0)}KB
                    <button
                      type="button"
                      className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => setFiles((prev) => prev.filter((f) => f !== file))}
                      aria-label={`${file.name} 빼기`}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">미리보기는 저장하지 않고 신규·중복·확인 필요 건수만 계산합니다.</p>
          <div className="flex gap-2">
            <Button disabled={!files.length || running !== null} loading={running === "preview"} onClick={() => run(true)}>
              미리보기
            </Button>
            <Button variant="primary" disabled={!files.length || running !== null} loading={running === "import"} onClick={() => run(false)}>
              업로드
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {result && <ImportResult result={result} />}
    </>
  );
}

function ImportResult({ result }: { result: SettlementImportResponse }) {
  const totals = sumCounts(result.files);
  const rejected = result.files.filter((f) => f.status === "REJECTED").length;
  const attention = totals.changedRows + totals.unmappedRows + totals.failedRows;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{result.dryRun ? "미리보기 결과" : "업로드 결과"}</h2>
        {result.dryRun ? <Badge tone="blue">저장 안 됨</Badge> : <Badge tone="green">저장됨</Badge>}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="파일" value={`${result.files.length - rejected} / ${result.files.length}`} hint={rejected ? `${rejected}개 거부` : "모두 처리"} />
        <MiniStat label="신규 행" value={formatNumber(totals.insertedRows)} />
        <MiniStat label="중복 행" value={formatNumber(totals.duplicateRows)} hint="이미 있는 행, 건너뜀" />
        <MiniStat label="확인 필요" value={formatNumber(attention)} tone={attention ? "warn" : undefined} hint="변경·미매핑·실패" />
      </div>

      {result.dryRun && result.files.length > 1 && (
        <div className="mb-4">
          <Alert tone="blue">미리보기는 파일마다 따로 계산해서, 같이 올린 다른 파일과 겹치는 행은 신규로 보일 수 있습니다. 실제 업로드에서는 중복으로 걸러집니다.</Alert>
        </div>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {result.files.map((file, index) => (
            <FileRow key={index} file={file} />
          ))}
        </ul>
      </Card>

      {!result.dryRun && totals.unmappedRows > 0 && (
        <div className="mt-4">
          <Alert tone="orange">
            객실을 찾지 못한 행 {totals.unmappedRows}개는 저장되지 않았습니다.{" "}
            <Link href="/settlements/unmapped" className="font-semibold underline">
              객실 지정하러 가기
            </Link>
          </Alert>
        </div>
      )}

      {!result.dryRun && (
        <p className="mt-3 text-sm text-slate-500">
          관리비와 성수기 판단은 업로드와 함께 다시 계산됩니다.{" "}
          <Link href="/settlements/history" className="font-medium text-brand-700 hover:underline">
            업로드 내역 보기
          </Link>
        </p>
      )}
    </section>
  );
}

function FileRow({ file }: { file: FileImportResult }) {
  const [open, setOpen] = useState(file.issues.length > 0 && file.issues.length <= 5);
  const status = {
    IMPORTED: <Badge tone="green">반영</Badge>,
    PREVIEW: <Badge tone="blue">미리보기</Badge>,
    REJECTED: <Badge tone="red">거부</Badge>,
  }[file.status];

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {status}
          {file.platform && <Badge>{platformLabel[file.platform]}</Badge>}
          <span className="truncate text-sm font-medium" title={file.fileName}>
            {file.fileName}
          </span>
        </div>
        {file.status !== "REJECTED" && <Counts counts={file} />}
      </div>
      {file.message && <p className="mt-1.5 text-sm text-rose-600">{file.message}</p>}
      {file.issues.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-amber-700 hover:underline">
            확인이 필요한 행 {file.issues.length}개 {open ? "접기" : "보기"}
          </button>
          {open && (
            <ul className="mt-2 space-y-1 rounded-lg bg-amber-50/60 p-3">
              {file.issues.map((issue) => (
                <li key={issue.rowNo} className="flex gap-2 text-xs">
                  <span className="w-12 shrink-0 text-slate-500">{issue.rowNo}행</span>
                  <IssueBadge result={issue.result} />
                  <span className="text-slate-700">{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function Counts({ counts }: { counts: ImportCounts }) {
  const items: [string, number, string][] = [
    ["신규", counts.insertedRows, "text-emerald-700"],
    ["중복", counts.duplicateRows, "text-slate-500"],
    ["변경", counts.changedRows, "text-amber-700"],
    ["건너뜀", counts.skippedRows, "text-slate-500"],
    ["미매핑", counts.unmappedRows, "text-amber-700"],
    ["실패", counts.failedRows, "text-rose-700"],
  ];
  return (
    <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
      {items
        .filter(([, n], i) => n > 0 || i === 0)
        .map(([label, n, color]) => (
          <span key={label}>
            {label} <span className={`font-semibold ${n > 0 ? color : ""}`}>{n}</span>
          </span>
        ))}
      <span>/ 전체 {counts.totalRows}</span>
    </div>
  );
}

function IssueBadge({ result }: { result: RowResult }) {
  const map: Partial<Record<RowResult, [string, "orange" | "red" | "violet"]>> = {
    CHANGED: ["금액 변경", "violet"],
    UNMAPPED: ["객실 미매핑", "orange"],
    FAILED: ["실패", "red"],
  };
  const [label, tone] = map[result] ?? [result, "orange"];
  return <Badge tone={tone}>{label}</Badge>;
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

function sumCounts(files: ImportCounts[]): ImportCounts {
  const keys: (keyof ImportCounts)[] = ["totalRows", "insertedRows", "duplicateRows", "changedRows", "skippedRows", "unmappedRows", "failedRows"];
  return Object.fromEntries(keys.map((k) => [k, files.reduce((sum, f) => sum + f[k], 0)])) as unknown as ImportCounts;
}
