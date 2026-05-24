"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export type NoteActionState = { ok?: boolean; error?: string };

function toStringOrEmpty(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function createCustomerNote(
  _prev: NoteActionState,
  formData: FormData
): Promise<NoteActionState> {
  try {
    const user = await getDemoUser();
    const customerId = toStringOrEmpty(formData.get("customerId")).trim();
    const content = toStringOrEmpty(formData.get("content")).trim();

    if (!customerId) return { error: "顧客IDが不正です。" };
    if (!content) return { error: "メモ本文は必須です。" };

    // 顧客がdemo userのものかチェック
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId: user.id },
      select: { id: true },
    });
    if (!customer) return { error: "顧客が見つかりません。" };

    await prisma.customerNote.create({
      data: {
        userId: user.id,
        customerId,
        content,
        aiSummary: null,
      },
    });

    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `メモ追加に失敗しました: ${e.message}`
          : "メモ追加に失敗しました。",
    };
  }
}

