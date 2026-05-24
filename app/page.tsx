import Link from "next/link";
import { SalesWorkSummary } from "@/components/SalesWorkSummary";
import { getMonthlySalesDashboard } from "@/lib/sales-dashboard";
import { loadHomeDashboard, HOME_TODO_BUCKET_ORDER } from "@/lib/home-dashboard";
import type { HomeTodoCard } from "@/lib/home-dashboard";
import {
  todoSectionTitleJa,
  todoCardGentleHint,
  todoGroupCollapsibleHintJa,
  type TodoBucketKey,
} from "@/lib/ai-sales";

function TodoGroupedSection({
  groups,
}: {
  groups: Record<TodoBucketKey, HomeTodoCard[]>;
}) {
  const defaultOpenBucket = HOME_TODO_BUCKET_ORDER.find(
    (k) => (groups[k]?.length ?? 0) > 0
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h2 className="lia-heading text-lg">今日の営業TODO</h2>
          <p className="lia-prose-soft max-w-md text-[13px] leading-relaxed">
            タップでグループを開閉できます。いちばん優先のグループだけ最初から開いています。
          </p>
        </div>
        <Link
          href="/customers/new"
          className="shrink-0 self-start rounded-full px-4 py-2.5 text-sm font-medium text-liaInk underline decoration-lia-400 decoration-2 underline-offset-4 transition hover:text-lia-600"
        >
          ＋ 顧客を追加
        </Link>
      </div>

      {HOME_TODO_BUCKET_ORDER.every((k) => (groups[k]?.length ?? 0) === 0) ? (
        <div className="lia-card-inner border-dashed border-lia-300 px-6 py-10 text-center lia-prose-soft">
          今日は静かな日みたいです。余裕のあるときに顧客さんを眺めてみてくださいね。
        </div>
      ) : (
        <div className="space-y-3">
          {HOME_TODO_BUCKET_ORDER.map((bucket) => {
            const items = groups[bucket] ?? [];
            if (items.length === 0) return null;
            const n = items.length;
            const isDefaultOpen = defaultOpenBucket === bucket;
            return (
              <details
                key={bucket}
                className="group overflow-hidden rounded-3xl border border-lia-200 bg-white shadow-lia-sm open:border-lia-300"
                open={isDefaultOpen}
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 marker:hidden [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-liaInk-heading">
                      {todoSectionTitleJa(bucket)}（{n}件）
                    </span>
                    <span className="mt-0.5 block text-[13px] font-normal leading-snug text-liaInk-muted">
                      {todoGroupCollapsibleHintJa(bucket)}
                    </span>
                  </div>
                  <span
                    className="mt-0.5 shrink-0 text-xs text-liaInk-muted transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  >
                    ▼
                  </span>
                </summary>
                <div className="border-t border-lia-100 px-4 pb-4 pt-1">
                  <ul className="space-y-3">
                    {items.map((c) => (
                      <li key={c.customerId} className="lia-card px-5 py-5">
                        <div className="space-y-4">
                          <div>
                            <p className="text-lg font-medium tracking-[0.02em] text-liaInk-heading">
                              {c.customerName}
                            </p>
                            <p className="mt-2 text-[15px] font-normal leading-[1.78] tracking-[0.015em] text-liaInk">
                              {todoCardGentleHint(bucket)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Link
                              href={`/customers/${c.customerId}/generate?purpose=${encodeURIComponent(c.purpose)}&tone=${encodeURIComponent(c.tone)}`}
                              className="lia-btn-accent w-full flex-1 sm:w-auto"
                            >
                              LINEの文面をつくる
                            </Link>
                            <Link
                              href={`/customers/${c.customerId}`}
                              className="lia-btn-secondary w-full sm:w-auto sm:min-w-[5.5rem]"
                            >
                              詳細
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default async function HomePage() {
  const [dash, salesDash] = await Promise.all([
    loadHomeDashboard(),
    getMonthlySalesDashboard(),
  ]);

  if (!dash) {
    return (
      <main className="space-y-4 pb-8">
        <div className="lia-card-inner border-red-200 bg-red-50/50 px-4 py-4 text-sm font-medium text-red-800">
          ホームを読み込めませんでした。DBを起動してから再度お試しください。
        </div>
      </main>
    );
  }

  const { managerAdvice, stats, groups } = dash;

  return (
    <main className="space-y-8 pb-8 sm:space-y-9">
      {salesDash ? (
        <SalesWorkSummary data={salesDash} />
      ) : (
        <div className="lia-card-inner border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-liaInk">
          売上・出勤サマリーを読み込めませんでした。DB接続とマイグレーションを確認してください。
        </div>
      )}

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="lia-prose-soft max-w-sm leading-relaxed">
            Liaは、今日のLINEの温度感をそっと整理する営業の相棒です。
          </p>
          <Link href="/demo" className="lia-btn-secondary shrink-0">
            Liaの使い方を見る
          </Link>
        </div>
      </section>

      <section className="lia-surface-manager">
        <div>
          <h2 className="lia-heading text-xl">AI営業マネージャー</h2>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-liaInk-muted">
            今日の一言
          </p>
        </div>

        <div className="lia-surface-manager-inner mt-4">
          {stats.totalUnique === 0 ? (
            <p className="lia-prose-soft text-[14px] leading-relaxed">
              今日TODOに載るお客様はいません。顧客を登録して、来店やメモを残すとここに集まります。
            </p>
          ) : (
            <>
              <p className="whitespace-pre-line text-[15px] font-normal leading-[1.75] tracking-[0.015em] text-liaInk">
                {managerAdvice}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-liaInk-muted">
                内訳
              </p>
              <ul className="mt-2 space-y-1.5 text-sm font-normal leading-relaxed text-liaInk">
                <li>・誕生日が近い … {stats.breakdown.BIRTHDAY}名</li>
                <li>・来店後のお礼候補 … {stats.breakdown.THANK_YOU}名</li>
                <li>・久しぶり連絡 … {stats.breakdown.LONG_GAP}名</li>
                <li>・接客メモ更新あり … {stats.breakdown.MEMO}名</li>
              </ul>
              {stats.topCustomer ? (
                <p className="mt-4 rounded-2xl border border-lia-200 bg-lia-50 px-4 py-3 text-sm font-medium leading-snug text-liaInk-heading">
                  最優先：{stats.topCustomer.name}さん
                  <span className="mt-1 block text-xs font-normal text-liaInk-muted">
                    {stats.topCustomer.primaryLabel} ・ 優先度 {stats.topCustomer.priority}
                  </span>
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <TodoGroupedSection groups={groups} />
    </main>
  );
}
