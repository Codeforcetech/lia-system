"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

function revalidateWorkPaths() {
  revalidatePath("/");
  revalidatePath("/work-schedules");
}

export async function createWorkSchedule(formData: FormData) {
  const dateStr = formData.get("workDate");
  const memoRaw = formData.get("memo");
  if (typeof dateStr !== "string" || !dateStr.trim()) {
    redirect("/work-schedules?error=date");
  }
  const workDate = new Date(`${dateStr.trim()}T00:00:00+09:00`);
  if (Number.isNaN(workDate.getTime())) {
    redirect("/work-schedules?error=date");
  }
  const memo =
    typeof memoRaw === "string" && memoRaw.trim() ? memoRaw.trim() : null;

  const user = await getDemoUser();
  await prisma.workSchedule.create({
    data: { userId: user.id, workDate, memo },
  });
  revalidateWorkPaths();
  redirect("/work-schedules");
}

export async function updateWorkSchedule(formData: FormData) {
  const id = formData.get("id");
  const dateStr = formData.get("workDate");
  const memoRaw = formData.get("memo");
  if (typeof id !== "string" || !id) {
    redirect("/work-schedules?error=form");
  }
  if (typeof dateStr !== "string" || !dateStr.trim()) {
    redirect(`/work-schedules/${id}/edit?error=date`);
  }
  const workDate = new Date(`${dateStr.trim()}T00:00:00+09:00`);
  if (Number.isNaN(workDate.getTime())) {
    redirect(`/work-schedules/${id}/edit?error=date`);
  }
  const memo =
    typeof memoRaw === "string" && memoRaw.trim() ? memoRaw.trim() : null;

  const user = await getDemoUser();
  const row = await prisma.workSchedule.findFirst({
    where: { id, userId: user.id },
  });
  if (!row) {
    redirect("/work-schedules?error=notfound");
  }
  await prisma.workSchedule.update({
    where: { id },
    data: { workDate, memo },
  });
  revalidateWorkPaths();
  redirect("/work-schedules");
}

export async function deleteWorkSchedule(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/work-schedules?error=form");
  }
  const user = await getDemoUser();
  const row = await prisma.workSchedule.findFirst({
    where: { id, userId: user.id },
  });
  if (!row) {
    redirect("/work-schedules?error=notfound");
  }
  await prisma.workSchedule.delete({ where: { id } });
  revalidateWorkPaths();
  redirect("/work-schedules");
}
