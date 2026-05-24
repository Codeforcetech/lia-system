import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { formatDateKeyInTokyo } from "@/lib/sales-dashboard";
import { updateWorkSchedule } from "@/app/actions/work-schedule";

export default async function EditWorkSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getDemoUser();
  const row = await prisma.workSchedule.findFirst({
    where: { id, userId: user.id },
  });
  if (!row) notFound();

  const dateValue = formatDateKeyInTokyo(row.workDate);

  return (
    <main className="space-y-6 pb-8 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="lia-heading text-lg tracking-[0.04em]">出勤予定の編集</h1>
            <p className="lia-prose-soft max-w-md">日付とメモを更新できます。</p>
          </div>
          <Link href="/work-schedules" className="lia-btn-ghost shrink-0 text-xs">
            一覧
          </Link>
        </div>

        {sp.error === "date" ? (
          <p className="mt-4 text-sm font-medium text-red-700" role="alert">
            日付を確認してください。
          </p>
        ) : null}

        <form action={updateWorkSchedule} className="mt-6 grid gap-5 sm:max-w-md">
          <input type="hidden" name="id" value={row.id} />
          <div className="grid gap-2.5">
            <label htmlFor="workDate" className="text-sm font-medium text-liaInk">
              出勤日
            </label>
            <input
              id="workDate"
              name="workDate"
              type="date"
              className="lia-input"
              defaultValue={dateValue}
              required
            />
          </div>
          <div className="grid gap-2.5">
            <label htmlFor="memo" className="text-sm font-medium text-liaInk">
              メモ（任意）
            </label>
            <input
              id="memo"
              name="memo"
              type="text"
              className="lia-input"
              defaultValue={row.memo ?? ""}
              placeholder="例）20:00〜"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" className="lia-btn-primary w-full sm:w-auto">
              保存する
            </button>
            <Link href="/work-schedules" className="lia-btn-secondary w-full text-center sm:w-auto">
              キャンセル
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
