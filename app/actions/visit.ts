"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export type VisitActionState = { ok?: boolean; error?: string };

function toStringOrEmpty(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

export async function createVisit(
  _prev: VisitActionState,
  formData: FormData
): Promise<VisitActionState> {
  try {
    const user = await getDemoUser();
    const customerId = toStringOrEmpty(formData.get("customerId")).trim();
    const visitedAtRaw = toStringOrEmpty(formData.get("visitedAt")).trim();
    const amountRaw = toStringOrEmpty(formData.get("amount")).trim();
    const memo = toStringOrEmpty(formData.get("memo")).trim() || null;

    if (!customerId) return { error: "顧客IDが不正です。" };
    if (!visitedAtRaw) return { error: "来店日は必須です。" };
    const visitedAt = new Date(visitedAtRaw);
    if (Number.isNaN(visitedAt.getTime()))
      return { error: "来店日の形式が不正です。" };

    const amount =
      amountRaw === "" ? null : Number.isFinite(Number(amountRaw)) ? Number(amountRaw) : NaN;
    if (amount !== null && Number.isNaN(amount))
      return { error: "金額は数値で入力してください。" };

    // 顧客がdemo userのものかチェック
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, userId: user.id },
      select: { id: true },
    });
    if (!customer) return { error: "顧客が見つかりません。" };

    await prisma.$transaction([
      prisma.visit.create({
        data: {
          userId: user.id,
          customerId,
          visitedAt,
          amount: amount === null ? null : Math.trunc(amount),
          memo,
        },
      }),
      prisma.customer.update({
        where: { id: customerId, userId: user.id },
        data: { lastVisitDate: visitedAt },
      }),
    ]);

    revalidatePath(`/customers/${customerId}`);
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `来店履歴の追加に失敗しました: ${e.message}`
          : "来店履歴の追加に失敗しました。",
    };
  }
}

