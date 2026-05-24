import type { FeedbackAnalytics } from "@/lib/feedback-analytics";
import {
  MESSAGE_PURPOSE_LABEL,
  MESSAGE_TONE_LABEL,
} from "@/lib/feedback-analytics";
import type { PersonaProfile } from "@/lib/persona-builder";
import type { PersonaEffectAnalytics } from "@/lib/persona-effect-analytics";
import Link from "next/link";

function fmt1(n: number) {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

function formatWhen(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const EMOJI_USAGE_JA = { low: "控えめ", medium: "ちょうど良い", high: "多め" } as const;
const COMMS_TONE_JA = {
  soft: "柔らかめ",
  balanced: "バランス",
  direct: "ストレート",
} as const;

export function FeedbackAnalyticsDashboard({
  data,
  persona,
  personaEffect,
}: {
  data: FeedbackAnalytics;
  persona: PersonaProfile;
  personaEffect: PersonaEffectAnalytics;
}) {
  const {
    totalAdopted,
    editedRate,
    averageEditDistance,
    averageLength,
    averageLineBreaks,
    averageEmojiCount,
    personaTraits,
    recentFeedbacks,
    commonEditPatterns,
  } = data;

  const statCards = [
    { label: "採用されたLINE", value: String(totalAdopted), unit: "件" },
    { label: "編集された割合", value: fmt1(editedRate), unit: "%" },
    { label: "平均・編集距離", value: fmt1(averageEditDistance), unit: "pt" },
    { label: "平均・文字数", value: fmt1(averageLength), unit: "文字" },
    { label: "平均・改行数", value: fmt1(averageLineBreaks), unit: "回" },
    { label: "平均・絵文字", value: fmt1(averageEmojiCount), unit: "個" },
  ];

  return (
    <div className="space-y-10 pb-6">
      <div className="lia-surface-manager">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lia-800/90">
          Feedback Analytics
        </p>
        <h1 className="mt-2 text-lg font-medium tracking-[0.02em] text-liaInk-heading">
          どんな営業LINEが好まれているか
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-liaInk-muted">
          採用と修正のデータが、少しずつ Lia の「営業感覚」を形にしていきます。
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-lia-700/85">
            Persona Builder
          </p>
          <h2 className="lia-heading text-base">あなたの営業スタイル</h2>
          <p className="text-xs leading-relaxed text-liaInk-muted">
            採用した文から推う、あなたらしい営業人格のプロフィールです。
          </p>
        </div>
        <div className="lia-card rounded-3xl border-lia-200 bg-gradient-to-br from-white via-white to-lia-50 px-4 py-5 sm:px-6 sm:py-6">
          {persona.personaTags.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {persona.personaTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-lia-200 bg-lia-50/90 px-3 py-1.5 text-xs font-medium text-liaInk-heading"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-liaInk-muted">
              タグは、採用データが増えると自然と付いてきます。
            </p>
          )}

          <p className="mt-5 whitespace-pre-line text-sm leading-[1.85] tracking-[0.02em] text-liaInk">
            {persona.summary}
          </p>

          <div className="mt-6 rounded-2xl border border-lia-100 bg-lia-50/60 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-liaInk-muted">
              コミュニケーションの傾向
            </p>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-liaInk-muted">平均文字数</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-liaInk-heading">
                  {fmt1(persona.communicationStyle.averageLength)} 文字
                </dd>
              </div>
              <div>
                <dt className="text-xs text-liaInk-muted">平均改行</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-liaInk-heading">
                  {fmt1(persona.communicationStyle.averageLineBreaks)} 回
                </dd>
              </div>
              <div>
                <dt className="text-xs text-liaInk-muted">絵文字</dt>
                <dd className="mt-0.5 font-medium text-liaInk-heading">
                  {EMOJI_USAGE_JA[persona.communicationStyle.emojiUsage]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-liaInk-muted">トーン</dt>
                <dd className="mt-0.5 font-medium text-liaInk-heading">
                  {COMMS_TONE_JA[persona.communicationStyle.tone]}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-liaInk-muted">
              もう少し踏み込んだ傾向
            </p>
            <ul className="mt-2 space-y-2.5 text-sm leading-relaxed text-liaInk-muted">
              {persona.tendencies.map((t) => (
                <li key={t} className="border-l-2 border-lia-100 pl-3">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-lia-700/85">
            Persona Effect
          </p>
          <h2 className="lia-heading text-base">AIはどれだけ近づいてきた？</h2>
          <p className="text-xs leading-relaxed text-liaInk-muted">
            Persona を載せた生成のあと、採用時の修正が減っているかを見ます。
          </p>
        </div>
        <div className="lia-card rounded-3xl border-lia-200 bg-gradient-to-b from-lia-50/40 to-white px-4 py-5 sm:px-6 sm:py-6">
          <p className="text-[11px] text-liaInk-muted">
            比較対象：採用保存{" "}
            <span className="font-medium tabular-nums text-liaInk-heading">
              Persona適用 {personaEffect.sampleWithPersona} 件
            </span>
            {" / "}
            <span className="font-medium tabular-nums text-liaInk-heading">
              未適用 {personaEffect.sampleWithoutPersona} 件
            </span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-lia-100 bg-white/90 px-3 py-3">
              <div className="text-[10px] font-medium text-liaInk-muted">Persona 適用率</div>
              <div className="mt-1 text-xl font-medium tabular-nums text-liaInk-heading">
                {fmt1(personaEffect.adaptiveUsageRate)}%
              </div>
            </div>
            <div className="rounded-2xl border border-lia-100 bg-white/90 px-3 py-3">
              <div className="text-[10px] font-medium text-liaInk-muted">適用時・編集率</div>
              <div className="mt-1 text-xl font-medium tabular-nums text-liaInk-heading">
                {fmt1(personaEffect.editedRateWithPersona)}%
              </div>
            </div>
            <div className="rounded-2xl border border-lia-100 bg-white/90 px-3 py-3 sm:col-span-1">
              <div className="text-[10px] font-medium text-liaInk-muted">未適用・編集率</div>
              <div className="mt-1 text-xl font-medium tabular-nums text-liaInk-heading">
                {fmt1(personaEffect.editedRateWithoutPersona)}%
              </div>
            </div>
            <div className="rounded-2xl border border-lia-100 bg-white/90 px-3 py-3">
              <div className="text-[10px] font-medium text-liaInk-muted">適用時・平均距離</div>
              <div className="mt-1 text-xl font-medium tabular-nums text-liaInk-heading">
                {fmt1(personaEffect.averageEditDistanceWithPersona)} pt
              </div>
            </div>
            <div className="rounded-2xl border border-lia-100 bg-white/90 px-3 py-3">
              <div className="text-[10px] font-medium text-liaInk-muted">未適用・平均距離</div>
              <div className="mt-1 text-xl font-medium tabular-nums text-liaInk-heading">
                {fmt1(personaEffect.averageEditDistanceWithoutPersona)} pt
              </div>
            </div>
          </div>

          {personaEffect.topEffectiveTags.length > 0 ? (
            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-liaInk-muted">
                効きやすいタグ（参考）
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {personaEffect.topEffectiveTags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-lia-200 bg-white px-3 py-1 text-xs font-medium text-lia-800"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-lia-100 bg-white/80 px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-liaInk-muted">
              効果サマリー
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-[1.85] text-liaInk">
              {personaEffect.summary}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="lia-heading text-base">サマリー</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="lia-card rounded-3xl px-4 py-4 sm:px-5 sm:py-5"
            >
              <div className="text-[11px] font-medium leading-snug text-liaInk-muted">
                {s.label}
              </div>
              <div className="mt-2 flex items-baseline gap-0.5">
                <span className="text-2xl font-medium tabular-nums tracking-tight text-liaInk-heading">
                  {s.value}
                </span>
                <span className="text-xs text-liaInk-muted">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="lia-heading text-base">このユーザーの営業傾向</h2>
        <div className="lia-card rounded-3xl border-lia-200 bg-gradient-to-b from-white to-lia-50/80 px-4 py-5 sm:px-6">
          <ul className="flex flex-col gap-2.5">
            {personaTraits.map((t) => (
              <li
                key={t}
                className="flex gap-2 text-sm leading-relaxed text-liaInk before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-lia-500 before:content-['']"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="lia-heading text-base">よくある修正の傾向</h2>
        <div className="lia-card rounded-3xl px-4 py-5 sm:px-6">
          <ul className="space-y-2 text-sm leading-relaxed text-liaInk-muted">
            {commonEditPatterns.map((p) => (
              <li key={p} className="border-l-2 border-lia-200 pl-3">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="lia-heading text-base">最近学習した文章</h2>
        {recentFeedbacks.length === 0 ? (
          <p className="lia-prose-soft px-1 text-sm">
            まだありません。生成画面で「採用する」とここに並びます。
          </p>
        ) : (
          <ul className="space-y-4">
            {recentFeedbacks.map((r) => (
              <li
                key={r.id}
                className="lia-card-inner rounded-3xl px-4 py-4 sm:px-5 sm:py-5"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-liaInk-muted">
                  <time dateTime={r.createdAt.toISOString()}>{formatWhen(r.createdAt)}</time>
                  {r.purpose ? (
                    <span className="lia-pill bg-white">
                      {MESSAGE_PURPOSE_LABEL[r.purpose]}
                    </span>
                  ) : null}
                  {r.tone ? (
                    <span className="lia-pill bg-white">{MESSAGE_TONE_LABEL[r.tone]}</span>
                  ) : null}
                  <span
                    className={
                      r.wasEdited
                        ? "rounded-full bg-amber-50 px-2 py-0.5 text-amber-900"
                        : "rounded-full bg-lia-50 px-2 py-0.5 text-lia-900"
                    }
                  >
                    {r.wasEdited ? "編集あり" : "そのまま採用"}
                  </span>
                  <span className="tabular-nums">
                    距離 {r.editDistance ?? "—"}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-liaInk-muted">
                      AI原文
                    </div>
                    <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-lia-100 bg-lia-50/50 px-3 py-2 text-xs leading-relaxed text-liaInk">
                      {r.aiOriginalText}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-liaInk-muted">
                      採用文
                    </div>
                    <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-lia-200 bg-white px-3 py-2 text-xs leading-relaxed text-liaInk">
                      {r.finalAdoptedText}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-center pt-2">
        <Link href="/customers" className="lia-btn-secondary text-sm">
          顧客一覧へ
        </Link>
      </div>
    </div>
  );
}
