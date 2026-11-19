import type { FeeBasis, FeePaymentStatus, PaymentMethod, Platform, SalesChannel, SettlementLineType } from "./types";

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
  DIRECT: "직접 입력",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "계좌이체",
  CARD: "카드",
  CASH: "현금",
  OTHER: "기타",
};

export const feeBasisLabel: Record<FeeBasis, string> = {
  CHARGED: "지급 대상",
  CANCELLED: "취소",
  NO_STAY: "투숙 없음",
  NO_RATE: "단가 없음",
};

export const feePaymentLabel: Record<FeePaymentStatus, string> = {
  NONE: "-",
  UNPAID: "미입금",
  PAID: "입금 완료",
  PAID_CHANGED: "입금 후 금액 변경",
};

/** 미입금은 평소 상태라 회색, 입금 완료는 '확인됨'(초록)과 헷갈리지 않게 파랑 */
export const feePaymentTone: Record<FeePaymentStatus, "gray" | "blue" | "red"> = {
  NONE: "gray",
  UNPAID: "gray",
  PAID: "blue",
  PAID_CHANGED: "red",
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

export const salesChannelLabel: Record<SalesChannel, string> = {
  NAVER: "네이버",
  YANOLJA: "야놀자",
  YEOGI: "여기어때",
  YEOGI_PARTNER: "여기어때 연동사이트",
  DDNAYO: "떠나요",
  HOMEPAGE: "홈페이지",
  PHONE: "전화",
  WALK_IN: "현장",
  OTHER: "기타",
};

export const lineTypeLabel: Record<SettlementLineType, string> = {
  ROOM_NIGHT: "1박",
  CANCELLATION_FEE: "취소수수료",
  ROOM_NIGHT_REVERSAL: "입실 후 취소",
};

/** 입실일 + 박수 → 퇴실일 ("2026-08-03") */
export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 월의 첫날과 마지막 날 */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export const roomTypeLabel: Record<string, string> = {
  SPACE_CARAVAN: "스페이스카라반",
  AIR_STREAM: "에어스트림",
  CARAVAN: "카라반",
  RESORT: "리조트",
  POOL_VILLA: "풀빌라",
};

/** 다중 객실 예약의 객실 이름 ("제돌이, 수애기") */
export function roomsLabel(rooms: { name: string }[]): string {
  return rooms.map((r) => roomLabel(r.name)).join(", ");
}

/** 현장 객실 변경을 반영한 객실 이름: "해안 → 놀멍" */
export function stayedRoomsLabel(rooms: { id: number; name: string }[], changes: { fromRoomId: number; toRoomName: string }[]): string {
  return rooms
    .map((r) => {
      const moved = changes.find((c) => c.fromRoomId === r.id);
      return moved ? `${roomLabel(r.name)} → ${roomLabel(moved.toRoomName)}` : roomLabel(r.name);
    })
    .join(", ");
}
