"use client";

import { useActionState } from "react";
import { createCustomerNote, type NoteActionState } from "@/app/actions/note";

export function NoteForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState<NoteActionState, FormData>(
    createCustomerNote,
    {}
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />

      {state.error ? (
        <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-medium text-red-800">
          {state.error}
        </div>
      ) : null}
      {state.ok ? (
        <div className="rounded-2xl border border-lia-200 bg-lia-50 px-4 py-3.5 text-sm font-normal leading-relaxed text-liaInk">
          追加しました。
        </div>
      ) : null}

      <textarea
        name="content"
        className="lia-input min-h-28"
        placeholder="今日の会話や印象を、思い出した順で"
        required
      />

      <button
        type="submit"
        disabled={pending}
        className="lia-btn-primary w-full disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? "送っているよ…" : "メモを残す"}
      </button>
    </form>
  );
}
