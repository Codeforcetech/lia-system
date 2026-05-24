/**
 * Phase 2–7 Persona Builder + Phase 2–8 Adaptive Prompt Engine
 *
 * Core Intelligence: 全ユーザー横断の「営業として強い構文」（別系統で将来集計）
 * Persona Intelligence: このユーザー固有の「そのキャストっぽさ」
 *
 * Phase 2–8: buildAdaptivePersonaForPrompt() で LINE 生成プロンプトへ反映（ルールベース）。
 */

import type { MessagePurpose, MessageTone } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { countEmojiLike, countNewlines } from "@/lib/text-diff";

export type PersonaCommunicationStyle = {
  averageLength: number;
  averageLineBreaks: number;
  emojiUsage: "low" | "medium" | "high";
  tone: "soft" | "balanced" | "direct";
};

export type PersonaProfile = {
  personaTags: string[];
  communicationStyle: PersonaCommunicationStyle;
  tendencies: string[];
  summary: string;
  /** プロフィール算出に使った採用フィードバック件数（0 のときは適応指示なし） */
  feedbackSampleSize: number;
};

/** LINE 生成 JSON に載せる Adaptive ペイロード */
export type AdaptivePersonaForPrompt = {
  feedbackSampleSize: number;
  personaTags: string[];
  communicationStyle: PersonaCommunicationStyle;
  directives: string[];
};

/**
 * 採用データから、生成モデル向けの適応ルール（短文・改行・絵文字・押しの弱さ等）
 */
export function buildAdaptivePromptDirectives(profile: PersonaProfile): string[] {
  if (profile.feedbackSampleSize < 1) return [];

  const tags = new Set(profile.personaTags);
  const s = profile.communicationStyle;
  const dirs: string[] = [];

  const shortLike = tags.has("短文型") || s.averageLength < 62;
  const lineBreakLike = tags.has("改行型") || s.averageLineBreaks > 2.2;
  const emojiLow =
    tags.has("絵文字控えめ") || s.emojiUsage === "low";
  const emojiHigh = tags.has("絵文字型") || s.emojiUsage === "high";
  const weakSales = tags.has("営業感弱め");
  const casualFirst = tags.has("自然雑談型");

  if (shortLike) {
    dirs.push(
      "各案は全体で短めに。長い前置き・説明・言い換えの重ねは避け、テンポよく送れる長さにする。"
    );
  }

  if (lineBreakLike) {
    dirs.push(
      "読みやすいように改行を積極的に使う（1案あたり改行は2回程度まで。不自然な1文字改行は避ける）。"
    );
  }

  if (emojiLow) {
    dirs.push("絵文字は使わないか、3案あわせて多くても1個まで。");
  } else if (emojiHigh) {
    dirs.push("絵文字で親しみを出してよいが、やりすぎ・連打は避ける。");
  }

  if (weakSales) {
    dirs.push(
      "押し・来店打診・セールストーク感を弱め、軽い雑談やケアの一言に寄せる。"
    );
  }

  if (casualFirst) {
    dirs.push(
      "入りは自然な雑談・近況から入りやすくする。いきなり営業口調や案内調に切り替えない。"
    );
  }

  if (s.tone === "soft") {
    dirs.push("言い回しは柔らかく、角の立たない語尾を優先する。");
  } else if (s.tone === "direct") {
    dirs.push("回りくどさを避け、ストレートで短い言い切りを優先する。");
  }

  if (dirs.length === 0) {
    dirs.push("これまでの採用文の雰囲気に合わせ、無理のない自然なキャスト口調にそろえる。");
  }

  const seen = new Set<string>();
  return dirs.filter((d) => (seen.has(d) ? false : (seen.add(d), true)));
}

