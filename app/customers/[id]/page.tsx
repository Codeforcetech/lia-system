import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { NoteForm } from "@/app/customers/[id]/NoteForm";
import { VisitForm } from "@/app/customers/[id]/VisitForm";
import { deleteCustomer } from "@/app/actions/customer";
import { CopyButton } from "@/components/CopyButton";
import { purposeLabel, toneLabel } from "@/lib/labels";
import { parseGeneratedText } from "@/lib/messages";
import { DeleteMessageButton } from "@/components/DeleteMessageButton";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer:
    | (Awaited<ReturnType<typeof fetchCustomer>>)
    | null = null;
  let error: string | null = null;

  try {
    customer = await fetchCustomer(id);
    if (!customer) error = "顧客が見つかりません。";
  } catch (e) {
    error =
      e instanceof Error
        ? `DBに接続できません: ${e.message}`
        : "DBに接続できません。";
  }

  if (error || !customer) {
    return (
      <main className="space-y-4">
        <div className="lia-card-inner border-red-200/70 bg-red-50/60 px-4 py-4 text-sm font-medium text-red-800">
          {error ?? "読み込みに失敗しました。"}
          <div className="mt-3">
            <Link href="/customers" className="lia-btn-secondary">
              一覧へ戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-medium tracking-[0.03em] text-liaInk-heading">
              {customer.name}
            </h1>
            <div className="text-sm font-normal leading-relaxed text-liaInk-muted">
              LINE名: {customer.lineName ?? "（未設定）"}
            </div>
            <div className="text-sm font-normal leading-relaxed text-liaInk-muted">
              最終来店日:{" "}
              {customer.lastVisitDate ? formatDate(customer.lastVisitDate) : "（未登録）"}
            </div>
            <p className="mt-3 lia-prose-soft max-w-md">
              メモや来店を見ながら、送るタイミングを決めましょう。
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link href={`/customers/${customer.id}/edit`} className="lia-btn-secondary text-center text-xs">
              編集
            </Link>
            <Link href={`/customers/${customer.id}/generate`} className="lia-btn-accent text-center text-xs">
              LINE文面
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {customer.tags.map((t) => (
            <span key={t} className="lia-pill">
              {t}
            </span>
          ))}
        </div>

        <dl className="mt-5 grid gap-3 text-sm">
          <div className="lia-card-inner rounded-2xl px-4 py-3">
            <dt className="text-xs font-medium tracking-[0.1em] text-liaInk-muted">誕生日</dt>
            <dd className="mt-1 font-medium text-liaInk-heading">
              {customer.birthday ? formatDate(customer.birthday) : "（未設定）"}
            </dd>
          </div>
          <div className="lia-card-inner rounded-2xl px-4 py-3">
            <dt className="text-xs font-medium tracking-[0.1em] text-liaInk-muted">好きなお酒</dt>
            <dd className="mt-1 font-medium text-liaInk-heading">
              {customer.favoriteDrink ?? "（未設定）"}
            </dd>
          </div>
          <div className="lia-card-inner rounded-2xl px-4 py-3">
            <dt className="text-xs font-medium tracking-[0.1em] text-liaInk-muted">趣味</dt>
            <dd className="mt-1 font-medium text-liaInk-heading">{customer.hobby ?? "（未設定）"}</dd>
          </div>
          <div className="lia-card-inner rounded-2xl px-4 py-3">
            <dt className="text-xs font-medium tracking-[0.1em] text-liaInk-muted">関係性メモ</dt>
            <dd className="mt-1 whitespace-pre-wrap text-[15px] font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
              {customer.relationshipMemo ?? "（未設定）"}
            </dd>
          </div>
        </dl>

        <form action={deleteCustomer} className="mt-5">
          <input type="hidden" name="id" value={customer.id} />
          <button
            type="submit"
            className="w-full rounded-2xl border border-red-200/80 bg-white/90 px-4 py-3.5 text-sm font-medium text-red-700 transition hover:bg-red-50/80"
          >
            顧客を削除
          </button>
        </form>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="lia-heading text-base tracking-[0.04em]">接客メモ</h2>
        <div className="mt-4 space-y-4">
          {customer.notes.length === 0 ? (
            <div className="lia-card-inner rounded-2xl px-4 py-3 text-sm font-normal leading-[1.75] text-liaInk-muted">
              まだメモがありません。思い出したことを一言でも残しておくと、あとで楽です。
            </div>
          ) : null}
          {customer.notes.map((n) => (
            <div key={n.id} className="lia-card-inner rounded-2xl px-4 py-4">
              <div className="text-xs font-medium tracking-[0.06em] text-liaInk-muted">
                {formatDate(n.createdAt)}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
                {n.content}
              </div>
              {n.aiSummary ? (
                <div className="mt-3 rounded-xl border border-lia-200 bg-lia-50 px-3 py-2 text-xs font-normal leading-relaxed text-liaInk">
                  要約: {n.aiSummary}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <NoteForm customerId={customer.id} />
        </div>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="lia-heading text-base tracking-[0.04em]">来店履歴</h2>
        <div className="mt-4 space-y-4">
          {customer.visits.length === 0 ? (
            <div className="lia-card-inner rounded-2xl px-4 py-3 text-sm font-normal leading-[1.75] text-liaInk-muted">
              まだ来店履歴がありません。日付だけでも入れておくと安心です。
            </div>
          ) : null}
          {customer.visits.map((v) => (
            <div key={v.id} className="lia-card-inner rounded-2xl px-4 py-4">
              <div className="text-sm font-medium text-liaInk-heading">{formatDate(v.visitedAt)}</div>
              <div className="mt-1 text-sm font-normal text-liaInk-muted">
                金額: {typeof v.amount === "number" ? `${v.amount.toLocaleString()}円` : "（未設定）"}
              </div>
              {v.memo ? (
                <div className="mt-2 whitespace-pre-wrap text-sm font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
                  {v.memo}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <VisitForm customerId={customer.id} />
        </div>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <h2 className="lia-heading text-base tracking-[0.04em]">つくったLINE</h2>
        <div className="mt-4 space-y-4">
          {customer.generatedMessages.length === 0 ? (
            <div className="lia-card-inner rounded-2xl px-4 py-3 text-sm font-normal leading-[1.75] text-liaInk-muted">
              まだ履歴がありません。「LINEの文面をつくる」から試してみてください。
            </div>
          ) : null}

          {customer.generatedMessages.map((m) => (
            <details
              key={m.id}
              className="group lia-card-inner rounded-2xl px-4 py-4 open:bg-white"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="lia-pill text-[11px]">{purposeLabel(m.purpose)}</span>
                      <span className="lia-pill text-[11px]">{toneLabel(m.tone)}</span>
                      {m.copiedAt ? (
                        <span className="rounded-full border border-lia-300 bg-lia-100 px-3 py-1 text-[11px] font-medium text-liaInk-heading">
                          コピー済み
                        </span>
                      ) : (
                        <span className="rounded-full border border-lia-200 bg-white px-3 py-1 text-[11px] font-medium text-liaInk-muted">
                          未コピー
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs font-medium tracking-[0.04em] text-liaInk-muted">
                      生成: {formatDate(m.createdAt)} / コピー:{" "}
                      {m.copiedAt ? formatDate(m.copiedAt) : "—"}
                    </div>
                    <div className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm font-normal leading-[1.75] tracking-[0.02em] text-liaInk">
                      {parseGeneratedText(m.generatedText).variants[0]}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <CopyButton text={m.generatedText} messageId={m.id} />
                      <div className="opacity-80">
                        <DeleteMessageButton
                          messageId={m.id}
                          customerId={customer.id}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs font-medium tracking-[0.04em] text-liaInk-muted group-open:hidden">
                  タップで全文
                </div>
              </summary>

              <div className="mt-4 space-y-4">
                {parseGeneratedText(m.generatedText).variants.map((v, i) => (
                  <div key={i} className="rounded-2xl border border-lia-200 bg-lia-50 p-4">
                    <div className="text-xs font-medium tracking-[0.12em] text-liaInk-muted">
                      案 {i + 1}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
                      {v}
                    </div>
                    <div className="mt-3">
                      <CopyButton text={v} messageId={m.id} />
                    </div>
                  </div>
                ))}

                <div className="lia-card-inner rounded-2xl px-4 py-4">
                  <div className="text-xs font-medium tracking-[0.12em] text-liaInk-muted">
                    まとめてコピー
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm font-normal leading-[1.8] tracking-[0.02em] text-liaInk">
                    {parseGeneratedText(m.generatedText).combinedText}
                  </div>
                  <div className="mt-3">
                    <CopyButton
                      text={parseGeneratedText(m.generatedText).combinedText}
                      messageId={m.id}
                    />
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

async function fetchCustomer(id: string) {
  const user = await getDemoUser();
  return prisma.customer.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      lineName: true,
      birthday: true,
      favoriteDrink: true,
      hobby: true,
      relationshipMemo: true,
      tags: true,
      lastVisitDate: true,
      notes: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, content: true, aiSummary: true, createdAt: true },
      },
      visits: {
        orderBy: { visitedAt: "desc" },
        take: 30,
        select: { id: true, visitedAt: true, amount: true, memo: true },
      },
      generatedMessages: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          purpose: true,
          tone: true,
          generatedText: true,
          copiedAt: true,
        },
      },
    },
  });
}

