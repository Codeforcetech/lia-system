import type { ConversationIntent } from "@/lib/ai-intent";

/**
 * 会話ネタ補完用の固定データ（将来は外部検索APIに差し替え可能な薄いラッパー）
 */
const LOCAL_RECOMMENDATIONS: Record<string, Record<string, string[]>> = {
  渋谷: {
    カフェ: [
      "ABOUT LIFE COFFEE BREWERS",
      "TRUNK(CAFE)",
      "REC COFFEE",
    ],
    グルメ: ["イタリアン", "焼肉ライク", "立ち食いそば"],
  },
  新宿: {
    カフェ: ["BLUE BOTTLE COFFEE 新宿", "スターバックス 新宿南口", "ルノアール"],
    グルメ: ["思い出横丁", "タコス", "ラーメン"],
  },
  恵比寿: {
    カフェ: ["猿田彦珈琲 恵比寿", "ワンインチアップル", "イデミツコーヒー"],
  },
  表参道: {
    カフェ: ["ストリーマー・コーヒー", "カフェ・ミケーラ", "表参道カフェ"],
  },
};

function normalizeLocation(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  if (/渋谷|シブヤ|shibuya/i.test(t)) return "渋谷";
  if (/新宿|シンジュク|shinjuku/i.test(t)) return "新宿";
  if (/恵比寿|エビス|ebisu/i.test(t)) return "恵比寿";
  if (/表参道|オモテサンドウ|omotesando/i.test(t)) return "表参道";
  if (LOCAL_RECOMMENDATIONS[t]) return t;
  return undefined;
}

function normalizeCategory(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const t = raw.trim();
  if (/カフェ|コーヒー|cafe|coffee/i.test(t)) return "カフェ";
  if (/グルメ|飲食|レストラン|ランチ|ディナー|食/i.test(t)) return "グルメ";
  return t;
}

export type LookupReferencesInput = {
  intent: ConversationIntent;
  location?: string;
  category?: string;
  needsRealInformation: boolean;
};

/**
 * 意図に応じて固定レコメンドを返す（現状は LOCAL_RECOMMENDATION 中心）
 */
export function lookupConversationReferences(input: LookupReferencesInput): string[] {
  if (!input.needsRealInformation) return [];

  if (input.intent === "LOCAL_RECOMMENDATION" || input.intent === "FOOD_TOPIC") {
    const loc = normalizeLocation(input.location);
    const cat = normalizeCategory(input.category) ?? "カフェ";
    if (!loc) return [];
    const byArea = LOCAL_RECOMMENDATIONS[loc];
    if (!byArea) return [];
    const list = byArea[cat];
    if (list?.length) return [...list];
    const first = Object.values(byArea)[0];
    return first ? [...first] : [];
  }

  return [];
}
