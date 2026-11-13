"use client";

import { useMemo, useState } from "react";
import { MonthPicker } from "@/components/month-picker";
import { PropertyTabs } from "@/components/property-tabs";
import { Alert, Badge, Button, Card, Modal, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import type { SeasonDay } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { useMonth } from "@/lib/use-month";
import { useProperty } from "@/lib/use-property";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function StayCalendarPage() {
  const { properties, propertyId, select, error: propertyError } = useProperty();
  const [month, setMonth] = useMonth();
  const [selected, setSelected] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { from, to, cells } = useMemo(() => (month ? buildMonth(month) : { from: "", to: "", cells: [] }), [month]);
  const { data, error, loading, reload } = useApi<SeasonDay[]>(
    propertyId === null || month === null ? null : `/stay-calendar/season-days?propertyId=${propertyId}&from=${from}&to=${to}`,
  );
  const byDate = useMemo(() => new Map((data ?? []).map((d) => [d.stayDate, d])), [data]);

  const summary = useMemo(() => {
    const days = cells.filter((c): c is string => c !== null).map((date) => byDate.get(date));
    return {
      peak: days.filter((d) => d?.peak === true).length,
      offpeak: days.filter((d) => d?.peak === false).length,
      unknown: days.filter((d) => d?.peak == null).length,
      manual: days.filter((d) => d?.source === "MANUAL").length,
    };
  }, [cells, byDate]);

  const recalculate = async () => {
    if (!confirm("모든 예약의 성수기·주말 여부를 다시 계산할까요?\n직접 지정한 날짜는 그대로 유지됩니다.")) return;
    setRecalculating(true);
    setNotice(null);
    try {
      const res = await api.post<{ reservations: number }>("/stay-calendar/recalculate");
      setNotice(`예약 ${formatNumber(res.reservations)}건을 다시 계산했습니다.`);
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
        title="성수기 달력"
        description="예약 금액이 요금표의 성수기/비수기 요금과 일치한 예약 수로 날짜마다 자동 판단합니다. 틀린 날짜는 눌러서 고치세요."
        actions={
          <Button onClick={recalculate} loading={recalculating}>
            전체 재계산
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PropertyTabs properties={properties} value={propertyId} onChange={select} />
        <MonthPicker month={month} onChange={setMonth} />
        {loading && <Spinner className="text-slate-400" />}
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

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <Legend className="bg-brand-100 ring-brand-300">성수기 {summary.peak}일</Legend>
        <Legend className="bg-sky-50 ring-sky-200">비수기 {summary.offpeak}일</Legend>
        <Legend className="bg-white ring-slate-200">판단 근거 없음 {summary.unknown}일</Legend>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> 직접 지정 {summary.manual}일
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`py-2 ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : ""}`}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-100">
          {cells.map((date, i) =>
            date === null ? (
              <div key={`empty-${i}`} className="min-h-20 bg-slate-50/60 sm:min-h-24" />
            ) : (
              <DayCell key={date} date={date} day={byDate.get(date)} onClick={() => setSelected(date)} />
            ),
          )}
        </div>
      </Card>

      {selected && propertyId !== null && (
        <OverrideDialog
          key={selected}
          propertyId={propertyId}
          date={selected}
          day={byDate.get(selected)}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function DayCell({ date, day, onClick }: { date: string; day?: SeasonDay; onClick: () => void }) {
  const dow = new Date(date + "T00:00:00").getDay();
  const tone = day?.peak === true ? "bg-brand-50 hover:bg-brand-100" : day?.peak === false ? "bg-sky-50/60 hover:bg-sky-50" : "bg-white hover:bg-slate-50";
  const votes = (day?.peakVotes ?? 0) + (day?.offpeakVotes ?? 0);
  return (
    <button type="button" onClick={onClick} className={`flex min-h-20 flex-col p-1.5 text-left transition-colors sm:min-h-24 sm:p-2 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${dow === 0 ? "text-rose-500" : dow === 6 ? "text-sky-600" : "text-slate-700"}`}>{Number(date.slice(8))}</span>
        {day?.source === "MANUAL" && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" title="직접 지정" />}
      </div>
      <div className="mt-auto">
        {day?.peak === true && <span className="text-xs font-semibold text-brand-700">성수기</span>}
        {day?.peak === false && <span className="text-xs font-semibold text-sky-700">비수기</span>}
        {votes > 0 && (
          <p className="hidden text-[11px] leading-tight text-slate-400 sm:block">
            {day!.peakVotes} : {day!.offpeakVotes}
          </p>
        )}
      </div>
    </button>
  );
}

function OverrideDialog({
  propertyId,
  date,
  day,
  onClose,
  onSaved,
}: {
  propertyId: number;
  date: string;
  day?: SeasonDay;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (peak: boolean | null) => {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/stay-calendar/season-days/${propertyId}/${date}`, { peak });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const current = day?.peak === true ? "성수기" : day?.peak === false ? "비수기" : "판단 근거 없음";
  return (
    <Modal open onClose={onClose} title={`${formatDate(date)} 숙박`}>
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">현재: {current}</span>
          {day?.source === "MANUAL" ? <Badge tone="violet">직접 지정</Badge> : <Badge>자동</Badge>}
        </div>
        <p className="mt-1 text-slate-500">
          성수기 요금과 일치한 예약 {day?.peakVotes ?? 0}건 · 비수기 요금과 일치한 예약 {day?.offpeakVotes ?? 0}건
        </p>
      </div>
      <p className="mt-4 text-sm text-slate-600">이 날짜를 어떻게 볼까요? 직접 지정한 값은 이후 업로드로 바뀌지 않습니다.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => save(true)} disabled={saving} className="h-11 border-brand-300 text-brand-700 hover:bg-brand-50">
          성수기
        </Button>
        <Button onClick={() => save(false)} disabled={saving} className="h-11 border-sky-300 text-sky-700 hover:bg-sky-50">
          비수기
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        {day?.source === "MANUAL" ? (
          <Button variant="danger" onClick={() => save(null)} disabled={saving}>
            자동 판단으로 되돌리기
          </Button>
        ) : (
          <span />
        )}
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          닫기
        </Button>
      </div>
    </Modal>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ring-1 ${className}`} />
      {children}
    </span>
  );
}

function buildMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dates = Array.from({ length: daysInMonth }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  return { from: dates[0], to: dates[dates.length - 1], cells };
}
