"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { propertyShortName } from "@/components/property-tabs";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Segmented, Spinner, Stat } from "@/components/ui";
import { addDays, formatDateTime, formatNumber, platformLabel } from "@/lib/format";
import type { Platform, SettlementFileCoverage } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useToday } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";

type Span = 8 | 12 | 26;
type CellState = "OK" | "WARN" | "STALE" | "MISSING" | "WAIT" | "NONE";

const PLATFORM_ORDER: Platform[] = ["DDNAYO", "YEOGI", "NOL", "DIRECT"];

const CELL_STYLE: Record<CellState, string> = {
  OK: "bg-emerald-500 text-white",
  WARN: "bg-emerald-500 text-white ring-2 ring-amber-400 ring-offset-1",
  STALE: "bg-amber-100 text-amber-800 ring-1 ring-amber-300",
  MISSING: "bg-rose-50 text-rose-600 ring-1 ring-rose-300 [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgb(254_205_211)_4px_5px)]",
  WAIT: "border border-dashed border-slate-400 bg-white text-slate-400",
  NONE: "bg-slate-50",
};

const CELL_LABEL: Record<CellState, string> = {
  OK: "업로드됨",
  WARN: "업로드됨 · 확인 필요 (미매핑·오류)",
  STALE: "새 행 없음 (모두 중복)",
  MISSING: "파일 없음",
  WAIT: "이번 주 (아직 없음)",
  NONE: "",
};

interface Account {
  key: string;
  platform: Platform;
  name: string;
  propertyId: number | null;
  firstWeek: string;
  files: SettlementFileCoverage[];
}

interface Picked {
  account: Account;
  week: string;
}

/** 그 날짜가 속한 주의 월요일 */
function weekOf(date: string): string {
  const day = new Date(date + "T00:00:00").getDay();
  return addDays(date, -((day + 6) % 7));
}

function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
}

