import { createHash } from "crypto";
import type { MessagePurpose, MessageTone } from "@prisma/client";

/** 日本時間（Asia/Tokyo）基準の日付キー YYYY-MM-DD */
export function getTokyoDateKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** ruleSignals の安定ハッシュ（順序差を吸収） */
export function hashRuleSignals(signals: string[]): string {
  const sorted = [...signals].sort((a, b) => a.localeCompare(b, "ja"));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 32);
}

export type SalesReasonFormat = "standard" | "homeBrief";

export type SalesReasonCacheKeyParts = {
  customerId: string;
  at: Date;
  salesScore: number;
  purpose: MessagePurpose;
  tone: MessageTone;
  ruleSignals: string[];
  /** ホーム短文と詳細文でキャッシュを分離 */
  format?: SalesReasonFormat;
};

/**
 * ai-sales:customerId:YYYY-MM-DD:salesScore:purpose:tone:signalsHash:format
 */
export function buildSalesReasonCacheKey(parts: SalesReasonCacheKeyParts): string {
  const dateKey = getTokyoDateKey(parts.at);
  const signalsHash = hashRuleSignals(parts.ruleSignals);
  const format = parts.format ?? "standard";
  return [
    "ai-sales",
    parts.customerId,
    dateKey,
    String(parts.salesScore),
    parts.purpose,
    parts.tone,
    signalsHash,
    format,
  ].join(":");
}

const store = new Map<string, string>();
const MAX_ENTRIES = 2000;

export function getCachedSalesReason(cacheKey: string): string | undefined {
  return store.get(cacheKey);
}

export function setCachedSalesReason(cacheKey: string, text: string): void {
  if (store.size >= MAX_ENTRIES && !store.has(cacheKey)) {
    const first = store.keys().next().value as string | undefined;
    if (first) store.delete(first);
  }
  store.set(cacheKey, text);
}
