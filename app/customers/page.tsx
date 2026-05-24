import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tag = (sp.tag ?? "").trim();

  let customers:
    | Array<{
        id: string;
        name: string;
        lineName: string | null;
        lastVisitDate: Date | null;
        tags: string[];
        relationshipMemo: string | null;
      }>
    | null = null;
  let error: string | null = null;

  try {
    const user = await getDemoUser();
    customers = await prisma.customer.findMany({
      where: {
        userId: user.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { lineName: { contains: q, mode: "insensitive" } },
                { relationshipMemo: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        lineName: true,
        lastVisitDate: true,
        tags: true,
        relationshipMemo: true,
      },
      take: 200,
    });
  } catch (e) {
    error =
      e instanceof Error
        ? `DBに接続できません: ${e.message}`
        : "DBに接続できません。";
  }

  const allTags = Array.from(
    new Set((customers ?? []).flatMap((c) => c.tags))
  ).sort((a, b) => a.localeCompare(b, "ja"));

  return (
    <main className="space-y-6 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="lia-heading text-lg tracking-[0.04em]">顧客</h1>
            <p className="lia-prose-soft max-w-md">
              お客様のことを、思い出しやすい形で残していきましょう。
            </p>
          </div>
          <Link href="/customers/new" className="lia-btn-primary shrink-0 text-sm">
            新規登録
          </Link>
        </div>

        <form className="mt-6 grid gap-5">
          <input
            name="q"
            defaultValue={q}
            className="lia-input"
            placeholder="名前・LINE名・メモで検索"
          />
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/customers?q=${encodeURIComponent(q)}`}
              className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                tag
                  ? "border-lia-200 bg-white text-liaInk hover:border-lia-300"
                  : "border-lia-600 bg-lia-600 text-white shadow-lia-sm hover:bg-lia-700"
              }`}
            >
              すべて
            </Link>
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/customers?q=${encodeURIComponent(q)}&tag=${encodeURIComponent(t)}`}
                className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                  tag === t
                    ? "border-lia-600 bg-lia-600 text-white shadow-lia-sm hover:bg-lia-700"
                    : "border-lia-200 bg-white text-liaInk hover:border-lia-300"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
          <button type="submit" className="lia-btn-secondary w-full sm:w-auto">
            検索する
          </button>
        </form>
      </section>

      {error ? (
        <div className="lia-card-inner border-red-200/70 bg-red-50/60 px-4 py-4 text-sm font-medium text-red-800">
          {error}
          <div className="mt-2 text-xs font-medium text-red-800/85">
            （DockerでPostgreSQLを起動してから再読み込みしてください）
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        {(customers ?? []).length === 0 && !error ? (
          <div className="lia-card px-5 py-6 text-center">
            <p className="lia-prose-soft">
              まだお客様がいません。まずは1人、登録してみましょう。
            </p>
            <div className="mt-4">
              <Link href="/customers/new" className="lia-btn-primary inline-flex">
                顧客を登録する
              </Link>
            </div>
          </div>
        ) : null}

        {(customers ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            className="lia-card block px-6 py-6 transition duration-200 hover:shadow-lia"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-medium tracking-[0.03em] text-liaInk-heading">
                  {c.name}
                </div>
                <div className="mt-1 text-sm font-normal leading-relaxed text-liaInk-muted">
                  {c.lineName ?? "LINE名未設定"}
                </div>
                <div className="mt-1 text-xs font-medium tracking-[0.06em] text-liaInk-muted">
                  来店: {c.lastVisitDate ? formatDate(c.lastVisitDate) : "—"}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-liaInk-muted">→</span>
            </div>

            {c.relationshipMemo ? (
              <p className="mt-3 line-clamp-2 text-sm font-normal leading-[1.75] tracking-[0.02em] text-liaInk">
                {c.relationshipMemo}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {c.tags.map((t) => (
                <span key={t} className="lia-pill text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
