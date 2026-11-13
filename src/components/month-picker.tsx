"use client";

import { formatMonth, shiftMonth } from "@/lib/format";
import { useCurrentMonth } from "@/lib/use-month";

export function MonthPicker({ month, onChange }: { month: string | null; onChange: (month: string) => void }) {
  const current = useCurrentMonth();
  if (!month || !current) return <div className="h-9 w-40 rounded-lg border border-slate-200 bg-white" />;
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
        ‹
      </button>
      <span className="min-w-24 text-center text-sm font-semibold">{formatMonth(month)}</span>
      <button type="button" onClick={() => onChange(shiftMonth(month, 1))} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="다음 달">
        ›
      </button>
      {month !== current && (
        <button type="button" onClick={() => onChange(current)} className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          이번 달
        </button>
      )}
    </div>
  );
}
