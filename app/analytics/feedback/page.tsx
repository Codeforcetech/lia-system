import type { Metadata } from "next";
import { FeedbackAnalyticsDashboard } from "@/components/analytics/FeedbackAnalyticsDashboard";
import { getFeedbackAnalytics } from "@/lib/feedback-analytics";
import { buildPersonaProfile } from "@/lib/persona-builder";
import { getPersonaEffectAnalytics } from "@/lib/persona-effect-analytics";

/**
 * Phase 2–6〜2–9: Feedback / Persona Builder / Persona Effect（効果測定）
 *
 * 将来: directive 単位の効果、顧客タイプ別最適化、Persona 重みの自動調整。
 */

export const metadata: Metadata = {
  title: "学習の見える化 | Lia",
  description: "採用されたLINEと修正傾向を可視化します。",
};

export const dynamic = "force-dynamic";

export default async function FeedbackAnalyticsPage() {
  const [data, persona, personaEffect] = await Promise.all([
    getFeedbackAnalytics(),
    buildPersonaProfile(),
    getPersonaEffectAnalytics(),
  ]);
  return (
    <FeedbackAnalyticsDashboard
      data={data}
      persona={persona}
      personaEffect={personaEffect}
    />
  );
}
