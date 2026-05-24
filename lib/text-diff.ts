/**
 * AI原文 vs 人間採用版の「差の大きさ」をざっくり数値化する（Phase 2–5 採用学習用）。
 * 将来: レヴェンシュタイン、トークン単位、セマンティック類似度などへ差し替え可能にする。
 */

const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|\u{FE0F}|\u{200D}/gu;

export function countNewlines(s: string): number {
  return s.match(/\n/g)?.length ?? 0;
}

export function countEmojiLike(s: string): number {
  const m = s.match(EMOJI_REGEX);
  return m ? m.length : 0;
}

/**
 * 簡易 edit 距離スコア（小さいほど近い、同一なら 0 に近い）。
 * - 文字数差の絶対値
 * - 改行数差 × 重み（改行テンポの変化を拾う）
 * - 絵文字っぽい符号素数差 × 重み（装飾・温度感の変化をざっくり拾う）
 */
export function createSimpleEditDistance(a: string, b: string): number {
  const lenDiff = Math.abs(a.length - b.length);
  const nlDiff = Math.abs(countNewlines(a) - countNewlines(b));
  const emojiDiff = Math.abs(countEmojiLike(a) - countEmojiLike(b));
  const W_NL = 5;
  const W_EMOJI = 3;
  return lenDiff + nlDiff * W_NL + emojiDiff * W_EMOJI;
}
