/** サーバー用。console.error は乱発しない */
export function liaAiLog(
  event:
    | "cache hit"
    | "cache miss"
    | "OpenAI start"
    | "OpenAI success"
    | "fallback used"
    | "post-process",
  meta?: Record<string, string | number | boolean | undefined>
): void {
  const parts = meta
    ? Object.entries(meta)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  console.log(`[Lia AI] ${event}${parts ? ` ${parts}` : ""}`);
}
