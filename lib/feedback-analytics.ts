/**
 * Phase 2–6 Feedback Analytics（可視化のみ）
 *
 * 将来的には:
 * - Core Intelligence（全ユーザー横断の「強い営業構文」分析）
 * - Persona Intelligence（ユーザー別の文体・人格の学習）
 * に接続し、Adaptive Prompt Engine（Core + Persona 合成生成）の入力となる。
 *
 * 今回はルールベース集計のみ。AI判定・Embedding・クラスタリングは未実装。
 */

import type { MessagePurpose, MessageTone } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { countEmojiLike, countNewlines } from "@/lib/text-diff";

export const MESSAGE_PURPOSE_LABEL: Record<MessagePurpose, string> = {
  THANK_YOU: "来店後のお礼",
  LONG_TIME_NO_SEE: "久しぶり連絡",
  BIRTHDAY: "誕生日",
  EVENT_INVITE: "イベント案内",
  VISIT_INVITE: "来店打診",
  DATE_INVITE: "同伴打診",
  CASUAL_CHAT: "自然な雑談",
  OTHER: "その他",
};

export const MESSAGE_TONE_LABEL: Record<MessageTone, string> = {
  NATURAL: "自然",
  POLITE: "丁寧",
  FRIENDLY: "フランク",
  SWEET: "甘め",
  SHORT: "短め",
  LOW_EMOJI: "絵文字少なめ",
  HIGH_EMOJI: "絵文字多め",
};

export type RecentFeedbackRow = {
  id: string;
  aiOriginalText: string;
  finalAdoptedText: string;
  editDistance: number | null;
  wasEdited: boolean;
  purpose: MessagePurpose | null;
  tone: MessageTone | null;
  createdAt: Date;
};

export type FeedbackAnalytics = {
  totalAdopted: number;
  /** 0〜100（パーセント） */
  editedRate: number;
  averageEditDistance: number;
  /** 採用文（final）の平均文字数 */
  averageLength: number;
  /** 採用文の平均改行数 */
  averageLineBreaks: number;
  /** 採用文の平均絵文字数（簡易カウント） */
  averageEmojiCount: number;
  personaTraits: string[];
  recentFeedbacks: RecentFeedbackRow[];
  commonEditPatterns: string[];
};

const RECENT_LIMIT = 25;
const PATTERN_THRESHOLD = 0.35;

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * 採用文の統計から、簡易ペルソナ傾向ラベルを付与（ルールベース）
 */
function derivePersonaTraits(input: {
  total: number;
  avgLen: number;
  avgNl: number;
  avgEmoji: number;
  editedRate: number;
  dominantPurpose: MessagePurpose | null;
  avgLenDelta: number;
}): string[] {
  const { total, avgLen, avgNl, avgEmoji, editedRate, dominantPurpose, avgLenDelta } = input;
  if (total === 0) {
    return [
      "まだ採用データがありません。LINE生成画面で「この文章を使う」から蓄積が始まります。",
    ];
  }

  const traits: string[] = [];

  if (avgLen < 60) traits.push("短文寄り");
  else if (avgLen > 130) traits.push("文章やや長め");

  if (avgNl >= 3) traits.push("改行多め");
  else if (avgNl < 0.75) traits.push("改行少なめ・1ブロックで送る傾向");

  if (avgEmoji < 1) traits.push("絵文字控えめ");
  else if (avgEmoji >= 2.5) traits.push("絵文字で温度感を足す傾向");

  if (editedRate >= 45 && avgLenDelta < -8) traits.push("編集してトーンをかなり整えている");
  else if (editedRate < 25 && avgLen < 90) traits.push("AI案をほぼそのまま使うことが多い");

  if (dominantPurpose === "CASUAL_CHAT") traits.push("自然雑談型（雑談目的の採用が多い）");
  if (dominantPurpose === "THANK_YOU") traits.push("お礼・ケア系の採用が多い");

  if (editedRate >= 30 && avgLenDelta < -5) traits.push("営業感弱め（採用時に短く整える傾向）");

  if (traits.length === 0) traits.push("バランス型（データが増えると傾向がはっきりします）");

  return [...new Set(traits)];
}

/**
 * AI原文→採用文の差分から、よくある修正パターンをざっくり分類
 */
