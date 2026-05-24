"use client";

import { useActionState } from "react";
import { createVisit, type VisitActionState } from "@/app/actions/visit";

export function VisitForm({ customerId }: { customerId: string }) {
  const [state, formAction, pending] = useActionState<VisitActionState, FormData>(
    createVisit,
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

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">来店日（必須）</label>
        <input name="visitedAt" type="date" className="lia-input" required />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">金額</label>
        <input
          name="amount"
          inputMode="numeric"
          className="lia-input"
          placeholder="例）30000"
        />
      </div>

      <div className="grid gap-2.5">
        <label className="text-sm font-medium text-liaInk">メモ</label>
        <textarea
          name="memo"
          className="lia-input min-h-24"
          placeholder="例）同伴、シャンパン1本"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="lia-btn-primary w-full disabled:translate-y-0 disabled:opacity-60"
      >
        {pending ? "記録中…" : "来店を記録する"}
      </button>
    </form>
  );
}
