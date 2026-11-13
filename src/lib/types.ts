export type Platform = "DDNAYO" | "YEOGI" | "NOL";

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
  propertyId: number;
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
