"use client";

import { useActionState, useEffect, useState } from "react";
import type { MessagePurpose, MessageTone } from "@prisma/client";
import {
  saveGeneratedMessageFeedback,
  type SaveFeedbackState,
} from "@/app/actions/message";
import { CopyButton } from "@/components/CopyButton";

type Props = {
  variantIndex: number;
  aiOriginalText: string;
  generatedMessageId?: string;
  customerId: string;
  purpose: MessagePurpose;
  tone: MessageTone;
};

export function AdoptMessagePanel({
  variantIndex,
  aiOriginalText,
  generatedMessageId,
  customerId,
  purpose,
  tone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<SaveFeedbackState, FormData>(
    saveGeneratedMessageFeedback,
    {}
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
    }
  }, [state.ok]);

  const canAdopt = Boolean(generatedMessageId);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <CopyButton text={aiOriginalText} messageId={generatedMessageId} />
        {canAdopt && !state.ok ? (
          <button
            type="button"
            className="lia-btn-secondary w-full px-4 py-2.5 text-xs sm:w-auto sm:text-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "閉じる" : "この文章を使う"}
          </button>
        ) : null}
      </div>

      {state.ok ? (
        <p className="text-xs font-medium tracking-wide text-lia-700" role="status">
          ✓ 学習しました
        </p>
      ) : null}

      {state.error ? (
        <p className="text-xs font-medium text-red-700">{state.error}</p>
      ) : null}

      {canAdopt && open && !state.ok ? (
        <form
          action={formAction}
          className="space-y-3 rounded-2xl border border-lia-200 bg-white px-3 py-3 sm:px-4"
        >
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="generatedMessageId" value={generatedMessageId ?? ""} />
          <input type="hidden" name="selectedIndex" value={String(variantIndex)} />
          <input type="hidden" name="purpose" value={purpose} />
          <input type="hidden" name="tone" value={tone} />
          <input type="hidden" name="aiOriginalText" value={aiOriginalText} />

          <div className="grid gap-1.5">
            <label
              htmlFor={`adopt-text-${generatedMessageId}-${variantIndex}`}
              className="text-xs font-medium text-liaInk-muted"
            >
              送る文面（そのまま編集できます）
            </label>
            <textarea
              id={`adopt-text-${generatedMessageId}-${variantIndex}`}
              name="finalAdoptedText"
              className="lia-input min-h-[7.5rem] resize-y text-[15px] leading-relaxed"
              defaultValue={aiOriginalText}
              required
              disabled={pending}
              aria-busy={pending}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="lia-btn-accent w-full px-4 py-2.5 text-xs sm:text-sm disabled:cursor-not-allowed disabled:opacity-55"
          >
            {pending ? "保存中…" : "採用する"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
