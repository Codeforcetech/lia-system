import Link from "next/link";
import { getCustomer } from "@/app/actions/customer";
import { CustomerForm } from "@/app/customers/CustomerForm";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer = null;
  let error: string | null = null;

  try {
    customer = await getCustomer(id);
    if (!customer) error = "顧客が見つかりません。";
  } catch (e) {
    error =
      e instanceof Error
        ? `DBに接続できません: ${e.message}`
        : "DBに接続できません。";
  }

  if (!customer || error) {
    return (
      <main className="space-y-4">
        <div className="lia-card-inner border-red-200/70 bg-red-50/60 px-4 py-4 text-sm font-medium text-red-800">
          {error ?? "読み込みに失敗しました。"}
          <div className="mt-3">
            <Link href={`/customers/${id}`} className="lia-btn-secondary">
              詳細へ戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="lia-heading text-lg tracking-[0.04em]">プロフィール編集</h1>
            <p className="lia-prose-soft">気づいたことを、ゆっくり更新していってください。</p>
          </div>
          <Link href={`/customers/${customer.id}`} className="lia-btn-ghost shrink-0 text-xs">
            詳細
          </Link>
        </div>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <CustomerForm mode="edit" customer={customer} />
      </section>
    </main>
  );
}
