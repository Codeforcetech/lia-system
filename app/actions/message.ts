"use server";

import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import {
  generateLineMessage,
  type LineMessageDummyReason,
} from "@/lib/ai/generate-line-message";
import {
  extractConversationThemes,
  type ConversationThemeResult,
} from "@/lib/ai-conversation";
import {
  classifyConversationIntent,
  type ConversationIntentResult,
} from "@/lib/ai-intent";
import { lookupConversationReferences } from "@/lib/conversation-recommendations";
import { buildPersonaProfile, buildAdaptivePersonaForPrompt } from "@/lib/persona-builder";
import { extractAdaptiveSnapshotFromInputContext } from "@/lib/persona-effect-analytics";
import { createSimpleEditDistance } from "@/lib/text-diff";
import { MessagePurpose, MessageTone } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Phase 2–5 採用学習（保存のみ）
 *
 * Core Intelligence: 全ユーザー横断で「強い営業構文」の傾向を将来分析する。
 * Persona Intelligence: ユーザー別の文体・癖を将来学習する。
 * Phase 2–8: 生成時は buildPersonaProfile → adaptivePersona を generateLineMessage に渡す。
 */

export type GenerateMessageState = {
  error?: string;
  variants?: string[];
  combinedText?: string;
  savedMessageId?: string;
  isDummy?: boolean;
  dummyReason?: LineMessageDummyReason;
  /** 追加指示から整理した会話テーマ（メモ空のときは undefined） */
  conversationPlan?: ConversationThemeResult | null;
  /** 意図分類（メモ空のときは undefined） */
  intentClassification?: ConversationIntentResult | null;
  /** 固定データ等から補完した具体候補（なければ undefined） */
  conversationReferences?: { recommendations: string[] } | null;
  /** 直近の生成に使った目的（採用学習フォーム用） */
  purpose?: MessagePurpose;
  /** 直近の生成に使った文体（採用学習フォーム用） */
  tone?: MessageTone;
};

export type SaveFeedbackState = {
  ok?: boolean;
  error?: string;
};

function toStringOrEmpty(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function coercePurpose(raw: string): MessagePurpose {
  return (Object.values(MessagePurpose) as string[]).includes(raw)
    ? (raw as MessagePurpose)
    : MessagePurpose.CASUAL_CHAT;
}

function coerceTone(raw: string): MessageTone {
  return (Object.values(MessageTone) as string[]).includes(raw)
    ? (raw as MessageTone)
    : MessageTone.NATURAL;
}

export async function generateMessageForCustomer(
  _prev: GenerateMessageState,
  formData: FormData
): Promise<GenerateMessageState> {
  try {
    const user = await getDemoUser();
    const customerId = toStringOrEmpty(formData.get("customerId")).trim();
    if (!customerId) return { error: "顧客IDが不正です。" };

    const purpose = coercePurpose(toStringOrEmpty(formData.get("purpose")).trim());
    const tone = coerceTone(toStringOrEmpty(formData.get("tone")).trim());
    const additionalInstruction = toStringOrEmpty(
      formData.get("additionalInstruction")
    ).trim();

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId: user.id },
      select: {
        id: true,
        name: true,
        lineName: true,
        birthday: true,
        favoriteDrink: true,
        hobby: true,
        relationshipMemo: true,
        tags: true,
        lastVisitDate: true,
      },
    });
    if (!customer) return { error: "顧客が見つかりません。" };

    const [recentNotes, recentVisits] = await Promise.all([
      prisma.customerNote.findMany({
        where: { customerId, userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { content: true, createdAt: true },
      }),
      prisma.visit.findMany({
        where: { customerId, userId: user.id },
        orderBy: { visitedAt: "desc" },
        take: 3,
        select: { visitedAt: true, amount: true, memo: true },
      }),
    ]);

    let intentClassification: ConversationIntentResult | null = null;
    let conversationReferences: { recommendations: string[] } | null = null;

    if (additionalInstruction.trim()) {
      intentClassification = await classifyConversationIntent({
        memo: additionalInstruction,
      });
      const recs = lookupConversationReferences({
        intent: intentClassification.intent,
        location: intentClassification.location,
        category: intentClassification.category,
        needsRealInformation: intentClassification.needsRealInformation,
      });
      if (recs.length > 0) {
        conversationReferences = { recommendations: recs };
      }
    }

    const [conversationPlan, personaProfile] = await Promise.all([
      additionalInstruction.trim()
        ? extractConversationThemes({
            memo: additionalInstruction,
            customerName: customer.name,
            customerTags: customer.tags,
            intentClassification,
            conversationReferences,
          })
        : Promise.resolve(null),
      buildPersonaProfile(),
    ]);

    const ai = await generateLineMessage({
      customer,
      recentNotes,
      recentVisits,
      purpose,
      tone,
      additionalInstruction,
      conversationPlan,
      intentClassification,
      conversationReferences,
      personaProfile,
    });

    const inputContext = JSON.stringify(
      {
        customer,
        recentNotes,
        recentVisits,
        purpose,
        tone,
        additionalInstruction: additionalInstruction || null,
        intentClassification,
        conversationReferences,
        conversationPlan,
        adaptivePersona: buildAdaptivePersonaForPrompt(personaProfile),
        personaFeedbackSampleSize: personaProfile.feedbackSampleSize,
        isDummy: ai.isDummy,
      },
      null,
      2
    );

    const saved = await prisma.generatedMessage.create({
      data: {
        userId: user.id,
        customerId,
        purpose,
        tone,
        inputContext,
        generatedText: ai.combinedText,
        copiedAt: null,
      },
      select: { id: true },
    });

    revalidatePath(`/customers/${customerId}/generate`);
    revalidatePath(`/customers/${customerId}`);

    return {
      variants: ai.variants,
      combinedText: ai.combinedText,
      savedMessageId: saved.id,
      isDummy: ai.isDummy,
      dummyReason: ai.dummyReason,
      conversationPlan: additionalInstruction.trim() ? conversationPlan : null,
      intentClassification: additionalInstruction.trim() ? intentClassification : null,
      conversationReferences: additionalInstruction.trim() ? conversationReferences : null,
      purpose,
      tone,
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `生成に失敗しました: ${e.message}`
          : "生成に失敗しました。",
    };
  }
}

