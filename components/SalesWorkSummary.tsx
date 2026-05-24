import Link from "next/link";
import { SalesAchievementRing } from "@/components/SalesAchievementRing";
import type { MonthlySalesDashboard } from "@/lib/sales-dashboard";

const TZ = "Asia/Tokyo";

function formatYen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function SalesWorkSummary({ data }: { data: MonthlySalesDashboard }) {
  const next = data.nextWorkSchedule;
  const dateLine = next
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: TZ,
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }).format(next.workDate)
    : null;

  const daysLabel =
    next === null
      ? null
      : next.daysUntil === 0
        ? "今日"
        : next.daysUntil > 0
          ? `あと${next.daysUntil}日`
          : `${Math.abs(next.daysUntil)}日前`;

  return (
    <section className="lia-card overflow-hidden p-0">
      <div className="grid gap-px bg-lia-200 sm:grid-cols-2">
        <div className="bg-white px-5 py-6 sm:px-6 sm:py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-liaInk-muted">
            次回出勤予定
          </p>
          {next ? (
            <>
              <p className="mt-3 text-2xl font-medium tracking-[0.02em] text-liaInk-heading">
                {dateLine}
              </p>
              {daysLabel ? (
                <p className="mt-1 text-sm font-medium text-lia-600">{daysLabel}</p>
              ) : null}
              {next.memo ? (
                <p className="mt-3 text-sm font-normal leading-relaxed text-liaInk">
                  {next.memo}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-liaInk-muted">
              まだ出勤予定が登録されていません。
            </p>
          )}
          <Link
            href="/work-schedules"
            className="lia-btn-secondary mt-5 w-full text-sm sm:mt-6"
          >
            出勤予定を見る
          </Link>
        </div>

        <div className="bg-white px-5 py-6 sm:px-6 sm:py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-liaInk-muted">
            今月売上
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-2xl font-medium tracking-[0.02em] text-liaInk-heading">
                {formatYen(data.currentMonthSales)}
              </p>
              <p className="text-sm text-liaInk-muted">
                目標 {formatYen(data.monthlySalesTarget)}
              </p>
              <p className="text-sm font-medium text-liaInk">
                達成率 {data.achievementPercentDisplay}%
                {data.achievementPercentDisplay > 100 ? (
                  <span className="ml-1 text-xs font-normal text-liaInk-muted">
                    （目標達成）
                  </span>
                ) : null}
              </p>
              <p className="text-xs leading-relaxed text-liaInk-subtle">
                残り {formatYen(data.remainingAmount)}
              </p>
            </div>
            <SalesAchievementRing percent={data.achievementRate} size={92} />
          </div>
          <Link
            href="/settings/sales-target"
            className="lia-btn-secondary mt-5 w-full text-sm sm:mt-6"
          >
            目標を編集
          </Link>
        </div>
      </div>
    </section>
  );
}
