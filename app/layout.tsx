import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lia",
  description: "夜職向けAI営業LINE支援CRM（ローカルMVP）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <div className="mx-auto min-h-screen max-w-lg px-4 pb-32 sm:max-w-xl sm:pb-28">
          <header className="sticky top-0 z-10 -mx-4 mb-6 border-b border-lia-200 bg-white px-4 py-4 sm:mb-7">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="text-lg font-medium tracking-[0.04em] text-liaInk-heading transition hover:text-lia-600"
              >
                Lia
              </Link>
              <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
                <Link href="/" className="lia-btn-ghost">
                  ホーム
                </Link>
                <Link href="/customers" className="lia-btn-ghost">
                  顧客
                </Link>
                <Link href="/analytics/feedback" className="lia-btn-ghost">
                  学習
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
        <footer className="fixed bottom-0 left-0 right-0 border-t border-lia-200 bg-white">
          <div className="mx-auto flex max-w-lg items-center justify-around gap-2 px-3 py-4 text-sm sm:max-w-xl">
            <Link href="/" className="lia-btn-ghost min-w-[3.5rem] py-2.5 text-liaInk-muted">
              今日
            </Link>
            <Link
              href="/customers/new"
              className="lia-btn-accent min-w-[7rem] rounded-full px-4 py-3.5 text-xs font-medium sm:text-sm"
            >
              顧客追加
            </Link>
            <Link href="/customers" className="lia-btn-ghost min-w-[3.5rem] py-2.5 text-liaInk-muted">
              一覧
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
