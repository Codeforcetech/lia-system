import Link from "next/link";
import { CustomerForm } from "@/app/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <main className="space-y-6 sm:space-y-7">
      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="lia-heading text-lg tracking-[0.04em]">
              新しいお客様
            </h1>
            <p className="lia-prose-soft">必須はお名前だけ。あとからいつでも足せます。</p>
          </div>
          <Link href="/customers" className="lia-btn-ghost shrink-0 text-xs">
            一覧
          </Link>
        </div>
      </section>

      <section className="lia-card px-5 py-6 sm:px-6 sm:py-7">
        <CustomerForm mode="create" />
      </section>
    </main>
  );
}
