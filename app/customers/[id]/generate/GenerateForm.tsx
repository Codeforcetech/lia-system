"use client";

import { useActionState } from "react";
import {
  generateMessageForCustomer,
  type GenerateMessageState,
} from "@/app/actions/message";
import { CopyButton } from "@/components/CopyButton";
import { AdoptMessagePanel } from "@/components/AdoptMessagePanel";
import { MessagePurpose, MessageTone } from "@prisma/client";

const PURPOSES: Array<{ value: string; label: string }> = [
  { value: "THANK_YOU", label: "来店後のお礼" },
  { value: "LONG_TIME_NO_SEE", label: "久しぶり連絡" },
  { value: "BIRTHDAY", label: "誕生日" },
  { value: "EVENT_INVITE", label: "イベント案内" },
  { value: "VISIT_INVITE", label: "来店打診" },
  { value: "DATE_INVITE", label: "同伴打診" },
  { value: "CASUAL_CHAT", label: "自然な雑談" },
  { value: "OTHER", label: "その他" },
];

const TONES: Array<{ value: string; label: string }> = [
  { value: "NATURAL", label: "自然" },
  { value: "POLITE", label: "丁寧" },
  { value: "FRIENDLY", label: "フランク" },
  { value: "SWEET", label: "甘め" },
  { value: "SHORT", label: "短め" },
  { value: "LOW_EMOJI", label: "絵文字少なめ" },
  { value: "HIGH_EMOJI", label: "絵文字多め" },
];

function coercePurpose(raw?: string) {
  return (Object.values(MessagePurpose) as string[]).includes(raw ?? "")
    ? (raw as MessagePurpose)
    : undefined;
}

function coerceTone(raw?: string) {
  return (Object.values(MessageTone) as string[]).includes(raw ?? "")
    ? (raw as MessageTone)
    : undefined;
}

export function GenerateForm({
  customerId,
  initialPurpose,
  initialTone,
}: {
  customerId: string;
  initialPurpose?: string;
  initialTone?: string;
}) {
  const [state, formAction, pending] = useActionState<GenerateMessageState, FormData>(
    generateMessageForCustomer,
    {}
  );

  const defaultPurpose = coercePurpose(initialPurpose);
  const defaultTone = coerceTone(initialTone);

  const adoptPurpose = state.purpose ?? MessagePurpose.CASUAL_CHAT;
  const adoptTone = state.tone ?? MessageTone.NATURAL;

  return (
    <div className="space-y-6">
      {pending ? (
        <div
          className="flex items-center gap-3 rounded-2xl border border-lia-200 bg-lia-50 px-4 py-3.5 text-sm font-normal leading-relaxed text-liaInk"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-lia-600 border-t-transparent"
            aria-hidden
          />
          少し待ってね…文面を考えています
        </div>
      ) : null}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="customerId" value={customerId} />

        {state.error ? (
          <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-800">
            {state.error}
          </div>
        ) : null}

        <div className="grid gap-2.5">
          <label className="text-sm font-medium text-liaInk">送信の目的</label>
          <select
            name="purpose"
            className="lia-input disabled:cursor-not-allowed disabled:opacity-55"
            defaultValue={defaultPurpose}
            disabled={pending}
            aria-busy={pending}
          >
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2.5">
          <label className="text-sm font-medium text-liaInk">文体</label>
          <select
            name="tone"
            className="lia-input disabled:cursor-not-allowed disabled:opacity-55"
            defaultValue={defaultTone}
            disabled={pending}
            aria-busy={pending}
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2.5">
          <label className="text-sm font-medium text-liaInk">
            ひとことメモ（任意）
          </label>
          <textarea
            name="additionalInstruction"
            className="lia-input min-h-24 resize-y disabled:cursor-not-allowed disabled:opacity-55"
            placeholder="例）負担にならない感じで、など"
            disabled={pending}
            aria-busy={pending}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="lia-btn-accent w-full disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending ? "つくっているよ…" : "3案をつくる"}
        </button>
      </form>

      {state.variants?.length ? (
        <section className="space-y-4">
          <div className="lia-card px-5 py-6 sm:px-6">
            <div className="text-sm font-medium tracking-[0.04em] text-liaInk-heading">
              つくった文面
            </div>
            {(state.conversationPlan &&
              (state.conversationPlan.conversationThemes.length > 0 ||
                state.conversationPlan.summary ||
                state.conversationPlan.toneHint)) ||
            state.conversationReferences?.recommendations?.length ? (
              <div className="mt-4 rounded-2xl border border-lia-200 bg-lia-50/80 px-4 py-3">
                {state.conversationPlan &&
                (state.conversationPlan.conversationThemes.length > 0 ||
                  state.conversationPlan.summary ||
                  state.conversationPlan.toneHint) ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-liaInk-muted">
                      AIが会話テーマを整理しました
                    </p>
                    {state.conversationPlan.conversationThemes.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {state.conversationPlan.conversationThemes.map((t, i) => (
                          <li
                            key={`${i}-${t}`}
                            className="rounded-full border border-lia-200 bg-white px-2.5 py-1 text-xs text-liaInk"
                          >
                            {t}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {state.conversationPlan.summary ? (
                      <p className="mt-2 text-xs leading-relaxed text-liaInk-muted">
                        {state.conversationPlan.summary}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {state.conversationReferences?.recommendations?.length ? (
                  <div
                    className={
                      state.conversationPlan &&
                      (state.conversationPlan.conversationThemes.length > 0 ||
                        state.conversationPlan.summary ||
                        state.conversationPlan.toneHint)
                        ? "mt-3 border-t border-lia-200/80 pt-3"
                        : ""
                    }
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-liaInk-muted">
                      AIが話題候補を補完しました
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {state.conversationReferences.recommendations
                        .slice(0, 4)
                        .map((name, i) => (
                          <li
                            key={`${i}-${name}`}
                            className="text-[11px] leading-snug text-liaInk-muted"
                          >
                            <span aria-hidden>☕️</span> {name}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {state.isDummy ? (
              <div className="mt-2 text-xs font-normal leading-relaxed text-liaInk-muted">
                {state.dummyReason === "NO_API_KEY"
                  ? "OPENAI_API_KEY が空のためサンプル文です。.env を保存し、npm run dev を再起動してください。"
                  : state.dummyReason === "API_ERROR"
                    ? "APIに届きませんでした。キーや通信を確認してください。"
                    : "応答が空でした。しばらくしてからもう一度どうぞ。"}
              </div>
            ) : null}
            <div className="mt-5 space-y-4">
              {state.variants.map((v, i) => (
                <div
                  key={`${state.savedMessageId ?? "new"}-${i}`}
                  className="lia-card-inner rounded-2xl px-4 py-4"
                >
                  <div className="text-xs font-medium tracking-[0.12em] text-liaInk-muted">
                    案 {i + 1}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-[15px] font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
                    {v}
                  </div>
                  <AdoptMessagePanel
                    variantIndex={i}
                    aiOriginalText={v}
                    generatedMessageId={state.savedMessageId}
                    customerId={customerId}
                    purpose={adoptPurpose}
                    tone={adoptTone}
                  />
                </div>
              ))}
            </div>

            {state.combinedText ? (
              <div className="mt-6 rounded-2xl border border-lia-200 bg-lia-50 px-4 py-4">
                <div className="text-xs font-medium tracking-[0.12em] text-liaInk-muted">
                  まとめてコピー
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
                  {state.combinedText}
                </div>
                <div className="mt-3">
                  <CopyButton text={state.combinedText} messageId={state.savedMessageId} />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
