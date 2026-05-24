"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

function toStringOrEmpty(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v : "";
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export type CustomerActionState = { error?: string };

export async function getCustomer(id: string) {
  const user = await getDemoUser();
  const customer = await prisma.customer.findFirst({
    where: { id, userId: user.id },
  });
  return customer;
}

export async function createCustomer(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  try {
    const user = await getDemoUser();

    const name = toStringOrEmpty(formData.get("name")).trim();
    if (!name) return { error: "顧客名は必須です。" };

    const lineName = toStringOrEmpty(formData.get("lineName")).trim() || null;
    const favoriteDrink =
      toStringOrEmpty(formData.get("favoriteDrink")).trim() || null;
    const hobby = toStringOrEmpty(formData.get("hobby")).trim() || null;
    const relationshipMemo =
      toStringOrEmpty(formData.get("relationshipMemo")).trim() || null;

    const tags = parseTags(toStringOrEmpty(formData.get("tags")));

    const birthdayRaw = toStringOrEmpty(formData.get("birthday")).trim();
    const birthday = birthdayRaw ? new Date(birthdayRaw) : null;
    const birthdaySafe = birthday && !Number.isNaN(birthday.getTime()) ? birthday : null;

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        name,
        lineName,
        favoriteDrink,
        hobby,
        relationshipMemo,
        tags,
        birthday: birthdaySafe,
      },
      select: { id: true },
    });

    revalidatePath("/customers");
    redirect(`/customers/${customer.id}`);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `登録に失敗しました: ${e.message}`
          : "登録に失敗しました。",
    };
  }
}

export async function updateCustomer(
  _prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  try {
    const user = await getDemoUser();

    const id = toStringOrEmpty(formData.get("id")).trim();
    if (!id) return { error: "顧客IDが不正です。" };

    const name = toStringOrEmpty(formData.get("name")).trim();
    if (!name) return { error: "顧客名は必須です。" };

    const lineName = toStringOrEmpty(formData.get("lineName")).trim() || null;
    const favoriteDrink =
      toStringOrEmpty(formData.get("favoriteDrink")).trim() || null;
    const hobby = toStringOrEmpty(formData.get("hobby")).trim() || null;
    const relationshipMemo =
      toStringOrEmpty(formData.get("relationshipMemo")).trim() || null;

    const tags = parseTags(toStringOrEmpty(formData.get("tags")));

    const birthdayRaw = toStringOrEmpty(formData.get("birthday")).trim();
    const birthday = birthdayRaw ? new Date(birthdayRaw) : null;
    const birthdaySafe = birthday && !Number.isNaN(birthday.getTime()) ? birthday : null;

    await prisma.customer.update({
      where: { id, userId: user.id },
      data: {
        name,
        lineName,
        favoriteDrink,
        hobby,
        relationshipMemo,
        tags,
        birthday: birthdaySafe,
      },
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    redirect(`/customers/${id}`);
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? `更新に失敗しました: ${e.message}`
          : "更新に失敗しました。",
    };
  }
}

export async function deleteCustomer(formData: FormData) {
  const user = await getDemoUser();
  const id = toStringOrEmpty(formData.get("id")).trim();
  if (!id) redirect("/customers");

  await prisma.customer.delete({
    where: { id, userId: user.id },
  });

  revalidatePath("/customers");
  redirect("/customers");
}

