import OpenAI from "openai";
import {
  MessagePurpose,
  MessageTone,
} from "@prisma/client";
import { SALES_KNOWLEDGE, SALES_KNOWLEDGE_PROMPT_BLOCK } from "@/lib/sales-knowledge";
import { purposeLabel, toneLabel } from "@/lib/labels";
import {
  buildSalesReasonCacheKey,
  getCachedSalesReason,
  setCachedSalesReason,
  type SalesReasonFormat,
} from "@/lib/ai-sales-cache";
import { liaAiLog } from "@/lib/ai-log";

/** 営業ルールエンジンへの入力（DB非依存のプレーン形） */
export type SalesCustomerContext = {
  id: string;
  name: string;
  tags: string[];
  lastVisitDate: Date | null;
  birthday: Date | null;
  /** 直近メモの更新日時（なければ null） */
  latestNoteUpdatedAt: Date | null;
};

export type SalesPriority = "高" | "中" | "低";

export type AiSalesProposal = {
  customerId: string;
  customerName: string;
  score: number;
  priority: SalesPriority;
  purpose: MessagePurpose;
  tone: MessageTone;
  /** UI用：例「自然・営業感弱め」 */
  temperatureSummary: string;
  /** おすすめ表現（目的の日本語ラベルベース） */
  suggestedLineLabel: string;
  /** GPTまたはテンプレートによる説明 */
  aiReason: string;
  /** ルール側のシグナル（説明・ログ用） */
  ruleSignals: string[];
};

function hasTag(ctx: SalesCustomerContext, needle: string) {
  return ctx.tags.some((t) => t.includes(needle));
}

function daysBetween(a: Date, b: Date) {
  const ms = 1000 * 60 * 60 * 24;
  return Math.floor((a.getTime() - b.getTime()) / ms);
}