function deriveCommonEditPatterns(
  rows: Array<{ wasEdited: boolean; aiOriginalText: string; finalAdoptedText: string }>
): string[] {
  const edited = rows.filter((r) => r.wasEdited);
  if (edited.length === 0) {
    return ["編集付きの採用がまだ少ないです。修正して採用すると傾向が見えます。"];
  }

  let nlAdd = 0;
  let shorten = 0;
  let emojiAdd = 0;
  let lengthen = 0;

  for (const r of edited) {
    const ai = r.aiOriginalText;
    const fin = r.finalAdoptedText;
    if (countNewlines(fin) > countNewlines(ai)) nlAdd++;
    if (fin.length < ai.length - 3) shorten++;
    if (fin.length > ai.length + 5) lengthen++;
    if (countEmojiLike(fin) > countEmojiLike(ai)) emojiAdd++;
  }

  const n = edited.length;
  const patterns: string[] = [];
  if (nlAdd / n >= PATTERN_THRESHOLD) patterns.push("改行を足して読みやすくしていることが多い");
  if (shorten / n >= PATTERN_THRESHOLD) patterns.push("AI案より短く整えることが多い");
  if (emojiAdd / n >= PATTERN_THRESHOLD) patterns.push("絵文字を足して柔らかくすることが多い");
  if (lengthen / n >= PATTERN_THRESHOLD) patterns.push("言い足し・一言添えることがある");

  if (patterns.length === 0) {
    patterns.push("修正パターンはまだ分散しています（件数が増えると集まります）");
  }

  return patterns;
}

function dominantPurposeFrom(
  rows: Array<{ purpose: MessagePurpose | null }>
): MessagePurpose | null {
  const counts = new Map<MessagePurpose, number>();
  for (const r of rows) {
    if (!r.purpose) continue;
    counts.set(r.purpose, (counts.get(r.purpose) ?? 0) + 1);
  }
  let best: MessagePurpose | null = null;
  let max = 0;
  for (const [k, v] of counts) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

export async function getFeedbackAnalytics(): Promise<FeedbackAnalytics> {
  const user = await getDemoUser();

  const all = await prisma.generatedMessageFeedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      aiOriginalText: true,
      finalAdoptedText: true,
      editDistance: true,
      wasEdited: true,
      purpose: true,
      tone: true,
      createdAt: true,
    },
  });

  const totalAdopted = all.length;
  const editedCount = all.filter((r) => r.wasEdited).length;
  const editedRate = totalAdopted === 0 ? 0 : Math.round((editedCount / totalAdopted) * 1000) / 10;

  const lengths = all.map((r) => r.finalAdoptedText.length);
  const lineBreaks = all.map((r) => countNewlines(r.finalAdoptedText));
  const emojis = all.map((r) => countEmojiLike(r.finalAdoptedText));
  const distances = all
    .map((r) => r.editDistance)
    .filter((v): v is number => typeof v === "number");

  const deltas = all.map((r) => r.finalAdoptedText.length - r.aiOriginalText.length);

  const recentFeedbacks: RecentFeedbackRow[] = all.slice(0, RECENT_LIMIT).map((r) => ({
    id: r.id,
    aiOriginalText: r.aiOriginalText,
    finalAdoptedText: r.finalAdoptedText,
    editDistance: r.editDistance,
    wasEdited: r.wasEdited,
    purpose: r.purpose,
    tone: r.tone,
    createdAt: r.createdAt,
  }));

  const dominantPurpose = dominantPurposeFrom(all);

  const personaTraits = derivePersonaTraits({
    total: totalAdopted,
    avgLen: mean(lengths),
    avgNl: mean(lineBreaks),
    avgEmoji: mean(emojis),
    editedRate,
    dominantPurpose,
    avgLenDelta: mean(deltas),
  });

  const commonEditPatterns = deriveCommonEditPatterns(all);

  return {
    totalAdopted,
    editedRate,
    averageEditDistance: mean(distances),
    averageLength: mean(lengths),
    averageLineBreaks: mean(lineBreaks),
    averageEmojiCount: mean(emojis),
    personaTraits,
    recentFeedbacks,
    commonEditPatterns,
  };
}
