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

export interface ImportBatchDeleteResult {
  importBatchId: number;
  fileName: string;
  /** 이 파일이 새로 만들어서 삭제한 정산 행 */
  deletedLines: number;
  /** 이 파일이 금액을 바꿔서 이전 값으로 되돌린 정산 행 */
  restoredLines: number;
  /** 정산 행이 남지 않아 삭제한 예약 */
  deletedReservations: number;
}

export type FeeBasis = "CHARGED" | "CANCELLED" | "NO_STAY" | "NO_RATE";

/** NONE: 0원(지급 없음), UNPAID: 미입금, PAID: 입금 완료, PAID_CHANGED: 입금 뒤 지급액이 바뀜 */
export type FeePaymentStatus = "NONE" | "UNPAID" | "PAID" | "PAID_CHANGED";

export type ManagementFeeExtraItem = "BBQ" | "EXTRA_PERSON" | "OTHER";

/** 관리비와 함께 현장에 넘겨 줄 추가요금 한 건. 금액 = 단가 × 수량 × 박수 */
export interface ManagementFeeExtra {
  id: number;
  item: ManagementFeeExtraItem;
  unitPrice: number;
  /** 수량 (추가인원은 인원) */
  quantity: number;
  /** 박수 (추가인원만) */
  nights: number | null;
  amount: number;
  memo: string | null;
}

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
  /** 관리비 (추가요금 제외) */
  amount: number;
  extras: ManagementFeeExtra[];
  extraAmount: number;
  /** 현장에 이체할 금액 = 관리비 + 추가요금. 입금 완료·확인은 이 금액 기준 */
  payableAmount: number;
  /** 이 객실의 매출(판매가)과 정산금액. 관리비 화면에서만, 모르면 null */
  grossAmount: number | null;
  netAmount: number | null;
  paymentStatus: FeePaymentStatus;
  /** 관리자가 입금 완료로 표시한 시각 */
  paidAt: string | null;
  /** 입금 완료로 표시할 때의 지급액 */
  paidAmount: number | null;
  /** 관리자 확인. NONE: 확인 안 함, VERIFIED: 확인함, CHANGED: 확인한 뒤 금액이 바뀜 (다시 확인) */
  verificationStatus: "NONE" | "VERIFIED" | "CHANGED";
  verifiedAt: string | null;
  /** 확인할 때의 지급액 */
  verifiedAmount: number | null;
}

export interface MonthlyManagementFee {
  propertyId: number | null;
  businessOwnerId: number | null;
  month: string;
  chargedCount: number;
  /** 관리비 합계 (추가요금 제외) */
  feeAmount: number;
  extraAmount: number;
  /** 관리비 + 추가요금 */
  totalAmount: number;
  grossAmount: number;
  netAmount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
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
  /** 매출·수수료·정산금액은 슈퍼어드민에게만 온다 (현장관리자는 null) */
  grossAmount: number | null;
  commissionAmount: number | null;
  netAmount: number | null;
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
  /** 객실 ID → 관리비 기본값 (입실일의 단가, 없으면 null) */
  managementFeeDefaults: Record<string, number | null>;
}

export interface SettlementFileCoverage {
  importBatchId: number;
  platform: Platform;
  /** 정산 계정 (파일명에서 읽음) */
  account: string | null;
  propertyId: number | null;
  issuedOn: string;
  issuedOnFromFileName: boolean;
  /** 이 파일이 담은 정산일 전부 (떠나요 한 달 치 파일은 여러 개). 이 날짜들의 주를 모두 업로드된 주로 본다 */
  settlementDates: string[];
  fileName: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  unmappedRows: number;
  failedRows: number;
  createdAt: string;
}

/** 정산 파일이 없지만 관리자가 확인 완료로 표시한 주 */
export interface SettlementWeekCheck {
  id: number;
  platform: Platform;
  account: string;
  /** 그 주의 월요일 */
  weekStart: string;
  note: string | null;
  createdAt: string;
}

/** 파일 현황에 나와야 하는 정산 계정 (파일을 아직 올리지 않았어도) */
export interface SettlementAccount {
  id: number;
  platform: Platform;
  account: string;
  propertyId: number | null;
  /** 정산 파일이 있어야 하는 첫 주 (월요일) */
  startedOn: string;
  /** 떠나요 사업자번호 (278-27-01574). AdjustCalendar 원본 파일을 이 계정에 붙인다 */
  businessNumber: string | null;
}

