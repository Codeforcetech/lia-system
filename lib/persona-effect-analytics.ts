/**
 * Phase 2-9 Persona Effect Analytics
 *
 * Adaptive Persona が「修正量・編集率」に与えた影響をざっくり可視化する。
 *
 * 将来:
 * - directive 単位・顧客セグメント別の効果
 * - 自動 Persona 重み調整・A/B
 * - Core vs Persona の寄与分解
 */

import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

/** inputContext JSON から生成時の adaptivePersona を復元（採用保存時にスナップショット用） */
export function extractAdaptiveSnapshotFromInputContext(inputContext: string | null): {
  applied: boolean;
  tags: string[];
  tone: string | null;
  directiveCount: number | null;
} {
  if (!inputContext?.trim()) {
    return { applied: false, tags: [], tone: null, directiveCount: null };
  }
  try {
    const o = JSON.parse(inputContext) as {
      adaptivePersona?: {
        personaTags?: unknown;
        communicationStyle?: { tone?: unknown };
        directives?: unknown;
      } | null;
    };
    const ap = o.adaptivePersona;
    if (!ap || typeof ap !== "object") {
      return { applied: false, tags: [], tone: null, directiveCount: null };
    }
    const rawTags = ap.personaTags;
    const tags = Array.isArray(rawTags)
      ? rawTags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];
    const t = ap.communicationStyle?.tone;
    const tone =
      t === "soft" || t === "balanced" || t === "direct" ? t : null;
    const dirs = ap.directives;
    const directiveCount = Array.isArray(dirs) ? dirs.length : null;
    return { applied: true, tags, tone, directiveCount };
  } catch {
    return { applied: false, tags: [], tone: null, directiveCount: null };
  }
}

export type PersonaEffectAnalytics = {
  /** 全採用のうち Persona 適用生成だった割合 0〜100 */
  adaptiveUsageRate: number;
  /** Persona 適用採用の編集率 0〜100 */
  editedRateWithPersona: number;
  /** 非適用採用の編集率 0〜100 */
  editedRateWithoutPersona: number;
  averageEditDistanceWithPersona: number;
  averageEditDistanceWithoutPersona: number;
  /** 効きやすいと推定される personaTags（ルールベース） */
  topEffectiveTags: string[];
  summary: string;
  sampleWithPersona: number;
  sampleWithoutPersona: number;
};

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function buildEffectSummary(input: {
  total: number;
  withN: number;
  withoutN: number;
  editedRateWith: number;
  editedRateWithout: number;
  avgDistWith: number;
  avgDistWithout: number;
  topTags: string[];
}): string {
  const {
    total,
    withN,
    withoutN,
    editedRateWith,
    editedRateWithout,
    avgDistWith,
    avgDistWithout,
    topTags,
  } = input;

  if (total === 0) {
    return [
      "まだ採用データがありません。",
      "生成→採用が増えると、Persona が効いているかが見えてきます。",
    ].join("\n");
  }

  if (withN < 2 || withoutN < 2) {
    return [
      "Persona 適用あり／なし、それぞれの件数がまだ少なめです。",
      "あと数件たまると、編集率や修正量の差が読みやすくなります。",
    ].join("\n");
  }

  const paras: string[] = [];

  if (editedRateWith < editedRateWithout - 5) {
    paras.push(
      "Persona を載せた生成のほうが、採用時の編集が少なめの傾向があります。「その人らしさ」が文章に近づき始めているサインかもしれません。"
    );
  } else if (editedRateWith > editedRateWithout + 5) {
    paras.push(
      "いまのデータでは、Persona 適用時のほうが編集が多めに見えます。プロフィールや directive の見直しのヒントになります。"
    );
  } else {
    paras.push(
      "編集率は Persona 適用の有無で大きくは開いていません。データが増えると差がはっきりする可能性があります。"
    );
  }

  if (avgDistWithout - avgDistWith > 6) {
    paras.push("修正の「距離スコア」は、Persona ありのほうが小さめです。AI の出力があなたの癖に近づいているかもしれません。");
  } else if (avgDistWith - avgDistWithout > 6) {
    paras.push("修正の距離スコアは、Persona なしのほうが小さめに見えます。引き続き観察するとよさそうです。");
  }

  if (topTags.length > 0) {
    paras.push(
      `特に「${topTags.join("」「")}」が付いていた生成では、そのまま採用されやすい傾向がうかがえます。`
    );
  }

  paras.push("Lia はここから先も、あなたの営業スタイルに少しずつ寄り添っていきます。");

  return paras.join("\n\n");
}

export async function getPersonaEffectAnalytics(): Promise<PersonaEffectAnalytics> {
  const user = await getDemoUser();

  const rows = await prisma.generatedMessageFeedback.findMany({
    where: { userId: user.id },
    select: {
      wasEdited: true,
      editDistance: true,
      adaptivePersonaApplied: true,
      adaptivePersonaTags: true,
    },
  });

  const total = rows.length;
  const withP = rows.filter((r) => r.adaptivePersonaApplied);
  const withoutP = rows.filter((r) => !r.adaptivePersonaApplied);

  const adaptiveUsageRate = pct(withP.length, total);

  const editedWith = withP.filter((r) => r.wasEdited).length;
  const editedWithout = withoutP.filter((r) => r.wasEdited).length;
  const editedRateWithPersona = pct(editedWith, withP.length);
  const editedRateWithoutPersona = pct(editedWithout, withoutP.length);

  const distWith = withP
    .map((r) => r.editDistance)
    .filter((v): v is number => typeof v === "number");
  const distWithout = withoutP
    .map((r) => r.editDistance)
    .filter((v): v is number => typeof v === "number");

  const averageEditDistanceWithPersona = Math.round(mean(distWith) * 10) / 10;
  const averageEditDistanceWithoutPersona = Math.round(mean(distWithout) * 10) / 10;

  const tagScores = new Map<string, number>();
  for (const r of withP) {
    const ed = r.editDistance ?? 999;
    for (const tag of r.adaptivePersonaTags) {
      const t = tag.trim();
      if (!t) continue;
      let add = 0;
      if (!r.wasEdited) add += 2;
      else if (ed < 20) add += 1;
      tagScores.set(t, (tagScores.get(t) ?? 0) + add);
    }
  }

  const topEffectiveTags = Array.from(tagScores.entries())
    .filter(([, s]) => s >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  const summary = buildEffectSummary({
    total,
    withN: withP.length,
    withoutN: withoutP.length,
    editedRateWith: editedRateWithPersona,
    editedRateWithout: editedRateWithoutPersona,
    avgDistWith: averageEditDistanceWithPersona,
    avgDistWithout: averageEditDistanceWithoutPersona,
    topTags: topEffectiveTags.slice(0, 3),
  });

  return {
    adaptiveUsageRate,
    editedRateWithPersona,
    editedRateWithoutPersona,
    averageEditDistanceWithPersona,
    averageEditDistanceWithoutPersona,
    topEffectiveTags: topEffectiveTags.slice(0, 3),
    summary,
    sampleWithPersona: withP.length,
    sampleWithoutPersona: withoutP.length,
  };
}