function nextBirthday(birthday: Date, today = new Date()) {
  const next = new Date(today);
  next.setHours(0, 0, 0, 0);
  next.setMonth(birthday.getMonth(), birthday.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return next;
}

/** 0〜100。ルールのみ。GPTは使わない。 */
export function calculateSalesScore(ctx: SalesCustomerContext, today = new Date()): number {
  let score = 22;

  if (ctx.lastVisitDate) {
    const d = daysBetween(today, ctx.lastVisitDate);
    if (d >= 0 && d <= SALES_KNOWLEDGE.POST_VISIT.thankYouWindowDays) {
      score += 30;
    } else if (d >= 4 && d <= 13) {
      score += 12;
    } else if (d >= SALES_KNOWLEDGE.LONG_GAP.minDaysSinceVisit) {
      score += 24;
    } else {
      score += 8;
    }
  } else {
    score += 6;
  }

  if (ctx.birthday) {
    const nb = nextBirthday(ctx.birthday, today);
    const until = daysBetween(nb, today);
    if (until >= 0 && until <= 7) score += 26;
    else if (until >= 8 && until <= 14) score += 12;
  }

  if (hasTag(ctx, "VIP")) score += 14;
  if (hasTag(ctx, "返信薄め")) score += 10;
  if (ctx.latestNoteUpdatedAt) {
    const nd = daysBetween(today, ctx.latestNoteUpdatedAt);
    if (nd >= 0 && nd <= 3) score += 12;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreToPriority(score: number): SalesPriority {
  if (score >= 72) return "高";
  if (score >= 45) return "中";
  return "低";
}

/** ルールで目的を決定（GPTに任せない） */
export function getSuggestedPurpose(
  ctx: SalesCustomerContext,
  today = new Date()
): MessagePurpose {
  const dVisit = ctx.lastVisitDate
    ? daysBetween(today, ctx.lastVisitDate)
    : 999;

  if (ctx.lastVisitDate && dVisit >= 0 && dVisit <= SALES_KNOWLEDGE.POST_VISIT.thankYouWindowDays) {
    return MessagePurpose.THANK_YOU;
  }

  if (ctx.birthday) {
    const nb = nextBirthday(ctx.birthday, today);
    const until = daysBetween(nb, today);
    if (until >= 0 && until <= 7) return MessagePurpose.BIRTHDAY;
  }

  if (dVisit >= SALES_KNOWLEDGE.LONG_GAP.minDaysSinceVisit) {
    return MessagePurpose.LONG_TIME_NO_SEE;
  }

  if (ctx.latestNoteUpdatedAt) {
    const nd = daysBetween(today, ctx.latestNoteUpdatedAt);
    if (nd >= 0 && nd <= 3) return MessagePurpose.CASUAL_CHAT;
  }

  return MessagePurpose.CASUAL_CHAT;
}

/** ナレッジ＋目的で文体を決定（GPTに任せない） */
export function getSuggestedTone(
  ctx: SalesCustomerContext,
  purpose: MessagePurpose,
  today = new Date()
): MessageTone {
  if (hasTag(ctx, "返信薄め")) {
    return SALES_KNOWLEDGE.LOW_RESPONSE.recommendedTone;
  }
  if (hasTag(ctx, "VIP")) {
    return SALES_KNOWLEDGE.VIP.recommendedTone;
  }
  if (purpose === MessagePurpose.BIRTHDAY) {
    return SALES_KNOWLEDGE.BIRTHDAY.recommendedTone;
  }
  if (purpose === MessagePurpose.THANK_YOU) {
    return SALES_KNOWLEDGE.THANK_YOU.recommendedTone;
  }
  if (purpose === MessagePurpose.LONG_TIME_NO_SEE) {
    return SALES_KNOWLEDGE.LONG_GAP.recommendedTone;
  }
  return MessageTone.NATURAL;
}

function buildRuleSignals(
  ctx: SalesCustomerContext,
  purpose: MessagePurpose,
  tone: MessageTone,
  today: Date
): string[] {
  const signals: string[] = [];
  if (hasTag(ctx, "VIP")) signals.push("VIP傾向");
  if (hasTag(ctx, "返信薄め")) signals.push("返信薄め");
  if (ctx.lastVisitDate) {
    const d = daysBetween(today, ctx.lastVisitDate);
    if (d >= 0 && d <= SALES_KNOWLEDGE.POST_VISIT.thankYouWindowDays) {
      signals.push(`来店から${d}日以内`);
    } else if (d >= SALES_KNOWLEDGE.LONG_GAP.minDaysSinceVisit) {
      signals.push("前回来店から間隔あり");
    }
  }
  if (ctx.birthday) {
    const nb = nextBirthday(ctx.birthday, today);
    const until = daysBetween(nb, today);
    if (until >= 0 && until <= 7) signals.push("誕生日が近い");
  }
  if (ctx.latestNoteUpdatedAt) {
    const nd = daysBetween(today, ctx.latestNoteUpdatedAt);
    if (nd >= 0 && nd <= 3) signals.push("接客メモ更新あり");
  }
  signals.push(`Lia提案:${purposeLabel(purpose)}/${toneLabel(tone)}`);
  return signals;
}

function temperatureSummary(ctx: SalesCustomerContext, tone: MessageTone): string {
  const parts: string[] = [toneLabel(tone)];
  if (hasTag(ctx, "VIP") || tone === MessageTone.NATURAL) {
    parts.push("営業感弱め");
  }
  if (hasTag(ctx, "返信薄め")) {
    parts.push("短文寄り");
  }
  return parts.filter(Boolean).join("・");
}

/** ルールのみ（GPT不要）。ホームでは全件これでスコア順し、上位だけ理由生成 */
export function buildAiSalesProposalCore(
  ctx: SalesCustomerContext,
  today = new Date()
): Omit<AiSalesProposal, "aiReason"> {
  const score = calculateSalesScore(ctx, today);
  const priority = scoreToPriority(score);
  const purpose = getSuggestedPurpose(ctx, today);
  const tone = getSuggestedTone(ctx, purpose, today);
  const ruleSignals = buildRuleSignals(ctx, purpose, tone, today);
  return {
    customerId: ctx.id,
    customerName: ctx.name,
    score,
    priority,
    purpose,
    tone,
    temperatureSummary: temperatureSummary(ctx, tone),
    suggestedLineLabel: purposeLabel(purpose),
    ruleSignals,
  };
}

/** ホームTODOのグループ（表示は最優先グループのみ。順：誕生日 → お礼 → 久しぶり → メモ） */
export type TodoBucketKey = "BIRTHDAY" | "THANK_YOU" | "LONG_GAP" | "MEMO";

export type CustomerTodoFlags = {
  birthdaySoon: boolean;
  postVisitThankYou: boolean;
  longTimeNoSee: boolean;
  memoRecentlyUpdated: boolean;
};

function isWithinDaysFromToday(date: Date, withinDays: number, today: Date): boolean {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + withinDays);
  return date >= start && date <= end;
}

/** `getHomeRecommendations` と同じ閾値でフラグを付与 */
export function computeCustomerTodoFlags(
  ctx: SalesCustomerContext,
  today = new Date()
): CustomerTodoFlags {
  const flags: CustomerTodoFlags = {
    birthdaySoon: false,
    postVisitThankYou: false,
    longTimeNoSee: false,
    memoRecentlyUpdated: false,
  };
  if (ctx.lastVisitDate) {
    const diff = daysBetween(today, ctx.lastVisitDate);
    if (diff >= 14) flags.longTimeNoSee = true;
    if (diff >= 0 && diff <= 3) flags.postVisitThankYou = true;
  }
  if (ctx.birthday) {
    const nb = nextBirthday(ctx.birthday, today);
    if (isWithinDaysFromToday(nb, 7, today)) flags.birthdaySoon = true;
  }
  if (ctx.latestNoteUpdatedAt) {
    const diff = daysBetween(today, ctx.latestNoteUpdatedAt);
    if (diff >= 0 && diff <= 3) flags.memoRecentlyUpdated = true;
  }
  return flags;
}

export function assignPrimaryTodoBucket(flags: CustomerTodoFlags): TodoBucketKey | null {
  if (flags.birthdaySoon) return "BIRTHDAY";
  if (flags.postVisitThankYou) return "THANK_YOU";
  if (flags.longTimeNoSee) return "LONG_GAP";
  if (flags.memoRecentlyUpdated) return "MEMO";
  return null;
}

/** カードに載せる「該当理由」一覧（複数該当もすべて表示。グループは primary のみ） */
export function todoReasonLinesForDisplay(flags: CustomerTodoFlags): string[] {
  const lines: string[] = [];
  if (flags.birthdaySoon) lines.push("誕生日が近い");
  if (flags.postVisitThankYou) lines.push("来店後のお礼LINE候補");
  if (flags.longTimeNoSee) lines.push("前回来店から14日以上経過");
  if (flags.memoRecentlyUpdated) lines.push("接客メモ更新あり");
  return lines;
}

export function todoSectionTitleJa(bucket: TodoBucketKey): string {
  switch (bucket) {
    case "BIRTHDAY":
      return "誕生日が近い";
    case "THANK_YOU":
      return "来店後のお礼候補";
    case "LONG_GAP":
      return "久しぶり連絡";
    case "MEMO":
      return "接客メモ更新あり";
  }
}

/** ホームTODO折りたたみ summary 用の一行説明 */
export function todoGroupCollapsibleHintJa(bucket: TodoBucketKey): string {
  switch (bucket) {
    case "BIRTHDAY":
      return "自然なお祝いLINE向け";
    case "THANK_YOU":
      return "熱が冷めないうちに軽く一言";
    case "LONG_GAP":
      return "重くならない近況LINE向け";
    case "MEMO":
      return "メモを使った自然な雑談向け";
  }
}

/** ホームTODOカード用のやわらかい一文（数値なし） */
export function todoCardGentleHint(bucket: TodoBucketKey): string {
  switch (bucket) {
    case "BIRTHDAY":
      return "誕生日が近いです。今送ると自然です。";
    case "THANK_YOU":
      return "来店直後です。軽いお礼からがちょうどいいかも。";
    case "LONG_GAP":
      return "ご無沙汰が続いています。負担の少ない一言から。";
    case "MEMO":
      return "メモを書いた流れで、さりげなく一言。";
  }
}

export function messagePurposeForTodoBucket(bucket: TodoBucketKey): MessagePurpose {
  switch (bucket) {
    case "BIRTHDAY":
      return MessagePurpose.BIRTHDAY;
    case "THANK_YOU":
      return MessagePurpose.THANK_YOU;
    case "LONG_GAP":
      return MessagePurpose.LONG_TIME_NO_SEE;
    case "MEMO":
      return MessagePurpose.CASUAL_CHAT;
  }
}

/** ホーム用短文（1〜2文・約60〜120字）のフォールバック */
function fallbackReasonHomeBrief(input: {
  ctx: SalesCustomerContext;
  purpose: MessagePurpose;
  tone: MessageTone;
  ruleSignals: string[];
}): string {
  const { ctx, purpose, ruleSignals } = input;
  const pl = purposeLabel(purpose);
  const sigs = ruleSignals.filter((s) => !s.startsWith("Lia提案"));
  const shallowVisit = sigs.some((s) => /来店から\d+日以内/.test(s));
  const birthdaySoon = sigs.some((s) => s.includes("誕生日"));
  const longGap = sigs.some((s) => s.includes("間隔"));

  let s: string;
  if (hasTag(ctx, "返信薄め")) {
    s = `返信が薄めなので、長文より短く軽い近況の${pl}がおすすめです。`;
  } else if (birthdaySoon) {
    s = `誕生日が近いため、重くなりすぎない自然なお祝いの${pl}で関係性を保つのが良さそうです。`;
  } else if (hasTag(ctx, "VIP") && shallowVisit) {
    s = `VIP傾向があり、来店から日が浅いため、営業感を抑えた自然な${pl}がおすすめです。`;
  } else if (hasTag(ctx, "VIP")) {
    s = `VIP傾向があるため、営業感を抑えた自然な${pl}がおすすめです。`;
  } else if (shallowVisit) {
    s = `来店から日が浅いため、温度感を保つ自然な${pl}がおすすめです。`;
  } else if (longGap) {
    s = `ご無沙汰が続いているため、重すぎない軽い${pl}がおすすめです。`;
  } else {
    s = `${pl}で、相手の負担が少ない一文からがおすすめです。`;
  }
  return normalizeHomeBriefReason(s);
}

/** ホーム表示用：改行除去・冗長見出し除去・長すぎる場合は意味が切れにくい位置で省略 */
function normalizeHomeBriefReason(text: string, maxChars = 120): string {
  let t = text
    .replace(/^【AI分析（オフライン）】\s*/u, "")
    .replace(/^AI分析[：:]\s*/u, "")
    .trim();
  t = t.replace(/\s*\n+\s*/g, "");
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastStop = Math.max(
    cut.lastIndexOf("。"),
    cut.lastIndexOf("！"),
    cut.lastIndexOf("？"),
    cut.lastIndexOf("、")
  );
  if (lastStop >= Math.min(50, maxChars - 15)) {
    return cut.slice(0, lastStop + 1);
  }
  return `${cut.slice(0, maxChars - 1)}…`;
}

/** ホーム用 system：短文のみ（固定。日付・顧客名は含めない） */
const SALES_REASON_SYSTEM_PROMPT_HOME_BRIEF = [
  "あなたは「AI営業マネージャー」の要約コピーを書くアシスタントです。",
  "",
  "## 絶対条件",
  "- 営業判断はLiaがJSONで確定済み。変更・追加の判断はしない。",
  "- ユーザーのJSONの内容だけを、短い説明に落とす。",
  "- 出力は日本語の本文のみ（見出し・「AI分析：」・箇条書き・コードブロック禁止）。",
  "- 1〜2文。文字数目安は60〜120字。",
  "- 営業を煽らない。性的・過激な表現は禁止。",
  "- 顧客名は入れない（プライバシーと簡潔さのため）。",
  "",
  SALES_KNOWLEDGE_PROMPT_BLOCK,
  "",
  "## 出力の雰囲気（例・パターンの参考。コピペ禁止）",
  "- VIPや来店直後: 営業感を抑えた自然なお礼・軽い一言。",
  "- 誕生日近辺: 重くない自然なお祝い。",
  "- 返信薄め: 短文・軽い近況。",
].join("\n");

const SALES_REASON_USER_PREFIX_HOME_BRIEF =
  "以下のJSONを、上記の条件で1〜2文・60〜120字程度に要約してください。\n";

/** system メッセージ全体：固定のみ（日付・顧客名・動的データ禁止） */
const SALES_REASON_SYSTEM_PROMPT = [
  "あなたは「AI営業マネージャー」の説明文を書くアシスタントです。",
  "",
  "## 絶対条件",
  "- 営業判断（スコア・優先度・送信目的・文体・タグの解釈）はすでにLiaが決定済み。あなたは変更・再解釈をしない。",
  "- ユーザーメッセージに含まれるJSONの値のみを説明に反映する。新しい判断や推測で上書きしない。",
  "- 自然な日本語の説明のみ。見出しは「AI分析：」から始めてよい。",
  "- 2〜4文程度。箇条書きは使わない。",
  "- 営業を煽らない。性的・過激な表現は禁止。",
  "- 顧客名は自然に1回程度まで。",
  "",
  SALES_KNOWLEDGE_PROMPT_BLOCK,
  "",
  "## 出力フォーマット",
  "- 説明文のみ。コードブロックやJSONは出力しない。",
].join("\n");

/** user メッセージ先頭の固定句（可変JSONより前） */
const SALES_REASON_USER_PREFIX =
  "以下のJSONは当該顧客向けの可変データです。Liaの判断を変えず、説明文として自然な日本語に整えてください。\n";

function fallbackReason(input: {
  ctx: SalesCustomerContext;
  score: number;
  priority: SalesPriority;
  purpose: MessagePurpose;
  tone: MessageTone;
  ruleSignals: string[];
}): string {
  const { ctx, priority, purpose, tone, ruleSignals } = input;
  const name = ctx.name;
  return [
    "【AI分析（オフライン）】",
    `${name}さんは優先度「${priority}」、営業スコアはルールベースで算出しています。`,
    `おすすめは「${purposeLabel(purpose)}」で、温度感は「${temperatureSummary(ctx, tone)}」です。`,
    ruleSignals.length
      ? `主な根拠: ${ruleSignals.slice(0, 4).join("、")}。`
      : "",
    "押し売りせず、相手の負担が少ない一文から始めるのがおすすめです。",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * GPTは「説明文」の日本語化のみ。判断（スコア・目的・文体）はLia側。
 */
export async function generateSalesSuggestionReason(input: {
  ctx: SalesCustomerContext;
  score: number;
  priority: SalesPriority;
  purpose: MessagePurpose;
  tone: MessageTone;
  ruleSignals: string[];
  /** スコア算出と同一の基準日（キャッシュ dateKey に使用） */
  at: Date;
  /** standard=詳細。homeBrief=ホーム上位向け短文 */
  format?: SalesReasonFormat;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const { ctx, score, priority, purpose, tone, ruleSignals, at } = input;
  const format: SalesReasonFormat = input.format ?? "standard";

  const cacheKey = buildSalesReasonCacheKey({
    customerId: ctx.id,
    at,
    salesScore: score,
    purpose,
    tone,
    ruleSignals,
    format,
  });

  const cached = getCachedSalesReason(cacheKey);
  if (cached !== undefined) {
    liaAiLog("cache hit", { feature: "sales_reason", customerId: ctx.id });
    return cached;
  }

  liaAiLog("cache miss", { feature: "sales_reason", customerId: ctx.id });

  const finish = (text: string) => {
    setCachedSalesReason(cacheKey, text);
    return text;
  };

  if (!apiKey) {
    const text =
      format === "homeBrief" ? fallbackReasonHomeBrief(input) : fallbackReason(input);
    liaAiLog("fallback used", { feature: "sales_reason", reason: "no_api_key" });
    return finish(text);
  }

  const userPayload = {
    liaisonDecision: {
      salesScore: score,
      priority,
      suggestedPurpose: purpose,
      suggestedPurposeJa: purposeLabel(purpose),
      suggestedTone: tone,
      suggestedToneJa: toneLabel(tone),
      temperatureSummary: temperatureSummary(ctx, tone),
      ruleSignals,
    },
    customerProfile: {
      name: ctx.name,
      tags: ctx.tags,
      lastVisitDate: ctx.lastVisitDate?.toISOString() ?? null,
      birthday: ctx.birthday?.toISOString() ?? null,
      latestNoteUpdatedAt: ctx.latestNoteUpdatedAt?.toISOString() ?? null,
    },
  };

  const isBrief = format === "homeBrief";
  const systemPrompt = isBrief ? SALES_REASON_SYSTEM_PROMPT_HOME_BRIEF : SALES_REASON_SYSTEM_PROMPT;
  const user = isBrief
    ? `${SALES_REASON_USER_PREFIX_HOME_BRIEF}\n${JSON.stringify(userPayload, null, 2)}`
    : `${SALES_REASON_USER_PREFIX}\n${JSON.stringify(userPayload, null, 2)}`;

  const client = new OpenAI({ apiKey });

  try {
    liaAiLog("OpenAI start", { feature: "sales_reason" });
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: isBrief ? 0.45 : 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: user },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) {
      const fb = isBrief ? fallbackReasonHomeBrief(input) : fallbackReason(input);
      liaAiLog("fallback used", { feature: "sales_reason", reason: "empty_completion" });
      return finish(fb);
    }
    liaAiLog("OpenAI success", { feature: "sales_reason" });
    const out = isBrief
      ? normalizeHomeBriefReason(text)
      : text.startsWith("AI分析") ? text : `AI分析：\n${text}`;
    return finish(out);
  } catch {
    const fb = isBrief ? fallbackReasonHomeBrief(input) : fallbackReason(input);
    liaAiLog("fallback used", { feature: "sales_reason", reason: "api_error" });
    return finish(fb);
  }
}

/** 1顧客分の提案をまとめて生成（詳細な AI 分析文） */
export async function buildAiSalesProposal(
  ctx: SalesCustomerContext,
  today = new Date()
): Promise<AiSalesProposal> {
  const core = buildAiSalesProposalCore(ctx, today);
  const aiReason = await generateSalesSuggestionReason({
    ctx,
    score: core.score,
    priority: core.priority,
    purpose: core.purpose,
    tone: core.tone,
    ruleSignals: core.ruleSignals,
    at: today,
    format: "standard",
  });

  return { ...core, aiReason };
}