export default function CoveragePage() {
  const { properties, error: propertyError } = useProperty();
  const { data, error, loading, reload } = useApi<SettlementFileCoverage[]>("/settlements/coverage");
  const today = useToday();
  const [span, setSpan] = useState<Span>(12);
  const [shift, setShift] = useState(0);
  const [picked, setPicked] = useState<Picked | null>(null);

  const currentWeek = today ? weekOf(today) : null;
  const lastWeek = currentWeek ? addDays(currentWeek, -7 * shift) : null;
  const weeks = useMemo(() => (lastWeek ? Array.from({ length: span }, (_, i) => addDays(lastWeek, -7 * (span - 1 - i))) : []), [lastWeek, span]);

  const accounts = useMemo(() => buildAccounts(data ?? []), [data]);

  const stateOf = (account: Account, week: string): { state: CellState; files: SettlementFileCoverage[] } => {
    const files = account.files.filter((f) => weekOf(f.issuedOn) === week);
    if (files.length) {
      if (files.every((f) => f.insertedRows === 0 && f.duplicateRows > 0)) return { state: "STALE", files };
      if (files.some((f) => f.unmappedRows + f.failedRows > 0)) return { state: "WARN", files };
      return { state: "OK", files };
    }
    if (!currentWeek || week < account.firstWeek || week > currentWeek) return { state: "NONE", files };
    if (week === currentWeek) return { state: "WAIT", files };
    return { state: "MISSING", files };
  };

  // 지금 보는 기간의 누락 (계정별)
  const missing = accounts
    .map((account) => ({ account, weeks: weeks.filter((w) => stateOf(account, w).state === "MISSING") }))
    .filter((m) => m.weeks.length);
  const missingCells = missing.reduce((s, m) => s + m.weeks.length, 0);
  const staleCells = accounts.reduce((s, a) => s + weeks.filter((w) => stateOf(a, w).state === "STALE").length, 0);
  const lastUpload = (data ?? []).reduce<string | null>((max, f) => (max === null || f.createdAt > max ? f.createdAt : max), null);

  const groups = useMemo(() => {
    const ids = [...properties.map((p) => p.id as number | null), null];
    return ids
      .map((id) => ({
        id,
        title: id === null ? "업소 미확인" : propertyShortName(properties.find((p) => p.id === id)!),
        fullName: id === null ? "정산 행이 없어 업소를 알 수 없는 파일" : properties.find((p) => p.id === id)!.name,
        accounts: accounts.filter((a) => a.propertyId === id),
      }))
      .filter((g) => g.accounts.length);
  }, [properties, accounts]);

  const pickedCell = picked ? stateOf(picked.account, picked.week) : null;

  return (
    <>
      <PageHeader
        title="정산 파일 현황"
        description="정산 계정마다 주별로 정산 파일이 올라왔는지 보여 줍니다. 빨간 빗금 칸이 빠진 주입니다."
        actions={
          <>
            <Button onClick={reload} loading={loading && !!data}>
              새로고침
            </Button>
            <Link href="/settlements/upload" className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-3.5 text-sm font-medium whitespace-nowrap text-white hover:bg-brand-700">
              파일 올리기
            </Link>
          </>
        }
      />

      {(propertyError || error) && (
        <div className="mb-4">
          <Alert>{propertyError || error}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="정산 계정" value={`${accounts.length}개`} hint={`업소 ${groups.filter((g) => g.id !== null).length}곳`} />
        <Stat label="빠진 주" value={<span className={missingCells ? "text-rose-600" : ""}>{missingCells}칸</span>} hint={`최근 ${span}주 기준`} />
        <Stat label="새 행 없는 파일" value={`${staleCells}칸`} hint="같은 파일을 다시 올렸을 수 있음" />
        <Stat label="마지막 업로드" value={lastUpload ? shortDate(lastUpload.slice(0, 10)) : "-"} hint={lastUpload ? formatDateTime(lastUpload) : undefined} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Span>
          value={span}
          onChange={(v) => {
            setSpan(v);
            setPicked(null);
          }}
          options={[
            { value: 8, label: "8주" },
            { value: 12, label: "12주" },
            { value: 26, label: "26주" },
          ]}
        />
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5">
          <button type="button" onClick={() => setShift(shift + span)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="이전 기간">
            ‹
          </button>
          <span className="min-w-28 text-center text-sm font-semibold">{weeks.length ? `${shortDate(weeks[0])} – ${shortDate(addDays(weeks[weeks.length - 1], 6))}` : ""}</span>
          <button
            type="button"
            onClick={() => setShift(Math.max(0, shift - span))}
            disabled={shift === 0}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            aria-label="다음 기간"
          >
            ›
          </button>
          {shift > 0 && (
            <button type="button" onClick={() => setShift(0)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
              이번 주
            </button>
          )}
        </div>
        {loading && <Spinner className="text-slate-400" />}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        {(["OK", "WARN", "STALE", "MISSING", "WAIT"] as CellState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`h-3.5 w-3.5 rounded ${CELL_STYLE[s]}`} />
            {CELL_LABEL[s]}
          </span>
        ))}
      </div>

      {data && !accounts.length ? (
        <Card>
          <EmptyState>아직 올린 정산 파일이 없습니다.</EmptyState>
        </Card>
      ) : (
        <Card className="mb-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 bg-white px-4 pt-3 pb-2 text-left text-xs font-medium text-slate-500">정산 계정</th>
                  {weeks.map((w, i) => {
                    const newMonth = i === 0 || w.slice(5, 7) !== weeks[i - 1].slice(5, 7);
                    return (
                      <th key={w} className="px-0.5 pt-3 pb-2 text-center text-[10px] font-medium whitespace-nowrap text-slate-400">
                        <span className={newMonth ? "font-semibold text-slate-600" : ""}>{newMonth ? `${Number(w.slice(5, 7))}월` : ""}</span>
                        <br />
                        <span className={w === currentWeek ? "font-semibold text-brand-600" : ""}>{Number(w.slice(8))}</span>
                      </th>
                    );
                  })}
                  <th className="w-full" />
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.id ?? "none"}>
                  <tr>
                    <td colSpan={weeks.length + 2} className="sticky left-0 border-t border-slate-100 bg-slate-50/70 px-4 py-1.5 text-xs font-semibold text-slate-600">
                      {group.title} <span className="font-normal text-slate-400">· {group.fullName}</span>
                    </td>
                  </tr>
                  {group.accounts.map((account) => (
                    <tr key={account.key}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Badge tone={account.platform === "NOL" ? "violet" : account.platform === "YEOGI" ? "red" : "blue"}>{platformLabel[account.platform]}</Badge>
                          <span className="max-w-44 truncate text-slate-700" title={account.name}>
                            {account.name}
                          </span>
                        </div>
                      </td>
                      {weeks.map((w) => {
                        const { state, files } = stateOf(account, w);
                        const active = picked?.account.key === account.key && picked.week === w;
                        return (
                          <td key={w} className="px-0.5 py-1.5">
                            <button
                              type="button"
                              disabled={state === "NONE"}
                              onMouseEnter={() => state !== "NONE" && setPicked({ account, week: w })}
                              onFocus={() => setPicked({ account, week: w })}
                              onClick={() => setPicked({ account, week: w })}
                              aria-label={`${account.name} ${shortDate(w)} 주: ${CELL_LABEL[state] || "해당 없음"}`}
                              className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold transition-transform ${CELL_STYLE[state]} ${
                                active ? "scale-110 outline-2 outline-offset-1 outline-slate-800" : state !== "NONE" ? "hover:scale-110" : ""
                              }`}
                            >
                              {state === "MISSING" ? "!" : files.length > 1 ? files.length : state === "OK" || state === "WARN" ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="min-h-20 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
            {picked && pickedCell ? (
              <CellDetail account={picked.account} week={picked.week} state={pickedCell.state} files={pickedCell.files} />
            ) : (
              <p className="text-slate-400">칸에 마우스를 올리거나 누르면 그 주의 파일이 여기에 나옵니다.</p>
            )}
          </div>
        </Card>
      )}

      {missing.length > 0 && (
        <Card className="mb-4 p-4">
          <p className="mb-2 text-sm font-semibold">
            빠진 주 <span className="font-normal text-slate-400">· 최근 {span}주</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {missing.map(({ account, weeks: ws }) => (
              <li key={account.key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium whitespace-nowrap">
                  {platformLabel[account.platform]} · {account.name}
                </span>
                <span className="text-slate-500">{ws.map((w) => `${shortDate(w)}주`).join(", ")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            판매가 없던 주에는 플랫폼이 정산 파일을 만들지 않을 수 있습니다. 플랫폼 관리자 화면에서 그 주에 정산이 있었는지 확인해 주세요.
          </p>
        </Card>
      )}

      <p className="text-xs text-slate-400">
        정산 계정과 정산일은 파일명에서 읽습니다 (떠나요·여기어때 <code>정산내역_업소명_날짜</code>, NOL <code>정산상세내역_업소_계정_MMdd</code>). 파일명을 바꾸면
        계정을 알 수 없어 &lsquo;계정 미확인&rsquo;으로 묶입니다. 정산일이 속한 주(월요일 시작)에 표시합니다.
      </p>
    </>
  );
}

function CellDetail({ account, week, state, files }: { account: Account; week: string; state: CellState; files: SettlementFileCoverage[] }) {
  return (
    <div>
      <p className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {platformLabel[account.platform]} · {account.name}
        </span>
        <span className="text-slate-500">
          {shortDate(week)} – {shortDate(addDays(week, 6))} 주
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className={`h-3 w-3 rounded ${CELL_STYLE[state]}`} />
          {CELL_LABEL[state]}
        </span>
      </p>
      {files.length ? (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.importBatchId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-600">
              <span className="max-w-full truncate text-slate-800">{f.fileName}</span>
              <span className="text-xs whitespace-nowrap">정산일 {shortDate(f.issuedOn)}</span>
              <span className="text-xs whitespace-nowrap">
                {formatNumber(f.totalRows)}행 · 신규 {f.insertedRows}
                {f.duplicateRows > 0 && ` · 중복 ${f.duplicateRows}`}
                {f.unmappedRows > 0 && <span className="text-amber-700"> · 미매핑 {f.unmappedRows}</span>}
                {f.failedRows > 0 && <span className="text-rose-600"> · 오류 {f.failedRows}</span>}
              </span>
              <span className="text-xs whitespace-nowrap text-slate-400">업로드 {formatDateTime(f.createdAt)}</span>
            </li>
          ))}
        </ul>
      ) : state === "MISSING" ? (
        <p className="text-slate-500">
          이 주의 정산 파일이 없습니다.{" "}
          <Link href="/settlements/upload" className="font-medium text-brand-700 underline-offset-2 hover:underline">
            파일 올리기
          </Link>
        </p>
      ) : (
        <p className="text-slate-500">이번 주 정산 파일은 아직 올라오지 않았습니다.</p>
      )}
      {files.some((f) => !f.issuedOnFromFileName) && <p className="mt-1 text-xs text-slate-400">파일명에서 정산일을 읽지 못해 정산 행·업로드일로 추정했습니다.</p>}
    </div>
  );
}

function buildAccounts(files: SettlementFileCoverage[]): Account[] {
  const map = new Map<string, Account>();
  files.forEach((f) => {
    const name = f.account ?? "계정 미확인";
    const key = `${f.platform}|${name}`;
    const account = map.get(key) ?? { key, platform: f.platform, name, propertyId: f.propertyId, firstWeek: weekOf(f.issuedOn), files: [] };
    account.files.push(f);
    if (weekOf(f.issuedOn) < account.firstWeek) account.firstWeek = weekOf(f.issuedOn);
    if (account.propertyId === null) account.propertyId = f.propertyId;
    map.set(key, account);
  });
  return [...map.values()].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform) || a.name.localeCompare(b.name, "ko"),
  );
}
