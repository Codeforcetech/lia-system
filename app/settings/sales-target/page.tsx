import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { updateMonthlySalesTarget } from "@/app/actions/settings";

export default async function SalesTargetSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const user = await getDemoUser();
  const setting = await prisma.userSetting.findUnique({
    where: { userId: user.id },
  });

  return (
    <main className="space-y-6 pb-8 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="lia-heading text-lg tracking-[0.04em]">月間売上目標</h1>
            <p className="lia-prose-soft max-w-md">
              今月の目標金額を設定します。ホームの達成率に反映されます。
            </p>
          </div>
          <Link href="/" className="lia-btn-ghost shrink-0 text-xs">
            ホーム
          </Link>
        </div>

        {sp.error === "invalid" ? (
          <p className="mt-4 text-sm font-medium text-red-700" role="alert">
            0以上の整数を入力してください。
          </p>
        ) : null}

        <form action={updateMonthlySalesTarget} className="mt-6 space-y-5">
          <div className="grid gap-2.5">
            <label htmlFor="monthlySalesTarget" className="text-sm font-medium text-liaInk">
              月間売上目標（円）
            </label>
            <input
              id="monthlySalesTarget"
              name="monthlySalesTarget"
              type="number"
              min={0}
              step={1}
              defaultValue={setting?.monthlySalesTarget ?? 0}
              className="lia-input"
              required
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" className="lia-btn-primary w-full sm:w-auto">
              保存する
            </button>
            <Link href="/" className="lia-btn-secondary w-full text-center sm:w-auto">
              キャンセル
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
