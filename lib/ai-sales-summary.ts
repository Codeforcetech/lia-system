import OpenAI from "openai";
import { getTokyoDateKey } from "@/lib/ai-sales-cache";
import { SALES_KNOWLEDGE_PROMPT_BLOCK } from "@/lib/sales-knowledge";
import { liaAiLog } from "@/lib/ai-log";
import type { TodoBucketKey } from "@/lib/ai-sales";

export type ManagerBriefingInput = {
  totalUnique: number;
  breakdown: Record<TodoBucketKey, number>;
  topCustomer: null | {
    customerId: string;
    name: string;
    primaryLabel: string;
    priority: string;
    score: number;
  };
};

/** 営業状況が同じなら同一キー（リロードは hit、TODO変化は miss） */
export function buildManagerSummaryCacheKey(input: ManagerBriefingInput, at: Date): string {
  const dateKey = getTokyoDateKey(at);
  const b = input.breakdown;
  const topId = input.topCustomer?.customerId ?? "_none_";
  const topScore = input.topCustomer?.score ?? 0;
  return [
    "manager-summary-v2",
    dateKey,
    String(input.totalUnique),
    String(b.BIRTHDAY),
    String(b.THANK_YOU),
    String(b.LONG_GAP),
    String(b.MEMO),
    topId,
    String(topScore),
  ].join(":");
}

const MAX_BRIEF_CHARS = 100;

/** 「今日の一言」用：最大文字数・改行は1回まで */
function normalizeBriefingText(text: string): string {
  let t = text.trim().replace(/\r\n/g, "\n");
  t = t.replace(/^[\s•\-*・◦]+/gm, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  const lines = t.split("\n").filter((line) => line.trim().length > 0);
  t = lines.slice(0, 2).join("\n");
  if (t.length > MAX_BRIEF_CHARS) {
    t = `${t.slice(0, MAX_BRIEF_CHARS - 1).trimEnd()}…`;
  }
  return t;
}

const MANAGER_BRIEFING_SYSTEM = [
  "あなたは夜職向け営業OS「Lia」の「今日の一言」を1つだけ書くアシスタントです。",
  "",
  "## 絶対条件",
  "- 日本語のみ。出力は「今日の一言」本文だけ（見出し・ラベル・「内訳」・箇条書き・JSON・コードブロック禁止）。",
  "- 1〜2文。合計でだいたい60文字。長くても100文字以内。改行は高々1回（2行まで）。",
  "- 特定の顧客名は出さない（最優先の名前は画面別表示）。",
  "- 内訳の数値はユーザーJSONを参照してよいが、本文に「誕生日◯名」のように列挙しすぎない。今日何を優先するかが一読で分かること。",
  "- やわらかい言い方。営業感・命令口調を出しすぎない。",
  "",
  "## 例（トーンの参考。コピペ禁止）",
  "- 誕生日が近いお客様が2名います。今日は自然なお祝いLINEから始めましょう。",
  "- 来店後のお礼候補があります。熱が冷めないうちに、軽く感謝を伝えるのがおすすめです。",
  "",
  SALES_KNOWLEDGE_PROMPT_BLOCK,
].join("\n");

const MANAGER_BRIEFING_USER_PREFIX =
  "以下は今日のダッシュボード集計です。「今日の一言」本文のみを出力してください。\n";

const summaryCache = new Map<string, string>();
/** 同日・複数パターンの状況差分を保持（キーは営業状況ベース） */
const SUMMARY_CACHE_MAX = 128;

function fallbackManagerBriefing(input: ManagerBriefingInput): string {
  if (input.totalUnique <= 0) {
    return normalizeBriefingText(
      "今日はTODOにお客様はいません。余裕のあるときに顧客リストを眺めてみてください。"
    );
  }

  const b = input.breakdown;
  if (b.BIRTHDAY > 0) {
    return normalizeBriefingText(
      `誕生日が近いお客様が${b.BIRTHDAY}名います。\n今日は自然なお祝いLINEから始めましょう。`
    );
  }
  if (b.THANK_YOU > 0) {
    return normalizeBriefingText(
      `来店後のお礼候補が${b.THANK_YOU}名います。\n熱が冷めないうちに、軽く感謝を伝えましょう。`
    );
  }
  if (b.LONG_GAP > 0) {
    return normalizeBriefingText(
      `久しぶりのお客様が${b.LONG_GAP}名います。\n重くならない一言で、少しずつ距離を戻しましょう。`
    );
  }
  if (b.MEMO > 0) {
    return normalizeBriefingText(
      `接客メモを更新したお客様が${b.MEMO}名います。\nメモの流れで、さりげなく雑談から始めましょう。`
    );
  }
  return normalizeBriefingText("今日は無理のない範囲で、軽い一言から連絡を始めましょう。");
}

async function generateManagerBriefingOpenAI(input: ManagerBriefingInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    liaAiLog("fallback used", { feature: "manager_summary", reason: "no_api_key" });
    return fallbackManagerBriefing(input);
  }

  const client = new OpenAI({ apiKey });
  const user = `${MANAGER_BRIEFING_USER_PREFIX}\n${JSON.stringify(
    {
      totalUnique: input.totalUnique,
      breakdownByPrimaryGroup: input.breakdown,
      hint: "topCustomerは画面の別行に表示するため、本文に名前を書かない。内訳リストは画面表示済みのため本文では繰り返さない。",
    },
    null,
    2
  )}`;

  try {
    liaAiLog("OpenAI start", { feature: "manager_summary" });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 120,
      messages: [
        { role: "system", content: MANAGER_BRIEFING_SYSTEM },
        { role: "user", content: user },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) {
      liaAiLog("fallback used", { feature: "manager_summary", reason: "empty_completion" });
      return fallbackManagerBriefing(input);
    }
    liaAiLog("OpenAI success", { feature: "manager_summary" });
    return normalizeBriefingText(text);
  } catch {
    liaAiLog("fallback used", { feature: "manager_summary", reason: "api_error" });
    return fallbackManagerBriefing(input);
  }
}

/**
 * 東京日付＋TODO内訳＋最優先顧客ID/スコアでキャッシュ。
 * 同一営業状況のリロードは hit、顧客・来店・メモ・スコアで状況が変われば miss。
 */
export async function getOrGenerateManagerBriefing(
  input: ManagerBriefingInput,
  at: Date
): Promise<string> {
  if (input.totalUnique <= 0) {
    return fallbackManagerBriefing(input);
  }

  const cacheKey = buildManagerSummaryCacheKey(input, at);
  const hit = summaryCache.get(cacheKey);
  if (hit !== undefined) {
    liaAiLog("cache hit", { feature: "manager_summary" });
    return hit;
  }

  liaAiLog("cache miss", { feature: "manager_summary" });
  const text = await generateManagerBriefingOpenAI(input);
  if (summaryCache.size >= SUMMARY_CACHE_MAX) {
    const first = summaryCache.keys().next().value as string | undefined;
    if (first) summaryCache.delete(first);
  }
  summaryCache.set(cacheKey, text);
  return text;
}
