import { createHash } from "crypto";
import OpenAI from "openai";
import { liaAiLog } from "@/lib/ai-log";

export type ConversationIntent =
  | "SMALL_TALK"
  | "LOCAL_RECOMMENDATION"
  | "NEWS_TOPIC"
  | "FOOD_TOPIC"
  | "MOVIE_TOPIC"
  | "CARE_MESSAGE"
  | "OTHER";

export type ConversationIntentResult = {
  intent: ConversationIntent;
  keywords: string[];
  location?: string;
  category?: string;
  needsRealInformation: boolean;
};

const INTENT_CACHE_MAX = 512;
const intentCache = new Map<string, ConversationIntentResult>();

function buildIntentCacheKey(memo: string): string {
  const h = createHash("sha256").update(memo.trim(), "utf8").digest("hex").slice(0, 32);
  return `intent-classification:${h}`;
}

const INTENTS: ConversationIntent[] = [
  "SMALL_TALK",
  "LOCAL_RECOMMENDATION",
  "NEWS_TOPIC",
  "FOOD_TOPIC",
  "MOVIE_TOPIC",
  "CARE_MESSAGE",
  "OTHER",
];

function normalizeIntent(s: string): ConversationIntent {
  const u = s.trim().toUpperCase().replace(/-/g, "_");
  if (INTENTS.includes(u as ConversationIntent)) return u as ConversationIntent;
  return "OTHER";
}

function parseIntentJson(raw: string): ConversationIntentResult | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const intent = normalizeIntent(String(o.intent ?? "OTHER"));
    const kw = o.keywords;
    const keywords = Array.isArray(kw)
      ? kw.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 12)
      : [];
    const location = typeof o.location === "string" && o.location.trim() ? o.location.trim().slice(0, 40) : undefined;
    const category = typeof o.category === "string" && o.category.trim() ? o.category.trim().slice(0, 40) : undefined;
    const needsRealInformation = Boolean(o.needsRealInformation);
    return { intent, keywords, location, category, needsRealInformation };
  } catch {
    return null;
  }
}

const INTENT_SYSTEM = [
  "あなたは夜職向け営業支援「Lia」の、意図分類モジュールです。",
  "",
  "## 目的（重要）",
  "利用者の「ひとことメモ」から**何を話したいか**ではなく、**AI側が何を補完すべきか**を判定する。",
  "- 固有名・店名・具体例が必要か（needsRealInformation）",
  "- エリア・カテゴリの抽出（あれば）",
  "",
  "## intent の意味",
  "- SMALL_TALK: 特に補完不要な軽い雑談・ふわっとした相談",
  "- LOCAL_RECOMMENDATION: エリア＋飲食店・カフェ等の「場所のおすすめ・名前言及」が欲しい",
  "- NEWS_TOPIC: 時事・ニュース系の話題に触れたい（まだ検索はしない前提で分類のみ）",
  "- FOOD_TOPIC: 食・グルメ全般（店名が欲しい場合は needsRealInformation true にしやすい）",
  "- MOVIE_TOPIC: 映画・作品の話",
  "- CARE_MESSAGE: 労い・体調・無理しない系",
  "- OTHER: 上記に当てはまらない",
  "",
  "## needsRealInformation",
  "true にする例：「具体的な店名」「調べて」「おすすめを教えて」「名前言及」など**実在っぽいネタの補完**が要るとき。",
  "false：雰囲気・トーンだけで足りるとき。",
  "",
  "## 出力",
  "- JSONオブジェクト1つのみ。キー: intent (上記いずれかの文字列), keywords (短い語の配列 0〜8), location (任意), category (任意・例: カフェ), needsRealInformation (boolean)",
  "- 日本語の location/category はそのまま短く。",
].join("\n");

