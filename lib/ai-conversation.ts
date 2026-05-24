import { createHash } from "crypto";
import OpenAI from "openai";
import { liaAiLog } from "@/lib/ai-log";
import type { ConversationIntentResult } from "@/lib/ai-intent";

export type ConversationThemeResult = {
  conversationThemes: string[];
  toneHint: string;
  avoid: string[];
  summary: string;
};

const THEME_CACHE_MAX = 512;
const themeCache = new Map<string, ConversationThemeResult>();

function buildThemeCacheKey(
  memo: string,
  customerName?: string,
  customerTags?: string[],
  intentSig?: string,
  recommendationSig?: string
): string {
  const tags = [...(customerTags ?? [])].sort((a, b) => a.localeCompare(b, "ja"));
  const payload = [
    memo.trim(),
    customerName?.trim() ?? "",
    tags.join("\u001e"),
    intentSig ?? "",
    recommendationSig ?? "",
  ].join("\u0000");
  const h = createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
  return `conversation-theme:${h}`;
}

function emptyResult(): ConversationThemeResult {
  return {
    conversationThemes: [],
    toneHint: "",
    avoid: [],
    summary: "",
  };
}

/** API 未設定・失敗時：追加指示を軽い雑談軸に落とす */
export function fallbackConversationThemes(memo: string): ConversationThemeResult {
  const m = memo.trim();
  if (!m) return emptyResult();

  if (/経済|円安|物価|NISA|株|インフレ|景気/i.test(m)) {
    return {
      conversationThemes: ["物価・生活感", "円安の雑談", "ニュースの軽い話", "将来の不安を重くしない一言"],
      toneHint: "軽め雑談",
      avoid: ["政治色の強い話", "解説・講義調", "難しい専門用語の羅列"],
      summary: "経済ネタを、LINEで軽く触れられる話題に寄せました（フォールバック）。",
    };
  }

  return {
    conversationThemes: ["近況", "軽い話題", "負担の少ない一言"],
    toneHint: "軽め雑談",
    avoid: ["説明口調", "情報の詰め込み", "重いテーマの深掘り"],
    summary: "追加指示を雑談向けに汎用変換しました（フォールバック）。",
  };
}

function parseThemeJson(raw: string): ConversationThemeResult | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const themes = o.conversationThemes;
    const toneHint = o.toneHint;
    const avoid = o.avoid;
    const summary = o.summary;
    if (!Array.isArray(themes) || typeof toneHint !== "string") return null;
    const conversationThemes = themes
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    const avoidList = Array.isArray(avoid)
      ? avoid.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : [];
    const summaryStr = typeof summary === "string" ? summary.trim() : "";
    return {
      conversationThemes,
      toneHint: toneHint.trim().slice(0, 80),
      avoid: avoidList,
      summary: summaryStr.slice(0, 200),
    };
  } catch {
    return null;
  }
}

const THEME_SYSTEM = [
  "あなたは夜職のキャスト向け営業支援「Lia」の、会話テーマ設計アシスタントです。",
  "",
  "## 目的",
  "利用者がフォームに書いた「追加指示（ひとことメモ）」を、キャストがLINEで**軽く触れられる雑談テーマ**に変換する。",
  "文章に単語を埋め込むためではなく、「どんな会話の角度で近づくか」を整理する。",
  "",
  "## assistantContext（任意）",
  "入力JSONに assistantContext がある場合に従う。",
  "- intentClassification は先行工程で「AIが何を補完すべきか」を判定した結果（本文とは別）。",
  "- conversationReferences.recommendations に店名など具体候補があるとき、抽象語（例:「渋谷カフェ」だけ）に逃げず、**そのネタに自然に触れられる雑談角度**を conversationThemes に含める。",
  "- **テーマ文字列に店名を列挙しない**（固有名は後段のLINE生成で高々1つ混ぜる想定）。",
  "- needsRealInformation が true で候補があるとき、説明・レビュー・名前列挙の角度は避ける。",
  "",
  "## 絶対禁止",
  "- 説明口調・評論家・ニュース解説・レポート調",
  "- 情報量過多・難しすぎる専門話",
  "- 相手を説得する・教える口調",
  "- 政治色の強い切り口の提案",
  "",
  "## 出力ルール",
  "- 有効なJSONオブジェクト1つだけ（前後に説明文を付けない）。",
  '- キー: "conversationThemes" (文字列の配列 3〜6個), "toneHint" (文字列1つ), "avoid" (避けたいニュアンス 2〜5個の配列), "summary" (解釈の要約 1文 40文字以内)',
  "- conversationThemes は各10文字以内を目安に、短い名詞句（LINEの一文に繋げやすい）。",
  "- 知的すぎない・重すぎない・キャストが送りやすい温度感。",
].join("\n");

