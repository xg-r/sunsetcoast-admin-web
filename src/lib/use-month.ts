"use client";

import { useState, useSyncExternalStore } from "react";
import { toMonthKey } from "./format";

const noopSubscribe = () => () => {};

/** 이번 달 ("2026-11"). 미리 렌더링할 때는 null, 브라우저에서만 계산한다. */
export function useCurrentMonth(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => toMonthKey(new Date()),
    () => null,
  );
}

/** 주소의 ?month=2026-08 (링크로 특정 달을 열 때) */
function useMonthParam(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const value = new URLSearchParams(window.location.search).get("month");
      return value && /^\d{4}-\d{2}$/.test(value) ? value : null;
    },
    () => null,
  );
}

/** 선택한 달. 고르기 전에는 주소의 ?month=, 없으면 이번 달 */
export function useMonth(): [string | null, (month: string) => void] {
  const current = useCurrentMonth();
  const param = useMonthParam();
  const [picked, setPicked] = useState<string | null>(null);
  return [picked ?? param ?? current, setPicked];
}

/** 오늘 ("2026-11-13"). 미리 렌더링할 때는 null */
export function useToday(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const d = new Date();
      return `${toMonthKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
    },
    () => null,
  );
}