/** キー未設定・API失敗時のルールベース分類 */
export function fallbackConversationIntent(memo: string): ConversationIntentResult {
  const m = memo.trim();
  if (!m) {
    return { intent: "OTHER", keywords: [], needsRealInformation: false };
  }

  if (/体調|無理しない|お疲れ|大丈夫|気をつけ|寒い|暑い|季節/i.test(m)) {
    return {
      intent: "CARE_MESSAGE",
      keywords: ["労い", "近況"],
      needsRealInformation: false,
    };
  }

  if (/映画|ドラマ|ネトフリ|作品|観た/i.test(m)) {
    return {
      intent: "MOVIE_TOPIC",
      keywords: ["映画", "作品"],
      needsRealInformation: /おすすめ|何が|名前/i.test(m),
    };
  }

  if (/ニュース|時事|最近の世の中/i.test(m)) {
    return {
      intent: "NEWS_TOPIC",
      keywords: ["ニュース"],
      needsRealInformation: false,
    };
  }

  if (
    /渋谷|新宿|恵比寿|表参道|カフェ|コーヒー|店|おすすめ|グルメ|ランチ|ディナー|レストラン|美味しい/i.test(
      m
    )
  ) {
    let location: string | undefined;
    if (/渋谷|シブヤ/i.test(m)) location = "渋谷";
    else if (/新宿/i.test(m)) location = "新宿";
    else if (/恵比寿|エビス/i.test(m)) location = "恵比寿";
    else if (/表参道|オモテ/i.test(m)) location = "表参道";

    let category: string | undefined;
    if (/カフェ|コーヒー|cafe/i.test(m)) category = "カフェ";
    else if (/レストラン|飲食|グルメ|ランチ|ディナー/i.test(m)) category = "グルメ";

    const needsRealInformation =
      /具体的|店名|名前|調べ|おすすめ|どこ|スポット/i.test(m) ||
      (/カフェ|コーヒー|店|グルメ|レストラン/i.test(m) && /渋谷|新宿|恵比寿|表参道/i.test(m));

    return {
      intent: "LOCAL_RECOMMENDATION",
      keywords: location ? [location] : [],
      location,
      category,
      needsRealInformation,
    };
  }

  if (/ごはん|食べ|スイーツ|料理/i.test(m)) {
    return {
      intent: "FOOD_TOPIC",
      keywords: ["食べ物"],
      needsRealInformation: /おすすめ|店|具体的/i.test(m),
    };
  }

  return {
    intent: "SMALL_TALK",
    keywords: [],
    needsRealInformation: false,
  };
}

export async function classifyConversationIntent(input: {
  memo: string;
}): Promise<ConversationIntentResult> {
  const memo = input.memo?.trim() ?? "";
  if (!memo) {
    return { intent: "OTHER", keywords: [], needsRealInformation: false };
  }

  const cacheKey = buildIntentCacheKey(memo);
  const hit = intentCache.get(cacheKey);
  if (hit) {
    liaAiLog("cache hit", { feature: "intent_classification" });
    return hit;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    liaAiLog("fallback used", { feature: "intent_classification", reason: "no_api_key" });
    const fb = fallbackConversationIntent(memo);
    if (intentCache.size >= INTENT_CACHE_MAX) {
      const first = intentCache.keys().next().value as string | undefined;
      if (first) intentCache.delete(first);
    }
    intentCache.set(cacheKey, fb);
    return fb;
  }

  const client = new OpenAI({ apiKey });
  try {
    liaAiLog("OpenAI start", { feature: "intent_classification" });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INTENT_SYSTEM },
        {
          role: "user",
          content: `次のメモを分類し、指定スキーマのJSONだけを返してください。\n\nメモ:\n${memo}`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) {
      liaAiLog("fallback used", { feature: "intent_classification", reason: "empty_completion" });
      const fb = fallbackConversationIntent(memo);
      if (intentCache.size >= INTENT_CACHE_MAX) {
        const first = intentCache.keys().next().value as string | undefined;
        if (first) intentCache.delete(first);
      }
      intentCache.set(cacheKey, fb);
      return fb;
    }
    const parsed = parseIntentJson(text);
    if (!parsed) {
      liaAiLog("fallback used", { feature: "intent_classification", reason: "parse_error" });
      const fb = fallbackConversationIntent(memo);
      if (intentCache.size >= INTENT_CACHE_MAX) {
        const first = intentCache.keys().next().value as string | undefined;
        if (first) intentCache.delete(first);
      }
      intentCache.set(cacheKey, fb);
      return fb;
    }
    liaAiLog("OpenAI success", { feature: "intent_classification" });
    if (intentCache.size >= INTENT_CACHE_MAX) {
      const first = intentCache.keys().next().value as string | undefined;
      if (first) intentCache.delete(first);
    }
    intentCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    liaAiLog("fallback used", { feature: "intent_classification", reason: "api_error" });
    const fb = fallbackConversationIntent(memo);
    if (intentCache.size >= INTENT_CACHE_MAX) {
      const first = intentCache.keys().next().value as string | undefined;
      if (first) intentCache.delete(first);
    }
    intentCache.set(cacheKey, fb);
    return fb;
  }
}
