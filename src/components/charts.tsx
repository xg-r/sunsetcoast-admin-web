"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 막대 차트 (SVG, 외부 라이브러리 없음).
 * 색: 범주 1 파랑, 2 주황 (색각 이상 검사 통과). 글자는 데이터 색을 쓰지 않는다.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834"] as const;

const GRID = "#e2e8f0";
const AXIS_TEXT = "#64748b";

export interface ColumnSeries {
  key: string;
  label: string;
  /** null = 데이터 없음 (0과 구분) */
  values: (number | null)[];
}

/** 축 눈금용 짧은 금액 (1.2억, 3,500만) */
export function compactWon(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${trim(abs / 100_000_000)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return `${sign}${abs.toLocaleString("ko-KR")}`;
}

function trim(n: number) {
  return n.toFixed(1).replace(/\.0$/, "");
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * exp >= value / 4) ?? 10;
  return Math.ceil(value / (step * exp)) * step * exp;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 범주(월)별 세로 막대. 시리즈 1~2개. 막대 위에 마우스를 올리면 값이 보인다. */
export function ColumnChart({
  categories,
  series,
  formatValue,
  height = 240,
  ariaLabel,
}: {
  categories: string[];
  series: ColumnSeries[];
  formatValue: (value: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padLeft = 48;
  const padBottom = 24;
  const padTop = 8;
  const plotW = Math.max(width - padLeft - 8, 0);
  const plotH = height - padBottom - padTop;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const band = categories.length ? plotW / categories.length : 0;
  const gap = 2;
  const barW = Math.max(Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length), 2);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => padTop + plotH - (v / max) * plotH;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padLeft} x2={padLeft + plotW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={padLeft - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
                  {compactWon(t)}
                </text>
              </g>
            ))}
            {categories.map((c, ci) => {
              const x0 = padLeft + ci * band + (band - groupW) / 2;
              return (
                <g key={c}>
                  {hover === ci && <rect x={padLeft + ci * band} y={padTop} width={band} height={plotH} fill="#f1f5f9" />}
                  {series.map((s, si) => {
                    const v = s.values[ci];
                    if (v === null || v <= 0) return null;
                    const top = y(v);
                    const h = padTop + plotH - top;
                    const r = Math.min(4, h, barW / 2);
                    const x = x0 + si * (barW + gap);
                    // 위쪽만 둥글게, 바닥은 평평하게
                    const d = `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`;
                    return <path key={s.key} d={d} fill={SERIES_COLORS[si]} />;
                  })}
                  <text x={padLeft + ci * band + band / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                    {c}
                  </text>
                  <rect
                    x={padLeft + ci * band}
                    y={padTop}
                    width={band}
                    height={plotH + padBottom}
                    fill="transparent"
                    onMouseEnter={() => setHover(ci)}
                    onFocus={() => setHover(ci)}
                    tabIndex={0}
                    aria-label={`${c}: ${series.map((s) => `${s.label} ${s.values[ci] === null ? "데이터 없음" : formatValue(s.values[ci]!)}`).join(", ")}`}
                  />
                </g>
              );
            })}
            <line x1={padLeft} x2={padLeft + plotW} y1={padTop + plotH} y2={padTop + plotH} stroke="#cbd5e1" strokeWidth={1} />
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{
              top: 0,
              left: Math.min(Math.max(padLeft + hover * band + band / 2 - 72, 0), Math.max(width - 160, 0)),
            }}
          >
            <p className="mb-1 font-semibold text-slate-800">{categories[hover]}</p>
            {series.map((s, i) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
                  {s.label}
                </span>
                <span className="font-medium text-slate-800">{s.values[hover] === null ? "데이터 없음" : formatValue(s.values[hover]!)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 항목별 가로 막대 (한 가지 값, 큰 것부터). 값은 막대 끝에 글자로 */
export function BarList({
  items,
  formatValue,
}: {
  items: { key: string; label: string; value: number; hint?: string }[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key} title={item.hint}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{item.label}</span>
            <span className="shrink-0 font-medium text-slate-800">
              {formatValue(item.value)}
              {item.hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{item.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: SERIES_COLORS[0] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
