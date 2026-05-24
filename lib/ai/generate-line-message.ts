import OpenAI from "openai";
import type { ConversationThemeResult } from "@/lib/ai-conversation";
import type { ConversationIntentResult } from "@/lib/ai-intent";
import {
  buildAdaptivePersonaForPrompt,
  type PersonaProfile,
} from "@/lib/persona-builder";
import { SALES_KNOWLEDGE_PROMPT_BLOCK } from "@/lib/sales-knowledge";
import { liaAiLog } from "@/lib/ai-log";

type GenerateLineMessageInput = {
  customer: {
    name: string;
    lineName?: string | null;
    birthday?: Date | null;
    favoriteDrink?: string | null;
    hobby?: string | null;
    relationshipMemo?: string | null;
    tags?: string[];
    lastVisitDate?: Date | null;
  };
  recentNotes?: Array<{ content: string; createdAt: Date }>;
  recentVisits?: Array<{ visitedAt: Date; amount?: number | null; memo?: string | null }>;
  purpose: string;
  tone: string;
  additionalInstruction?: string;
  /** 追加指示を会話テーマへ変換した結果（空メモ時は null） */
  conversationPlan?: ConversationThemeResult | null;
  intentClassification?: ConversationIntentResult | null;
  conversationReferences?: { recommendations: string[] } | null;
  /** Phase 2–8: 採用学習から推定したペルソナ（フィードバック0件時は null 可） */
  personaProfile?: PersonaProfile | null;
};

export type LineMessageDummyReason = "NO_API_KEY" | "API_ERROR" | "EMPTY_RESPONSE";

