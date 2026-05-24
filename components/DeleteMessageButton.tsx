"use client";

import { useState, useTransition } from "react";
import { deleteGeneratedMessage } from "@/app/actions/message";

export function DeleteMessageButton({
  messageId,
  customerId,
}: {
  messageId: string;
  customerId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-2xl border border-lia-200 bg-white px-3 py-2 text-xs font-medium text-liaInk-muted transition hover:bg-lia-50 hover:text-liaInk disabled:opacity-60"
        onClick={() => {
          setError(null);
          const ok = window.confirm("この生成履歴を削除しますか？（元に戻せません）");
          if (!ok) return;
          startTransition(async () => {
            const res = await deleteGeneratedMessage(messageId, customerId);
            if (!res.ok) setError(res.error);
          });
        }}
      >
        {pending ? "削除中…" : "削除"}
      </button>
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </div>
  );
}
