import type { FeeBasis, Platform } from "./types";

const won = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${won.format(value)}원`;
}

export function formatNumber(value: number): string {
  return won.format(value);
}

export const platformLabel: Record<Platform, string> = {
  DDNAYO: "떠나요",
  YEOGI: "여기어때",
  NOL: "NOL",
};

export const feeBasisLabel: Record<FeeBasis, string> = {
  CHARGED: "지급",
  CANCELLED: "취소",
  NO_STAY: "투숙 없음",
  NO_RATE: "단가 없음",
};

/** DB 객실 코드를 화면용 이름으로 (RESORT_201 → 리조트 201) */
export function roomLabel(name: string): string {
  if (name.startsWith("RESORT_")) return `리조트 ${name.slice("RESORT_".length)}`;
  const villas: Record<string, string> = {
    PREMIUM_VILLA: "프리미엄 풀빌라",
    VILLA_1: "Villa I",
    VILLA_2: "Villa II",
    VILLA_3: "Villa III",
  };
  return villas[name] ?? name;
}

/** "2026-08" 형태 */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function formatDate(date: string | null): string {
  if (!date) return "-";
  const [, m, d] = date.split("-").map(Number);
  const day = "일월화수목금토"[new Date(date + "T00:00:00").getDay()];
  return `${m}/${d} (${day})`;
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
