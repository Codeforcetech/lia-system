import { MessagePurpose, MessageTone } from "@prisma/client";

export const PURPOSE_LABELS: Record<MessagePurpose, string> = {
  THANK_YOU: "来店後のお礼",
  LONG_TIME_NO_SEE: "久しぶり連絡",
  BIRTHDAY: "誕生日",
  EVENT_INVITE: "イベント案内",
  VISIT_INVITE: "来店打診",
  DATE_INVITE: "同伴打診",
  CASUAL_CHAT: "自然な雑談",
  OTHER: "その他",
};

export const TONE_LABELS: Record<MessageTone, string> = {
  NATURAL: "自然",
  POLITE: "丁寧",
  FRIENDLY: "フランク",
  SWEET: "甘め",
  SHORT: "短め",
  LOW_EMOJI: "絵文字少なめ",
  HIGH_EMOJI: "絵文字多め",
};

export function purposeLabel(purpose: MessagePurpose) {
  return PURPOSE_LABELS[purpose] ?? purpose;
}

export function toneLabel(tone: MessageTone) {
  return TONE_LABELS[tone] ?? tone;
}

