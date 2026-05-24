import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

export default async function DemoPage() {
  const demo = await getDemoUser().catch(() => null);
  const airiId = demo
    ? await prisma.customer
        .findFirst({
          where: { userId: demo.id, name: "Airi" },
          select: { id: true },
        })
        .then((c) => c?.id ?? null)
        .catch(() => null)
    : null;

  const anyCustomerId = demo
    ? await prisma.customer
        .findFirst({
          where: { userId: demo.id },
          orderBy: [{ updatedAt: "desc" }],
          select: { id: true },
        })
        .then((c) => c?.id ?? null)
        .catch(() => null)
    : null;

  const targetId = airiId ?? anyCustomerId;

  return (
    <main className="space-y-6 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="lia-heading text-lg tracking-[0.04em]">
              30秒でわかる Lia
            </h1>
            <p className="lia-prose-soft">はじめての方へ、触る順番だけまとめました。</p>
          </div>
          <Link href="/" className="lia-btn-ghost shrink-0 text-xs">
            ホーム
          </Link>
        </div>

        <ol className="mt-5 list-decimal space-y-3 pl-5 text-[15px] font-normal leading-[1.78] tracking-[0.015em] text-liaInk">
          <li>ホームで今日の流れを見る</li>
          <li>お客様のページでメモを眺める</li>
          <li>LINEの文面を3つつくる</li>
          <li>コピーして、そのままLINEへ</li>
        </ol>

        <div className="mt-5 rounded-2xl border border-lia-300 bg-lia-100 px-4 py-3.5 text-sm font-normal leading-[1.78] tracking-[0.015em] text-liaInk">
          デモでは「Airi」さんのメモと来店が入っています。まずはそこで試してみてくださいね。
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {targetId ? (
            <Link href={`/customers/${targetId}/generate`} className="lia-btn-accent w-full">
              {airiId ? "Airiで試してみる" : "文面をつくってみる"}
            </Link>
          ) : (
            <Link href="/customers/new" className="lia-btn-primary w-full">
              お客様を登録する
            </Link>
          )}

          <Link href="/customers" className="lia-btn-secondary w-full">
            顧客一覧へ
          </Link>
        </div>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="lia-heading text-base tracking-[0.04em]">かくにんの流れ</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] font-normal leading-[1.78] tracking-[0.015em] text-liaInk">
          <li>ホームで今日のヒントを読む</li>
          <li>顧客詳細を開く</li>
          <li>「LINEの文面をつくる」で3案を出す</li>
          <li>コピーして、詳細に戻り「コピー済み」を見る</li>
        </ol>
      </section>
    </main>
  );
}
