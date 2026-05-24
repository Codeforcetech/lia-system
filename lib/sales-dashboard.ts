import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

const TZ = "Asia/Tokyo";

/** YYYY-MM-DD in Asia/Tokyo */
export function formatDateKeyInTokyo(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Calendar-day difference (Tokyo): workDateKey minus todayKey in days */
export function daysUntilFromTodayTokyo(workDate: Date, now: Date = new Date()): number {
  const todayKey = formatDateKeyInTokyo(now);
  const targetKey = formatDateKeyInTokyo(workDate);
  const t0 = new Date(`${todayKey}T00:00:00+09:00`);
  const t1 = new Date(`${targetKey}T00:00:00+09:00`);
  return Math.round((t1.getTime() - t0.getTime()) / 86400000);
}

/** Inclusive start (00:00 JST) and end (23:59:59.999 JST) of the calendar month containing `reference` (Tokyo). */
export function daysInMonthForYearMonth(year: number, month: number): number {
  let dim = 31;
  if (month === 2) {
    dim = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  } else if ([4, 6, 9, 11].includes(month)) {
    dim = 30;
  }
  return dim;
}

export function getTokyoMonthRange(reference: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const key = formatDateKeyInTokyo(reference);
  const [yStr, mStr] = key.split("-");
  const y = Number(yStr);
  const m = Number(mStr);

  const dim = daysInMonthForYearMonth(y, m);

  const start = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00+09:00`);
  const end = new Date(
    `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}T23:59:59.999+09:00`
  );
  return { start, end };
}

export type MonthlySalesDashboard = {
  currentMonthSales: number;
  monthlySalesTarget: number;
  /** リング用 0–100（目標超えは 100） */
  achievementRate: number;
  /** 表示用の達成率（目標超えは 100 超え得る） */
  achievementPercentDisplay: number;
  remainingAmount: number;
  nextWorkSchedule: null | {
    id: string;
    workDate: Date;
    daysUntil: number;
    memo: string | null;
  };
};

export async function getMonthlySalesDashboard(
  now: Date = new Date()
): Promise<MonthlySalesDashboard | null> {
  try {
    const user = await getDemoUser();
    const { start, end } = getTokyoMonthRange(now);

    const [agg, setting, schedules] = await Promise.all([
      prisma.visit.aggregate({
        where: {
          userId: user.id,
          visitedAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.userSetting.findUnique({
        where: { userId: user.id },
      }),
      prisma.workSchedule.findMany({
        where: { userId: user.id },
        orderBy: [{ workDate: "asc" }, { id: "asc" }],
        select: { id: true, workDate: true, memo: true },
      }),
    ]);

    const currentMonthSales = agg._sum.amount ?? 0;
    const monthlySalesTarget = setting?.monthlySalesTarget ?? 0;

    const ratioPct =
      monthlySalesTarget > 0
        ? (currentMonthSales / monthlySalesTarget) * 100
        : 0;
    const achievementPercentDisplay = Math.round(ratioPct);
    const achievementRate = Math.min(100, Math.round(ratioPct));
    const remainingAmount = Math.max(0, monthlySalesTarget - currentMonthSales);

    const todayKey = formatDateKeyInTokyo(now);
    const next = schedules.find((s) => formatDateKeyInTokyo(s.workDate) >= todayKey);

    const nextWorkSchedule = next
      ? {
          id: next.id,
          workDate: next.workDate,
          daysUntil: daysUntilFromTodayTokyo(next.workDate, now),
          memo: next.memo,
        }
      : null;

    return {
      currentMonthSales,
      monthlySalesTarget,
      achievementRate,
      achievementPercentDisplay,
      remainingAmount,
      nextWorkSchedule,
    };
  } catch {
    return null;
  }
}
