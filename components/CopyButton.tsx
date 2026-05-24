"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CopyButton({
  text,
  messageId,
}: {
  text: string;
  messageId?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="lia-btn-primary px-4 py-2.5 text-xs sm:text-sm"
        onClick={async () => {
          setError(null);
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
            if (messageId) {
              try {
                await fetch(`/api/generated-messages/${messageId}/copied`, {
                  method: "PATCH",
                });
              } catch {
                // noop
              } finally {
                router.refresh();
              }
            }
          } catch {
            setError("コピーに失敗しました。");
          }
        }}
      >
        コピー
      </button>
      {copied ? (
        <span className="text-sm font-medium text-liaInk-muted">コピーしました</span>
      ) : null}
      {error ? <span className="text-sm font-medium text-red-600">{error}</span> : null}
    </div>
  );
}
