"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export async function updateMonthlySalesTarget(formData: FormData) {
  const raw = formData.get("monthlySalesTarget");
  const s = typeof raw === "string" ? raw.replace(/,/g, "").trim() : "";
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) {
    redirect("/settings/sales-target?error=invalid");
  }


  const user = await getDemoUser();
  await prisma.userSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, monthlySalesTarget: n },
    update: { monthlySalesTarget: n },
  });

  revalidatePath("/");
  revalidatePath("/settings/sales-target");
  redirect("/");
}