export async function extractConversationThemes(input: {
  memo: string;
  customerName?: string;
  customerTags?: string[];
  intentClassification?: ConversationIntentResult | null;
  conversationReferences?: { recommendations: string[] } | null;
}): Promise<ConversationThemeResult> {
  const memo = input.memo?.trim() ?? "";
  if (!memo) {
    return emptyResult();
  }

  const ic = input.intentClassification;
  const recs = input.conversationReferences?.recommendations ?? [];
  const intentSig = ic
    ? [
        ic.intent,
        ic.needsRealInformation ? "1" : "0",
        ic.location ?? "",
        ic.category ?? "",
        ic.keywords.join(","),
      ].join("\u001f")
    : "";
  const recSig = recs.join("\u001f");
  const cacheKey = buildThemeCacheKey(
    memo,
    input.customerName,
    input.customerTags,
    intentSig,
    recSig
  );
  const hit = themeCache.get(cacheKey);
  if (hit) {
    liaAiLog("cache hit", { feature: "conversation_theme" });
    return hit;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    liaAiLog("fallback used", { feature: "conversation_theme", reason: "no_api_key" });
    const fb = fallbackConversationThemes(memo);
    themeCache.set(cacheKey, fb);
    if (themeCache.size > THEME_CACHE_MAX) {
      const first = themeCache.keys().next().value as string | undefined;
      if (first) themeCache.delete(first);
    }
    return fb;
  }

  const client = new OpenAI({ apiKey });
  const userPayload = {
    additionalMemo: memo,
    customerName: input.customerName?.trim() || null,
    customerTags: input.customerTags ?? [],
    assistantContext: {
      intentClassification: ic
        ? {
            intent: ic.intent,
            keywords: ic.keywords,
            location: ic.location ?? null,
            category: ic.category ?? null,
            needsRealInformation: ic.needsRealInformation,
          }
        : null,
      conversationReferences:
        recs.length > 0 ? { recommendations: [...recs] } : null,
    },
  };

  try {
    liaAiLog("OpenAI start", { feature: "conversation_theme" });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: THEME_SYSTEM },
        {
          role: "user",
          content: `次のJSONを解釈し、指定スキーマのJSONだけを返してください。\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) {
      liaAiLog("fallback used", { feature: "conversation_theme", reason: "empty_completion" });
      const fb = fallbackConversationThemes(memo);
      themeCache.set(cacheKey, fb);
      return fb;
    }
    const parsed = parseThemeJson(text);
    if (!parsed || parsed.conversationThemes.length === 0) {
      liaAiLog("fallback used", { feature: "conversation_theme", reason: "parse_error" });
      const fb = fallbackConversationThemes(memo);
      themeCache.set(cacheKey, fb);
      return fb;
    }
    liaAiLog("OpenAI success", { feature: "conversation_theme" });
    if (themeCache.size >= THEME_CACHE_MAX) {
      const first = themeCache.keys().next().value as string | undefined;
      if (first) themeCache.delete(first);
    }
    themeCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    liaAiLog("fallback used", { feature: "conversation_theme", reason: "api_error" });
    const fb = fallbackConversationThemes(memo);
    themeCache.set(cacheKey, fb);
    return fb;
  }
}
