import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import {
  formatDateKeyInTokyo,
  daysInMonthForYearMonth,
  daysUntilFromTodayTokyo,
} from "@/lib/sales-dashboard";
import { createWorkSchedule, deleteWorkSchedule } from "@/app/actions/work-schedule";

const TZ = "Asia/Tokyo";

function weekdayShortToIndex(s: string): number {
  const m: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return m[s] ?? 0;
}

export default async function WorkSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const defaultKey = formatDateKeyInTokyo(now);
  const [dy, dm] = defaultKey.split("-").map(Number);
  const yParsed = parseInt(sp.y ?? String(dy), 10);
  const mParsed = parseInt(sp.m ?? String(dm), 10);
  const year = Number.isFinite(yParsed) ? yParsed : dy;
  const month =
    Number.isFinite(mParsed) && mParsed >= 1 && mParsed <= 12 ? mParsed : dm;

  const user = await getDemoUser();
  const dim = daysInMonthForYearMonth(year, month);
  const first = new Date(
    `${year}-${String(month).padStart(2, "0")}-01T12:00:00+09:00`
  );
  const wkLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(first);
  const startPad = weekdayShortToIndex(wkLabel);

  const rangeStart = new Date(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00+09:00`
  );
  const rangeEnd = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(dim).padStart(2, "0")}T23:59:59.999+09:00`
  );

  const [schedulesInMonth, allSchedules] = await Promise.all([
    prisma.workSchedule.findMany({
      where: {
        userId: user.id,
        workDate: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: [{ workDate: "asc" }, { id: "asc" }],
    }),
    prisma.workSchedule.findMany({
      where: { userId: user.id },
      orderBy: [{ workDate: "asc" }, { id: "asc" }],
    }),
  ]);

  const byDay = new Map<string, number>();
  for (const s of schedulesInMonth) {
    const k = formatDateKeyInTokyo(s.workDate);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }

  const todayKey = formatDateKeyInTokyo(now);
  const next = allSchedules.find((s) => formatDateKeyInTokyo(s.workDate) >= todayKey);

  const prevMonth = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const errMsg =
    sp.error === "date"
      ? "日付を確認してください。"
      : sp.error === "notfound"
        ? "データが見つかりませんでした。"
        : sp.error === "form"
          ? "送信内容を確認してください。"
          : null;

  const cells: (number | null)[] = [...Array(startPad).fill(null)];
  for (let d = 1; d <= dim; d++) cells.push(d);

  return (
    <main className="space-y-6 pb-8 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="lia-heading text-lg tracking-[0.04em]">出勤予定</h1>
            <p className="lia-prose-soft max-w-md">
              カレンダーで月を選び、出勤日を登録・編集できます。
            </p>
          </div>
          <Link href="/" className="lia-btn-ghost shrink-0 text-xs">
            ホーム
          </Link>
        </div>

        {next ? (
          <div className="mt-5 rounded-2xl border border-lia-300 bg-lia-50 px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-liaInk-muted">
              次回出勤予定
            </p>
            <p className="mt-1 text-base font-medium text-liaInk-heading">
              {new Intl.DateTimeFormat("ja-JP", {
                timeZone: TZ,
                month: "numeric",
                day: "numeric",
                weekday: "short",
              }).format(next.workDate)}
              <span className="ml-2 text-sm font-medium text-lia-600">
                {daysUntilFromTodayTokyo(next.workDate, now) === 0
                  ? "（今日）"
                  : daysUntilFromTodayTokyo(next.workDate, now) > 0
                    ? `（あと${daysUntilFromTodayTokyo(next.workDate, now)}日）`
                    : ""}
              </span>
            </p>
            {next.memo ? (
              <p className="mt-2 text-sm text-liaInk">{next.memo}</p>
            ) : null}
          </div>
        ) : null}

        {errMsg ? (
          <p className="mt-4 text-sm font-medium text-red-700" role="alert">
            {errMsg}
          </p>
        ) : null}
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="lia-heading text-base">新規登録</h2>
        <form action={createWorkSchedule} className="mt-4 grid gap-4 sm:max-w-md">
          <div className="grid gap-2.5">
            <label htmlFor="workDate" className="text-sm font-medium text-liaInk">
              出勤日
            </label>
            <input id="workDate" name="workDate" type="date" className="lia-input" required />
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
              placeholder="例）20:00〜"
            />
          </div>
          <button type="submit" className="lia-btn-primary w-full sm:w-auto">
            登録する
          </button>
        </form>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="lia-heading text-base">
            {year}年{month}月
          </h2>
          <div className="flex gap-2">
            <Link
              href={`/work-schedules?y=${prevMonth.y}&m=${prevMonth.m}`}
              className="lia-btn-secondary px-3 py-2 text-xs"
            >
              ←
            </Link>
            <Link
              href={`/work-schedules?y=${nextMonth.y}&m=${nextMonth.m}`}
              className="lia-btn-secondary px-3 py-2 text-xs"
            >
              →
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-liaInk-muted">
          {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
          {cells.map((d, i) =>
            d === null ? (
              <div key={`e-${i}`} className="min-h-[2.75rem]" />
            ) : (
              <div
                key={d}
                className={`flex min-h-[2.75rem] flex-col items-center justify-start rounded-xl border py-1 text-sm ${
                  `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}` ===
                  todayKey
                    ? "border-lia-600 bg-lia-50 font-medium text-liaInk-heading"
                    : "border-lia-200 bg-white text-liaInk"
                }`}
              >
                <span>{d}</span>
                {(byDay.get(
                  `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                ) ?? 0) > 0 ? (
                  <span className="mt-0.5 size-1.5 rounded-full bg-lia-600" aria-hidden />
                ) : null}
              </div>
            )
          )}
        </div>

        <h3 className="mt-8 text-sm font-semibold text-liaInk-heading">
          この月の予定一覧
        </h3>
        {schedulesInMonth.length === 0 ? (
          <p className="mt-3 text-sm text-liaInk-muted">登録はまだありません。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {schedulesInMonth.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-2xl border border-lia-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-liaInk-heading">
                    {new Intl.DateTimeFormat("ja-JP", {
                      timeZone: TZ,
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    }).format(s.workDate)}
                  </p>
                  {s.memo ? (
                    <p className="mt-1 text-sm text-liaInk-muted">{s.memo}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/work-schedules/${s.id}/edit`}
                    className="lia-btn-secondary px-4 py-2 text-xs"
                  >
                    編集
                  </Link>
                  <form action={deleteWorkSchedule}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50"
                    >
                      削除
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