export type GenerateLineMessageResult = {
  variants: string[]; // 3案
  combinedText: string; // DB保存用にまとめたテキスト
  isDummy: boolean;
  /** isDummy のときのみ。UI 用（キー未設定と API 失敗を区別） */
  dummyReason?: LineMessageDummyReason;
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** system 全体：固定ブロックのみ（日付・顧客・メモは含めない） */
const LINE_MESSAGE_SYSTEM_PROMPT = [
  "あなたは夜職のキャストが送るLINE文面を作るアシスタントです。",
  "",
  "## 文体・トーンのルール（固定）",
  "- LINEでそのまま送れる自然な日本語",
  "- 営業感を出しすぎない（押し売り・圧・強い来店誘導を避ける）",
  "- 相手との距離感を守る（馴れ馴れしすぎない／丁寧すぎて不自然にしない）",
  "- 1案あたり1〜3文程度、長すぎない（※adaptivePersona があるときは directives で短文指示が優先され得る）",
  "- 改行は自然に（通常は必要なら1回まで。※adaptivePersona.directives に改行多めがあるときはそちらを優先）",
  "- 絵文字はtoneに応じて調整（※adaptivePersona.directives があればそちらを優先）",
  "- 過度に甘すぎない、煽らない",
  "- 性的/過激な内容にしない",
  "- 顧客情報は無理に全部入れない（自然に入るものだけ）",
  "- 直近メモがあれば「要点を1つだけ」自然に反映する（詰め込み禁止）",
  "- 返信しやすい文末（質問/軽い確認/相手の負担が少ない言い方）",
  "- 3案は表現を少しずつ変える（同じ言い回しを繰り返さない）",
  "",
  "## 追加指示（ひとことメモ）と conversationPlan",
  "- JSON の generation.conversationPlan があるとき、それは利用者メモを「LINEで軽く触れられる雑談の角度」に変換したものです。",
  "- テーマは**会話の方向**として使い、ラベルをそのまま文中に並べたり、経済解説・ニュース解説・説教調にしないこと。",
  "- conversationPlan.avoid に近いニュアンス（重い・知的すぎ・評論っぽい等）は避ける。",
  "- generation.rawAdditionalInstruction は参照用。本文は conversationPlan の温度感とテーマに沿った自然な一言に落とす。",
  "",
  "## conversationReferences（具体候補）※重要",
  "- generation.conversationReferences.recommendations に1件以上あるとき、それらは**会話のきっかけ用の固有名候補**（実在保証なし・ネタ扱い）。",
  "",
  "### このブロックがあるときの必須ルール（抽象化だけにしない）",
  "- **3案のうち最低1案**は、候補リストから**店名などを正確な表記のまま1つだけ**本文に含める（コピペ可能な表記）。",
  "- **できれば案1または案2**に入れる。案3だけ具体名・案1・2が抽象質問だけ、は避ける。",
  "- **1案につき使う候補名は最大1つ**（1案に2店名以上は禁止）。",
  "- **全候補を列挙しない**。「おすすめ店一覧」「いくつかあります」系も禁止。",
  "- 「調べたら出てきました」「リサーチしました」など**作業報告調は薄く**（基本は日常の一言）。",
  "- **説明文・レビューサイト調は禁止**。短い雑談＋返信しやすい一言。",
  "",
  "### 悪い例（禁止に近い）",
  "- 「渋谷にはA、B、Cがあります！」（列挙）",
  "- 「渋谷のカフェでおすすめありますか？」（具体候補を無視した抽象だけ）",
  "- 「どんなカフェが好きですか？」だけで具体名ゼロ（候補があるときは不可）",
  "",
  "### 良い例",
  "- 「最近、渋谷のTRUNK(CAFE)ってとこ気になってるんですけど、行ったことあります？☕️」",
  "- 「ABOUT LIFE COFFEE BREWERSってカフェ見つけたんですけど、雰囲気よさそうで気になってます☺️」",
  "- 「渋谷のREC COFFEEって知ってます？今度カフェの話も聞きたいです☕️」",
  "",
  "## adaptivePersona（Phase 2-8・任意）",
  "- generation.adaptivePersona があるとき、**Persona Intelligence**（このキャストの採用傾向）に合わせて本文を調整する。",
  "- **directives** の各文は守ること。purpose / tone / conversationPlan と矛盾する場合は、**長さ・改行・絵文字・押しの弱さ・雑談入り**について directives を優先（具体店名の必須ルールなど他セクションのハード制約と両立させる）。",
  "- feedbackSampleSize は参考（件数が少なくても、示された傾向は尊重）。",
  "",
  SALES_KNOWLEDGE_PROMPT_BLOCK,
  "",
  "## 出力形式（固定・厳守）",
  "出力は必ず次の形式だけ。余計な前置きや解説は禁止。",
  "",
  "案1:",
  "（本文）",
  "",
  "案2:",
  "（本文）",
  "",
  "案3:",
  "（本文）",
].join("\n");

/** user メッセージ先頭の固定句（可変JSONより前） */
const LINE_MESSAGE_USER_PREFIX =
  "以下のJSONは当該顧客・直近メモ・来店の可変データです。purpose / tone を優先し、追加の会話意図は generation.conversationPlan（あれば）を会話テーマとして反映してください。generation.adaptivePersona（あれば）はこのユーザーの採用傾向に基づく適応ルールとして反映してください。generation.conversationReferences.recommendations がある場合はシステム指示の「必須ルール」を厳守し、**抽象質問だけの3案にしないこと**。上記フォーマットのみ出力してください。\n";

function textMentionsAnyRecommendation(body: string, recommendations: string[]): boolean {
  const t = body;
  for (const r of recommendations) {
    const name = r.trim();
    if (name && t.includes(name)) return true;
  }
  return false;
}

/** LOCAL_RECOMMENDATION でモデルが具体名を落としたときの最低限の補正（案1のみ） */
function buildLocalRecommendationFallbackLine(primaryName: string, location?: string | null): string {
  const loc = location?.trim();
  if (loc) {
    return `最近、${loc}の${primaryName}ってとこ気になってるんですけど、行ったことあります？☕️`;
  }
  return `最近、${primaryName}ってカフェ気になってるんですけど、行ったことあります？☕️`;
}

function ensureLocalRecommendationConcreteNames(input: {
  variants: string[];
  recommendations: string[];
  intent: string | undefined;
  location?: string | null;
}): string[] {
  const { variants, recommendations, intent, location } = input;
  if (intent !== "LOCAL_RECOMMENDATION" || recommendations.length === 0) return variants;
  if (variants.length < 1) return variants;
  const joined = variants.join("\n");
  if (textMentionsAnyRecommendation(joined, recommendations)) return variants;
  const primary = recommendations[0]?.trim();
  if (!primary) return variants;
  const next = [...variants];
  next[0] = buildLocalRecommendationFallbackLine(primary, location);
  liaAiLog("post-process", { feature: "line_generate", reason: "missing_concrete_recommendation" });
  return next;
}

function dummy(reason: LineMessageDummyReason): GenerateLineMessageResult {
  const variants = [
    "この前はありがとう！またゆっくり話せたらうれしいです。",
    "最近忙しそうだけど、体調大丈夫？落ち着いたらまた飲みに来てね。",
    "この前話してたこと、また続き聞かせてください。無理ないタイミングで！",
  ];
  return {
    variants,
    combinedText: variants.map((t, i) => `案${i + 1}:\n${t}`).join("\n\n"),
    isDummy: true,
    dummyReason: reason,
  };
}

export async function generateLineMessage(
  input: GenerateLineMessageInput
): Promise<GenerateLineMessageResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    liaAiLog("fallback used", { feature: "line_generate", reason: "no_api_key" });
    return dummy("NO_API_KEY");
  }

  const client = new OpenAI({ apiKey });

  const customer = input.customer;
  const memoTrim = input.additionalInstruction?.trim() || "";
  const p = input.conversationPlan;
  const plan =
    memoTrim && p
      ? p.conversationThemes.length > 0 || p.summary.trim() || p.toneHint.trim()
        ? p
        : null
      : null;

  const ic = input.intentClassification;
  const intentClassification =
    memoTrim && ic
      ? {
          intent: ic.intent,
          keywords: ic.keywords,
          location: ic.location ?? null,
          category: ic.category ?? null,
          needsRealInformation: ic.needsRealInformation,
        }
      : null;

  const refs = input.conversationReferences?.recommendations ?? [];
  const conversationReferences =
    memoTrim && refs.length > 0 ? { recommendations: [...refs] } : null;

  const adaptivePersona =
    input.personaProfile && input.personaProfile.feedbackSampleSize > 0
      ? buildAdaptivePersonaForPrompt(input.personaProfile)
      : null;

  const context = {
    customer: {
      customerName: customer.name,
      lineName: customer.lineName ?? null,
      birthday: customer.birthday ? formatDate(customer.birthday) : null,
      favoriteDrink: customer.favoriteDrink ?? null,
      hobby: customer.hobby ?? null,
      relationshipMemo: customer.relationshipMemo ?? null,
      tags: customer.tags ?? [],
      lastVisitDate: customer.lastVisitDate ? formatDate(customer.lastVisitDate) : null,
    },
    recentNotes: (input.recentNotes ?? []).slice(0, 3).map((n) => ({
      content: n.content,
      createdAt: formatDate(n.createdAt),
    })),
    recentVisits: (input.recentVisits ?? []).slice(0, 3).map((v) => ({
      visitedAt: formatDate(v.visitedAt),
      amount: v.amount ?? null,
      memo: v.memo ?? null,
    })),
    generation: {
      purpose: input.purpose,
      tone: input.tone,
      rawAdditionalInstruction: memoTrim || null,
      conversationPlan: plan,
      intentClassification,
      conversationReferences,
      adaptivePersona,
    },
  };

  const refsReminder =
    conversationReferences && conversationReferences.recommendations.length > 0
      ? [
          "",
          "【出力前チェック】generation.conversationReferences.recommendations がある。",
          "- 案1または案2に、リストの表記どおりの店名を1つ含める（最低1案。可能なら2案）。",
          "- 3案すべて「おすすめありますか？」等の抽象だけにしない。",
        ].join("\n")
      : "";

  const user = `${LINE_MESSAGE_USER_PREFIX}${refsReminder}\n${JSON.stringify(context, null, 2)}`;

  try {
    liaAiLog("OpenAI start", { feature: "line_generate" });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: LINE_MESSAGE_SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    });

    const text = res.choices[0]?.message?.content?.trim();
    if (!text) {
      liaAiLog("fallback used", { feature: "line_generate", reason: "empty_completion" });
      return dummy("EMPTY_RESPONSE");
    }

    const variants: string[] = [];
    const re = /(?:^|\n)\s*案([1-3])\s*[:：]\s*\n?/g;
    const matches = Array.from(text.matchAll(re));
    if (matches.length >= 1) {
      for (let i = 0; i < matches.length; i++) {
        const idx = Number(matches[i][1]);
        const start = (matches[i].index ?? 0) + matches[i][0].length;
        const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
        variants[idx - 1] = text.slice(start, end).trim();
      }
    }

    const normalized = variants.filter((v) => typeof v === "string" && v.trim().length > 0);
    let finalVariants =
      normalized.length >= 3
        ? [variants[0], variants[1], variants[2]].map((v) => (v ?? "").trim())
        : [text, ...dummy("EMPTY_RESPONSE").variants.slice(1)];

    finalVariants = ensureLocalRecommendationConcreteNames({
      variants: finalVariants,
      recommendations: refs,
      intent: ic?.intent,
      location: ic?.location ?? null,
    });

    liaAiLog("OpenAI success", { feature: "line_generate" });
    return {
      variants: finalVariants,
      combinedText: finalVariants.map((t, i) => `案${i + 1}:\n${t}`).join("\n\n"),
      isDummy: false,
    };
  } catch {
    liaAiLog("fallback used", { feature: "line_generate", reason: "api_error" });
    return dummy("API_ERROR");
  }
}

