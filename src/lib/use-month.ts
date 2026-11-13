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

/** 선택한 달. 고르기 전에는 이번 달 */
export function useMonth(): [string | null, (month: string) => void] {
  const current = useCurrentMonth();
  const [picked, setPicked] = useState<string | null>(null);
  return [picked ?? current, setPicked];
}
