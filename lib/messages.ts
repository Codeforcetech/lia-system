export type ParsedGeneratedText = {
  variants: [string, string, string];
  combinedText: string; // 保存形式に正規化した全文（案1〜3）
};

const DEFAULT_DUMMY: ParsedGeneratedText = {
  variants: [
    "この前はありがとう！またゆっくり話せたらうれしいです。",
    "最近忙しそうだけど、体調大丈夫？落ち着いたらまた話そ。",
    "この前の話の続き、また聞かせて。無理ないタイミングで！",
  ],
  combinedText: "",
};
DEFAULT_DUMMY.combinedText = DEFAULT_DUMMY.variants
  .map((t, i) => `案${i + 1}:\n${t}`)
  .join("\n\n");

function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, "\n").trim();
}

/**
 * `generatedText` を「案1/案2/案3」に分割する。
 * 期待フォーマット:
 * 案1:
 * ...
 *
 * 案2:
 * ...
 *
 * 案3:
 * ...
 */
export function parseGeneratedText(raw: string | null | undefined): ParsedGeneratedText {
  const text = normalizeNewlines(raw ?? "");
  if (!text) return DEFAULT_DUMMY;

  // まず "案1:" 〜 "案3:" のブロックを抽出（コロンは :/： どちらでも許容）
  const re = /(?:^|\n)\s*案([1-3])\s*[:：]\s*\n?/g;
  const matches = Array.from(text.matchAll(re));
  if (matches.length === 0) {
    // フォーマットが崩れている場合は全文を案1扱いにして補完
    const v1 = text;
    const v2 = DEFAULT_DUMMY.variants[1];
    const v3 = DEFAULT_DUMMY.variants[2];
    const variants: [string, string, string] = [v1, v2, v3];
    return {
      variants,
      combinedText: variants.map((t, i) => `案${i + 1}:\n${t}`).join("\n\n"),
    };
  }

  const blocks: Record<number, string> = {};
  for (let i = 0; i < matches.length; i++) {
    const idx = Number(matches[i][1]);
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    blocks[idx] = body;
  }

  const v1 = blocks[1] || "";
  const v2 = blocks[2] || DEFAULT_DUMMY.variants[1];
  const v3 = blocks[3] || DEFAULT_DUMMY.variants[2];
  const variants: [string, string, string] = [v1, v2, v3];

  return {
    variants,
    combinedText: variants.map((t, i) => `案${i + 1}:\n${t}`).join("\n\n"),
  };
}

