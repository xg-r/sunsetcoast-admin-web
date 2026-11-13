export type Platform = "DDNAYO" | "YEOGI" | "NOL" | "DIRECT";
export type PaymentMethod = "BANK_TRANSFER" | "CARD" | "CASH" | "OTHER";

export interface Property {
  id: number;
  code: string;
  name: string;
}

export type ImportStatus = "IMPORTED" | "PREVIEW" | "REJECTED";
export type RowResult = "INSERTED" | "DUPLICATE" | "CHANGED" | "SKIPPED" | "UNMAPPED" | "FAILED";

export interface RowIssue {
  rowNo: number;
  result: RowResult;
  message: string | null;
}

export interface ImportCounts {
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  changedRows: number;
  skippedRows: number;
  unmappedRows: number;
  failedRows: number;
}

export interface FileImportResult extends ImportCounts {
  fileName: string;
  status: ImportStatus;
  platform: Platform | null;
  importBatchId: number | null;
  message: string | null;
  issues: RowIssue[];
}

export interface SettlementImportResponse {
  dryRun: boolean;
  files: FileImportResult[];
}

export interface ImportBatch extends ImportCounts {
  id: number;
  platform: Platform;
  fileKind: "SETTLEMENT" | "RESERVATION";
  fileName: string;
  createdAt: string;
}

export type FeeBasis = "CHARGED" | "CANCELLED" | "NO_STAY" | "NO_RATE";

export interface ManagementFee {
  id: number;
  reservationId: number;
  source: Platform;
  reservationNumber: string;
  bookerName: string | null;
  roomId: number;
  roomName: string;
  checkInDate: string | null;
  nights: number | null;
  status: "CONFIRMED" | "CANCELLED";
  basis: FeeBasis;
  calculatedAmount: number;
  overrideAmount: number | null;
  overrideReason: string | null;
  amount: number;
}

export interface MonthlyManagementFee {
  propertyId: number | null;
  businessOwnerId: number | null;
  month: string;
  chargedCount: number;
  totalAmount: number;
  items: ManagementFee[];
}

export interface SeasonDay {
  propertyId: number;
  stayDate: string;
  peak: boolean | null;
  source: "INFERRED" | "MANUAL";
  peakVotes: number;
  offpeakVotes: number;
}

export type SalesChannel = "NAVER" | "YANOLJA" | "YEOGI" | "DDNAYO" | "HOMEPAGE" | "PHONE" | "WALK_IN" | "OTHER";

export interface Reservation {
  id: number;
  source: Platform;
  reservationNumber: string;
  salesChannel: SalesChannel;
  salesChannelRaw: string | null;
  /** 대표 객실 (다중 객실 예약은 첫 번째) */
  roomId: number;
  roomName: string;
  rooms: { id: number; name: string }[];
  bookerName: string | null;
  reservedAt: string | null;
  checkInDate: string | null;
  /** 입실일, 없으면 매출인식일 */
  baseDate: string | null;
  nights: number | null;
  weekend: boolean | null;
  peakSeason: boolean | null;
  status: "CONFIRMED" | "CANCELLED";
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  managementFee: number | null;
  /** OWNER: 외부 소유주 계좌로 직접 입금 (매출 제외) */
  paymentReceiver: "US" | "OWNER";
  guestCount: number | null;
  paymentMethod: PaymentMethod | null;
  paid: boolean | null;
  memo: string | null;
}

export type SettlementLineType = "ROOM_NIGHT" | "CANCELLATION_FEE" | "ROOM_NIGHT_REVERSAL";

export interface SettlementLine {
  id: number;
  lineType: SettlementLineType;
  roomName: string;
  stayDate: string;
  settledOn: string | null;
  grossAmount: number;
  partnerDiscount: number;
  platformDiscount: number;
  commissionRate: number | null;
  commissionAmount: number;
  otherFee: number;
  netAmount: number;
  splitEstimated: boolean;
  fileName: string | null;
}

export interface ReservationDetail {
  reservation: Reservation;
  lines: SettlementLine[];
  managementFees: ManagementFee[];
}

export interface Room {
  id: number;
  name: string;
  type: string;
  propertyId: number;
  businessOwnerId: number;
}

export interface BusinessOwner {
  id: number;
  name: string;
  ownershipType: "FAMILY" | "EXTERNAL";
  rooms: Room[];
}

export interface UnmappedRow {
  id: number;
  importBatchId: number;
  fileName: string;
  platform: Platform;
  rowNo: number;
  message: string | null;
  roomName: string | null;
  reservationNumber: string | null;
  bookerName: string | null;
  stayDate: string | null;
  nights: number | null;
  lineType: SettlementLineType | null;
  grossAmount: number | null;
  netAmount: number | null;
  suggestedRoomIds: number[];
  uploadedAt: string;
}

export interface ResolveResult {
  result: string;
  message: string | null;
  autoResolved: number;
}

export interface ReservationConflict {
  reservationId: number;
  source: Platform;
  reservationNumber: string;
  roomName: string;
  bookerName: string | null;
  checkInDate: string;
  checkOutDate: string;
}

export interface DirectQuote {
  nights: { date: string; weekend: boolean; peak: boolean | null; prices: Record<string, number | null> }[];
  conflicts: ReservationConflict[];
  ownerPaid: boolean;
}

export interface SettlementFileCoverage {
  importBatchId: number;
  platform: Platform;
  /** 정산 계정 (파일명에서 읽음) */
  account: string | null;
  propertyId: number | null;
  issuedOn: string;
  issuedOnFromFileName: boolean;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  unmappedRows: number;
  failedRows: number;
  createdAt: string;
}