/** フィードバックが1件以上あるときだけ LINE 生成へ渡すペイロード */
export function buildAdaptivePersonaForPrompt(
  profile: PersonaProfile
): AdaptivePersonaForPrompt | null {
  if (profile.feedbackSampleSize < 1) return null;
  return {
    feedbackSampleSize: profile.feedbackSampleSize,
    personaTags: profile.personaTags,
    communicationStyle: profile.communicationStyle,
    directives: buildAdaptivePromptDirectives(profile),
  };
}

type FeedbackRow = {
  aiOriginalText: string;
  finalAdoptedText: string;
  wasEdited: boolean;
  purpose: MessagePurpose | null;
  tone: MessageTone | null;
};

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function dominantPurpose(rows: FeedbackRow[]): MessagePurpose | null {
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

function dominantTone(rows: FeedbackRow[]): MessageTone | null {
  const counts = new Map<MessageTone, number>();
  for (const r of rows) {
    if (!r.tone) continue;
    counts.set(r.tone, (counts.get(r.tone) ?? 0) + 1);
  }
  let best: MessageTone | null = null;
  let max = 0;
  for (const [k, v] of counts) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function shortenRatioAmongEdited(rows: FeedbackRow[]): number {
  const edited = rows.filter((r) => r.wasEdited);
  if (edited.length === 0) return 0;
  let n = 0;
  for (const r of edited) {
    if (r.finalAdoptedText.length < r.aiOriginalText.length - 3) n++;
  }
  return n / edited.length;
}

function deriveEmojiUsage(avgEmoji: number): PersonaCommunicationStyle["emojiUsage"] {
  if (avgEmoji < 0.75) return "low";
  if (avgEmoji > 2) return "high";
  return "medium";
}

function deriveCommsTone(input: {
  avgLen: number;
  avgEmoji: number;
  dominantTone: MessageTone | null;
  shortenRatio: number;
  editedRate: number;
}): PersonaCommunicationStyle["tone"] {
  const { avgLen, avgEmoji, dominantTone: domT, shortenRatio, editedRate } = input;

  const softHint =
    domT === "SWEET" ||
    domT === "POLITE" ||
    avgEmoji >= 1.4 ||
    (domT === "HIGH_EMOJI" && avgEmoji >= 0.8);

  const directHint =
    avgLen < 62 &&
    avgEmoji < 0.85 &&
    (shortenRatio >= 0.35 || (editedRate >= 25 && avgLen < 55)) &&
    domT !== "SWEET" &&
    domT !== "HIGH_EMOJI";

  if (softHint && !directHint) return "soft";
  if (directHint && !softHint) return "direct";
  if (softHint && directHint) return "balanced";
  return "balanced";
}

function derivePersonaTags(input: {
  total: number;
  avgLen: number;
  avgNl: number;
  avgEmoji: number;
  editedRate: number;
  avgLenDelta: number;
  shortenRatio: number;
  domPurpose: MessagePurpose | null;
  domTone: MessageTone | null;
}): string[] {
  const {
    total,
    avgLen,
    avgNl,
    avgEmoji,
    editedRate,
    avgLenDelta,
    shortenRatio,
    domPurpose,
    domTone,
  } = input;

  if (total === 0) return [];

  const tags: string[] = [];

  if (avgLen < 60) tags.push("短文型");
  if (avgNl > 3) tags.push("改行型");
  if (avgNl >= 1 && avgNl <= 3 && avgLen < 85) tags.push("テンポ重視");

  if (avgEmoji > 2) tags.push("絵文字型");
  else if (avgEmoji < 0.55) tags.push("絵文字控えめ");

  if (
    (editedRate >= 28 && shortenRatio >= 0.32) ||
    avgLenDelta < -6
  ) {
    tags.push("営業感弱め");
  }

  if (domPurpose === "CASUAL_CHAT") tags.push("自然雑談型");
  if (domPurpose === "LONG_TIME_NO_SEE") tags.push("相談型");

  if (avgEmoji >= 1.1 || domTone === "SWEET") tags.push("感情型");

  if (avgLen < 78 && avgEmoji < 1 && avgNl < 1.8 && domTone !== "SWEET") {
    tags.push("サバサバ型");
  }

  if (domTone === "SWEET" || domTone === "HIGH_EMOJI") tags.push("甘え型");
  if (domTone === "POLITE") tags.push("丁寧型");
  if (domTone === "FRIENDLY") tags.push("フランク型");

  if (avgEmoji >= 1.2 || domTone === "SWEET" || domTone === "HIGH_EMOJI") {
    tags.push("距離感近め");
  }

  if (domTone === "SWEET" || avgEmoji >= 1 || domPurpose === "CASUAL_CHAT") {
    tags.push("柔らかめ");
  }

  return [...new Set(tags)].slice(0, 12);
}

function deriveTendencies(input: {
  total: number;
  avgLen: number;
  avgNl: number;
  avgEmoji: number;
  editedRate: number;
  shortenRatio: number;
  domPurpose: MessagePurpose | null;
  commsTone: PersonaCommunicationStyle["tone"];
}): string[] {
  const { total, avgLen, avgNl, avgEmoji, editedRate, shortenRatio, domPurpose, commsTone } =
    input;

  if (total === 0) {
    return [
      "採用データがまだ少ないので、輪郭はこれからくっきりしていきます。",
    ];
  }

  const out: string[] = [];

  if (avgLen < 68) {
    out.push("一文を短く切って、返しやすいリズムを作りやすいタイプです。");
  } else if (avgLen > 120) {
    out.push("状況を少し丁寧に伝えたくなる長さの文章も選びやすいです。");
  }

  if (avgNl >= 2.5) {
    out.push("改行で「呼吸」を作って、読みやすさを優先しがちです。");
  }

  if (avgEmoji >= 1.3) {
    out.push("絵文字で温度感を足して、距離を縮めやすい送り方です。");
  } else if (avgEmoji < 0.6) {
    out.push("装飾は控えめで、さりげない一文に寄せやすいです。");
  }

  if (editedRate >= 30 && shortenRatio >= 0.3) {
    out.push("採用のとき、AI案より圧や言い回しを弱める編集が目立ちます。");
  } else if (editedRate < 22) {
    out.push("AIの下書きをそのまま活かすことも多く、迷いが少なめです。");
  }

  if (domPurpose === "CASUAL_CHAT") {
    out.push("雑談の入口を大事にして、会話が続きやすい角度を選びがちです。");
  }

  if (commsTone === "soft") {
    out.push("全体的に、角を取った柔らかいトーンが似合いそうです。");
  } else if (commsTone === "direct") {
    out.push("くどさを避けて、ストレートに伝える方向がしっくりきそうです。");
  }

  if (out.length === 0) {
    out.push("バランス型で、状況に応じて文体を変えやすい土台があります。");
  }

  return out.slice(0, 5);
}

function buildPersonaSummary(input: {
  personaTags: string[];
  domPurpose: MessagePurpose | null;
  editedRate: number;
  shortenRatio: number;
  avgLen: number;
  avgNl: number;
  avgEmoji: number;
  commsTone: PersonaCommunicationStyle["tone"];
  total: number;
}): string {
  const {
    personaTags,
    domPurpose,
    editedRate,
    shortenRatio,
    avgLen,
    avgNl,
    avgEmoji,
    commsTone,
    total,
  } = input;

  if (total === 0) {
    return [
      "まだデータが少ないので、プロフィールはこれから育ちます。",
      "",
      "「この文章を使う」から採用を重ねると、あなたらしい営業スタイルがはっきり見えてきますよ。",
    ].join("\n");
  }

  const paras: string[] = [];

  if (domPurpose === "CASUAL_CHAT") {
    paras.push("自然な雑談を軸にしながら、会話のきっかけを作りやすいタイプに見えます。");
  } else if (domPurpose === "THANK_YOU") {
    paras.push("お礼やケアの一言を丁寧に整えやすいタイプに見えます。");
  } else {
    paras.push("目的に合わせて文面を選び、相手との距離を意識しそうです。");
  }

  if (editedRate >= 32 && shortenRatio >= 0.3) {
    paras.push("採用のとき、営業感をかなり弱める編集が目立ちます。押しより「軽さ」を優先しがちです。");
  } else if (editedRate < 24) {
    paras.push("AIの下書きを活かしつつ、微調整で仕上げることが多そうです。");
  } else {
    paras.push("送る直前に、言い回しを自分の温度に寄せることがあります。");
  }

  const tempo: string[] = [];
  if (avgLen < 65) tempo.push("短文");
  if (avgNl >= 2) tempo.push("改行");
  if (avgEmoji >= 1.2) tempo.push("絵文字");
  const tempoStr =
    tempo.length > 0 ? `${tempo.join("と")}を使い` : "文体のバランスを見ながら";

  if (commsTone === "soft") {
    paras.push(`${tempoStr}、柔らかい距離感でやり取りするタイプです。`);
  } else if (commsTone === "direct") {
    paras.push(`${tempoStr}、ストレートでサッと伝えるタイプです。`);
  } else {
    paras.push(`${tempoStr}、場面に合わせてトーンを調整するタイプです。`);
  }

  if (personaTags.includes("自然雑談型") && paras.length < 4) {
    paras.push("雑談から入って、無理のない会話の流れを作りやすそうです。");
  }

  return paras.slice(0, 4).join("\n\n");
}

export async function buildPersonaProfile(): Promise<PersonaProfile> {
  const user = await getDemoUser();

  const rows = await prisma.generatedMessageFeedback.findMany({
    where: { userId: user.id },
    select: {
      aiOriginalText: true,
      finalAdoptedText: true,
      wasEdited: true,
      purpose: true,
      tone: true,
    },
  });

  const total = rows.length;
  const lengths = rows.map((r) => r.finalAdoptedText.length);
  const lineBreaks = rows.map((r) => countNewlines(r.finalAdoptedText));
  const emojis = rows.map((r) => countEmojiLike(r.finalAdoptedText));
  const deltas = rows.map((r) => r.finalAdoptedText.length - r.aiOriginalText.length);

  const avgLen = mean(lengths);
  const avgNl = mean(lineBreaks);
  const avgEmoji = mean(emojis);
  const avgLenDelta = mean(deltas);
  const editedCount = rows.filter((r) => r.wasEdited).length;
  const editedRate = total === 0 ? 0 : (editedCount / total) * 100;
  const shortenRatio = shortenRatioAmongEdited(rows);

  const domPurpose = dominantPurpose(rows);
  const domTone = dominantTone(rows);

  const emojiUsage = deriveEmojiUsage(avgEmoji);
  const commsTone = deriveCommsTone({
    avgLen,
    avgEmoji,
    dominantTone: domTone,
    shortenRatio,
    editedRate,
  });

  const personaTags = derivePersonaTags({
    total,
    avgLen,
    avgNl,
    avgEmoji,
    editedRate,
    avgLenDelta,
    shortenRatio,
    domPurpose,
    domTone,
  });

  const tendencies = deriveTendencies({
    total,
    avgLen,
    avgNl,
    avgEmoji,
    editedRate,
    shortenRatio,
    domPurpose,
    commsTone,
  });

  const summary = buildPersonaSummary({
    personaTags,
    domPurpose,
    editedRate,
    shortenRatio,
    avgLen,
    avgNl,
    avgEmoji,
    commsTone,
    total,
  });

  return {
    personaTags,
    communicationStyle: {
      averageLength: Math.round(avgLen * 10) / 10,
      averageLineBreaks: Math.round(avgNl * 10) / 10,
      emojiUsage,
      tone: commsTone,
    },
    tendencies,
    summary,
    feedbackSampleSize: total,
  };
}