export type UserRole = "SUPER_ADMIN" | "SITE_MANAGER" | "USER";

export interface Me {
  id: number;
  provider: "NAVER" | "KAKAO" | "DEV";
  /** 첫 슈퍼어드민 설정(AUTH_SUPER_ADMINS)에 적는 값 */
  providerKey: string;
  nickname: string | null;
  email: string | null;
  role: UserRole;
}

export interface AdminUser extends Me {
  createdAt: string;
  lastLoginAt: string | null;
}

// ── 계좌 거래내역 (BANK-01) ──

export interface BankAccount {
  id: number;
  accountNumber: string;
  holderName: string | null;
  businessOwnerId: number | null;
}

export interface BankUpload {
  id: number;
  bankAccountId: number;
  fileName: string;
  periodFrom: string | null;
  periodTo: string | null;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  createdAt: string;
}

export interface BankImportResult {
  fileName: string;
  status: "IMPORTED" | "REJECTED";
  message: string | null;
  upload: BankUpload | null;
  account: BankAccount | null;
  balanceBreaks: string[];
}

export type BankCategoryGroup = "REVENUE" | "NON_OPERATING_IN" | "EXPENSE" | "FINANCING" | "TRANSFER";

export interface BankCategoryInfo {
  code: string;
  label: string;
  group: BankCategoryGroup;
  groupLabel: string;
}

export interface BankTransaction {
  id: number;
  transactedAt: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  description: string;
  counterpartyName: string | null;
  counterpartyBank: string | null;
  transactionType: string | null;
  category: string;
  categorySource: "AUTO" | "MANUAL";
  note: string | null;
}

export interface BankAnalysis {
  account: BankAccount;
  from: string;
  to: string;
  months: {
    month: string;
    openingBalance: number | null;
    closingBalance: number | null;
    deposits: number;
    withdrawals: number;
    net: number;
    revenue: number;
    expense: number;
    transactionCount: number;
    byCategory: Record<string, number>;
  }[];
  categories: { category: string; amount: number; count: number; share: number | null }[];
  otaDeposits: {
    transactionId: number;
    transactedAt: string;
    amount: number;
    description: string;
    platform: Platform;
    importBatchId: number | null;
    fileName: string | null;
    settlementAccount: string | null;
    issuedOn: string | null;
  }[];
  feeComparisons: {
    feeMonth: string;
    withdrawnTotal: number;
    calculatedTotal: number | null;
    difference: number | null;
    paidTotal: number | null;
    unpaidCount: number | null;
    withdrawals: BankTransaction[];
  }[];
  insights: { level: "GOOD" | "INFO" | "WARN"; title: string; detail: string }[];
}

// ── 매출 전년 동월 비교 ──

export interface RevenueTotals {
  gross: number;
  net: number;
  roomNights: number;
  cancellationFees: number;
  adr: number | null;
  byPlatform: Partial<Record<Platform, number>>;
}

export interface RevenueComparison {
  year: number;
  propertyId: number | null;
  months: {
    month: string;
    current: RevenueTotals | null;
    previous: RevenueTotals | null;
    grossChange: number | null;
    netChange: number | null;
    roomNightsChange: number | null;
    adrChange: number | null;
  }[];
  comparableMonths: string[];
  comparableCurrent: RevenueTotals | null;
  comparablePrevious: RevenueTotals | null;
  comparableGrossChange: number | null;
  comparableNetChange: number | null;
}

// ── 업로드 작업 (비동기) · 알림 ──

export type ImportJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface ImportJob {
  id: number;
  kind: "SETTLEMENT" | "BANK";
  fileName: string;
  status: ImportJobStatus;
  errorMessage: string | null;
  /** 정산 파일 처리 결과 (끝난 뒤) */
  settlement: FileImportResult | null;
  /** 계좌 거래내역 처리 결과 (성공한 뒤) */
  bank: { uploadId: number; bankAccountId: number; totalRows: number; insertedRows: number; duplicateRows: number; balanceBreaks: string[] } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ImportJobsCreated {
  jobs: ImportJob[];
  /** 접수하지 않은 파일 (빈 파일, 같은 파일이 이미 대기 중 등) */
  rejected: { fileName: string; message: string }[];
}

export interface NotificationItem {
  id: number;
  level: "ERROR" | "WARN" | "INFO";
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationInbox {
  unreadCount: number;
  items: NotificationItem[];
}