export type DeleteGeneratedMessageResult = { ok: true } | { ok: false; error: string };

export async function saveGeneratedMessageFeedback(
  _prev: SaveFeedbackState,
  formData: FormData
): Promise<SaveFeedbackState> {
  try {
    const user = await getDemoUser();
    const customerId = toStringOrEmpty(formData.get("customerId")).trim();
    const generatedMessageId = toStringOrEmpty(formData.get("generatedMessageId")).trim() || null;
    const selectedIndexRaw = toStringOrEmpty(formData.get("selectedIndex")).trim();
    const aiOriginalText = toStringOrEmpty(formData.get("aiOriginalText"));
    const finalAdoptedText = toStringOrEmpty(formData.get("finalAdoptedText")).trim();
    const purpose = coercePurpose(toStringOrEmpty(formData.get("purpose")).trim());
    const tone = coerceTone(toStringOrEmpty(formData.get("tone")).trim());

    if (!customerId) {
      return { error: "顧客IDが不正です。" };
    }
    if (!generatedMessageId) {
      return { error: "生成履歴が見つかりません。" };
    }
    if (!finalAdoptedText) {
      return { error: "文面を入力してください。" };
    }

    const selectedIndex = Number.parseInt(selectedIndexRaw, 10);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex > 2) {
      return { error: "案の指定が不正です。" };
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      return { error: "顧客が見つかりません。" };
    }

    const msg = await prisma.generatedMessage.findFirst({
      where: { id: generatedMessageId, userId: user.id, customerId },
      select: { id: true, inputContext: true },
    });
    if (!msg) {
      return { error: "生成履歴が見つかりません。" };
    }

    const personaSnap = extractAdaptiveSnapshotFromInputContext(msg.inputContext);

    const wasEdited = aiOriginalText.trim() !== finalAdoptedText.trim();
    const editDistance = createSimpleEditDistance(aiOriginalText, finalAdoptedText);

    await prisma.generatedMessageFeedback.create({
      data: {
        userId: user.id,
        customerId,
        generatedMessageId,
        selectedIndex,
        aiOriginalText,
        finalAdoptedText,
        wasEdited,
        editDistance,
        purpose,
        tone,
        adaptivePersonaApplied: personaSnap.applied,
        adaptivePersonaTags: personaSnap.tags,
        adaptivePersonaTone: personaSnap.tone,
        adaptivePersonaDirectiveCount: personaSnap.directiveCount,
      },
    });

    revalidatePath(`/customers/${customerId}/generate`);
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `保存に失敗しました: ${e.message}`
          : "保存に失敗しました。",
    };
  }
}

export async function deleteGeneratedMessage(
  messageId: string,
  customerId: string
): Promise<DeleteGeneratedMessageResult> {
  try {
    const user = await getDemoUser();
    await prisma.generatedMessage.delete({
      where: { id: messageId, userId: user.id },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `削除に失敗しました: ${e.message}`
          : "削除に失敗しました。",
    };
  }
}

