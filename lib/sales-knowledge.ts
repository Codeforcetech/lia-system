import type { MessagePurpose, MessageTone } from "@prisma/client";

/**
 * Lia 独自の夜職営業ナレッジ（ルールベースで参照し、随時拡張する）
 */
export const SALES_KNOWLEDGE = {
  VIP: {
    recommendedTone: "NATURAL" as MessageTone,
    avoidHardSelling: true,
    preferredStyle: "自然なお礼・雑談",
    notes: "VIPは営業感を弱め、関係性維持を優先",
  },
  LOW_RESPONSE: {
    recommendedTone: "SHORT" as MessageTone,
    avoidLongMessage: true,
    notes: "返信薄めには短文・質問は1つまでが無難",
  },
  BIRTHDAY: {
    /** 誕生日当日より数日前の一言が自然になりやすい */
    idealLeadDaysBefore: 5,
    recommendedTone: "NATURAL" as MessageTone,
    notes: "誕生日営業は数日前の軽い一言が自然",
  },
  POST_VISIT: {
    /** 来店直後は温度感維持・自然なお礼優先 */
    thankYouWindowDays: 3,
    recommendedTone: "NATURAL" as MessageTone,
    notes: "来店直後は押さず、自然なお礼で温度感を保つ",
  },
  LONG_GAP: {
    /** 久しぶりは重く行かない */
    minDaysSinceVisit: 14,
    recommendedTone: "FRIENDLY" as MessageTone,
    notes: "久しぶり客には重い言い回しを避け、軽い近況づかみ",
  },
  THANK_YOU: {
    recommendedTone: "NATURAL" as MessageTone,
    notes: "お礼LINEは自然さ優先、来店誘導は強くしない",
  },
} as const;

export type SalesKnowledgeKey = keyof typeof SALES_KNOWLEDGE;

/**
 * Prompt Caching 向け：先頭一致用の固定ナレッジ本文（日付・顧客名・動的値は含めない）
 * キーはアルファベット順で安定化
 */
export const SALES_KNOWLEDGE_PROMPT_BLOCK: string = (() => {
  const keys = (Object.keys(SALES_KNOWLEDGE) as SalesKnowledgeKey[]).slice().sort();
  const lines: string[] = [
    "## Lia夜職営業ナレッジ（固定・参照用）",
    "※送信目的・文体・優先度の判断はアプリ側で完了している。このブロックは文脈理解とトーン維持のため。",
    "",
  ];
  for (const key of keys) {
    const v = SALES_KNOWLEDGE[key];
    lines.push(`- ${key}: ${v.notes}`);
    if ("preferredStyle" in v && v.preferredStyle) {
      lines.push(`  推奨スタイル: ${v.preferredStyle}`);
    }
    if ("avoidHardSelling" in v && v.avoidHardSelling) {
      lines.push("  強い営業・押しは避ける");
    }
    if ("avoidLongMessage" in v && v.avoidLongMessage) {
      lines.push("  長文は避け短文寄り");
    }
  }
  lines.push("");
  lines.push("共通方針: 関係性維持を優先。VIPは営業感弱め。返信薄めは短文。来店直後は温度感維持。誕生日は自然さ優先。久しぶり客に重すぎない言い回しは避ける。お礼LINEは自然さ優先。");
  return lines.join("\n");
})();
