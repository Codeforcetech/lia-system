# Lia（ローカルMVP）

夜職向けAI営業LINE支援CRMのローカルMVPです（認証なし / `demo@lia.local` 固定）。

## 1. Liaとは

顧客登録 → 接客メモ → 来店履歴 → AIでLINE文面生成 → コピーして送信、までを**最短で触れる**MVPです。  
（LINE API連携や自動送信は行いません）

## 2. MVPでできること

- 顧客の登録 / 一覧 / 詳細 / 編集
- 接客メモの追加
- 来店履歴の追加（最終来店日の更新）
- 目的・文体を指定してAIでLINE文面を3案生成
- 生成文面をコピー（コピー済み表示 / 履歴表示）
- 採用学習用に「この文章を使う」→ 編集して採用（AI原文と差分をDBに保存）
- **Feedback Analytics**（`/analytics/feedback`）：採用件数・編集傾向・文体のルールベース要約・最近の採用ログを表示（自動学習は未実装）
- **Persona Builder**（同上ページ内）：`GeneratedMessageFeedback` から営業人格タグ・コミュニケーション傾向・診断風サマリーを表示
- **Adaptive Prompt Engine**（Phase 2–8）：採用フィードバックが1件以上ある場合、Persona から導いた `directives` を LINE 生成プロンプト（`generation.adaptivePersona`）へ反映。短文・改行・絵文字・押しの弱さ・雑談入りなどをルールベースで適用
- **Persona Effect Analytics**（Phase 2–9）：採用データから「Persona 適用生成だったか」を集計し、編集率・平均編集距離の差・効きやすいタグ候補を `/analytics/feedback` に表示（自動最適化は未実装）
- ホームで「今日連絡すると良さそうなお客様」をカテゴリ別に表示（ルールベース）
- **月間売上カード**（ホーム上部）：来店履歴の `Visit.amount` を **日本時間の当月1日〜末日** で合計し、目標に対する達成率をリング表示
- **売上目標設定**（`/settings/sales-target`）：`UserSetting.monthlySalesTarget` を保存（0以上の整数）
- **出勤予定カレンダー**（`/work-schedules`）：出勤日の登録・編集・削除。ホームの「次回出勤予定」に反映

## 3. 技術構成

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- OpenAI API（未設定でもダミーで動作）

## 4. セットアップ手順

### 4.1 .env の設定

```bash
cp .env.example .env
```

## 5. DB起動（Docker推奨）

```bash
docker compose up -d
```

## 6. Prisma migrate / seed

初回・DBを空にした直後:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

既に `init` マイグレーション済みで、**売上目標・出勤予定**のテーブルを追加する場合:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

`UserSetting` / `WorkSchedule` が含まれるマイグレーション（例: `20260510120000_add_user_setting_work_schedule`）が適用されます。

**AI採用学習（Phase 2–5 基盤）** の `GeneratedMessageFeedback` を追加する場合:

```bash
npx prisma generate
npx prisma migrate dev
```

マイグレーション例: `20260510123436_add_generated_message_feedback`

- 生成画面で「この文章を使う」→ 編集して「採用する」と、AI原文・採用文・編集有無・簡易 edit 距離などが保存されます（自動学習ロジックは未実装）。
- Core / Persona 学習は将来フェーズで、このテーブルを起点にします。

**Persona Effect（Phase 2–9）** のフィールド追加（`adaptivePersonaApplied` ほか）:

```bash
npx prisma generate
npx prisma migrate dev
```

マイグレーション例: `20260512073156_add_persona_effect_fields`

- 採用保存時に、当該 `GeneratedMessage.inputContext` 内の **`adaptivePersona` スナップショット**（適用有無・タグ・tone・directive 数）を `GeneratedMessageFeedback` にコピーします。
- `/analytics/feedback` の **Persona Effect** で、適用あり/なしの編集率・平均編集距離を比較表示します。

### seed について（売上・出勤）

- `UserSetting`: デモユーザーの `monthlySalesTarget` に **500000** を入れます（upsert）。
- `WorkSchedule`: **過去1件・未来2件** 程度の出勤予定を作成します。
- **今月分の売上集計デモ**用に、`Visit` を当月内の日付で追加します（既存の Airi などの顧客データと整合）。

## 7. ローカル起動

```bash
npm run dev
```

デフォルト: `http://127.0.0.1:3002`（`package.json` の `next dev -p 3002` に準拠）

## 8. デモ確認手順（初見向け）

seed にサンプル顧客（5〜8名）、メモ、来店履歴が入ります。

### おすすめデモルート（迷ったらこれ）

1. ホーム（`/`）を開く
2. 「AI生成を試す」を押す
3. 送信目的：**来店後のお礼**
4. 文体：**自然**
5. 生成された3案を確認
6. 案1をコピー（任意で「この文章を使う」→ 微修正して「採用する」と学習用に保存）
7. 顧客詳細に戻って、生成履歴と「コピー済み」を確認

### 実ユーザー確認用チェックリスト

`docs/user-checklist.md` に、実際に使ってもらう際の確認項目をまとめています。  
デモ後のヒアリングでは、以下を確認してください。

- LINE文面の自然さ
- 営業感
- 毎日使うか
- 面倒な操作
- 欲しい機能
- 価格感

### シナリオ0：ホームの月間売上・次回出勤

1. `/` を開く
2. 上部の **次回出勤予定** / **今月売上**（達成率リング）が表示されることを確認
3. 「目標を編集」→ `/settings/sales-target` で目標を保存し、ホームに戻って数値が変わることを確認
4. 「出勤予定を見る」→ `/work-schedules` で予定を追加・編集・削除し、ホームの次回出勤が更新されることを確認

### シナリオ1：ホームで今日連絡すべき顧客を見る

1. `/` を開く
2. 「今日の営業TODO」にカテゴリ別で顧客が出ることを確認
3. 各カードの説明で、なぜ出ているか確認

### シナリオ2：顧客詳細で過去メモ・来店履歴を見る

1. ホーム or `/customers` から任意の顧客を開く
2. 接客メモ / 来店履歴が入っていることを確認

### シナリオ3：AI LINE生成で「久しぶり連絡」「自然」トーンを選ぶ

1. 顧客詳細で「AI LINE生成」を押す
2. 送信目的: 「久しぶり連絡」、文体: 「自然」を選ぶ
3. 「AIで3案生成」を押す

### シナリオ4：案1をコピーする

1. 生成結果の「案1」で「コピー」を押す

### シナリオ5：顧客詳細に戻って生成履歴とコピー済み表示を確認する

1. 顧客詳細に戻る
2. 「過去に生成したLINE」で、履歴が追加されていることを確認
3. 「コピー済み」になり、コピー日時が入ることを確認

## 9. OpenAI APIキー未設定時の挙動

`OPENAI_API_KEY` が未設定（空）の場合、AI生成は **ダミーの3案**を返します（フォーマットは `案1:` 〜 `案3:`）。  
画面は壊れません。

## 9.1 copiedAt 更新（Turbopack対策）

開発環境（Turbopack）では **Client ComponentからServer Actionを直接import**すると、境界の解決が不安定になり画面が500になることがありました。  
そのためコピー時の `copiedAt` 更新は **Route Handler経由**にしています。

- **API**: `PATCH /api/generated-messages/[id]/copied`
- **挙動**: クリップボードへのコピーは常に成功扱い。APIが失敗しても「コピーしました」は表示します。

## 10. 本番DB向け migrate（Vercel / リモート PostgreSQL）

ローカル開発では `prisma migrate dev` を使います。**本番・デモ用 DB** では `migrate dev` ではなく **`migrate deploy`** を使ってください。

```bash
# 本番 DATABASE_URL を .env またはシェルに設定したうえで（値はリポジトリに含めない）
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

- `migrate deploy`: リポジトリ内の `prisma/migrations` を未適用分だけ適用（本番向け）
- `db seed`: デモ用サンプル顧客・メモ・来店など（`demo@lia.local` 固定ユーザー）

Vercel の **Prisma Postgres** を使う場合、ダッシュボードの **Storage → Connect** から `DATABASE_URL` をコピーし、Environment Variables に設定します。マイグレーションで接続エラーになる場合は、Storage が提供する **直接接続用 URL**（非プール）を一時的に `DATABASE_URL` にして `migrate deploy` する方法もあります（プロバイダのドキュメントに従ってください）。

## 11. Vercelデプロイ手順

1. **GitHub に push**（`.env` は含めない。`.env.example` のみ）
2. [Vercel](https://vercel.com) で **New Project**
3. GitHub リポジトリ `Codeforcetech/lia-system`（または自分の fork）を **Import**
4. **Framework Preset**: Next.js（自動検出）
5. **Storage** で **Prisma Postgres**（または Vercel Postgres）を追加し、プロジェクトに接続
6. **Environment Variables** に以下を設定（値は Vercel / OpenAI の画面から取得。README に値は書かない）
   - `DATABASE_URL` … Prisma / Storage の接続文字列
   - `OPENAI_API_KEY` … OpenAI Platform（任意。未設定でもデモはダミー文面で動作）
7. **Deploy**（Build Command は `npm run build` のまま。`prisma generate && next build` が実行される）
8. デプロイ成功後、**手元の PC** で本番 `DATABASE_URL` を向けて **§10** の `migrate deploy` と `db seed` を実行
9. 下記 URL で動作確認

### 動作確認URL（`https://<your-project>.vercel.app` を前置）

| パス | 内容 |
|------|------|
| `/` | ホーム・今日のTODO・売上 |
| `/customers` | 顧客一覧 |
| `/customers/demo_cust_airi/generate` | AI LINE 生成（Airi） |
| `/work-schedules` | 出勤予定 |
| `/settings/sales-target` | 売上目標 |
| `/analytics/feedback` | 学習の見える化 |
| `/demo` | デモ説明 |

### Vercel に設定する環境変数（一覧）

| 変数名 | 必須 | 用途 | 取得元 |
|--------|------|------|--------|
| `DATABASE_URL` | はい | Prisma → PostgreSQL | Vercel Storage（Prisma Postgres） / 自前 Postgres |
| `OPENAI_API_KEY` | いいえ | AI LINE 生成・会話テーマ・意図分類・営業提案など | [OpenAI Platform](https://platform.openai.com/) |

`NODE_ENV` は Vercel が自動で `production` にします（手動設定不要）。

## 12. 今後追加予定の機能

- 生成履歴の検索/フィルタ、ピン留め、削除
- 案ごとのコピー記録（`copiedAt` を案単位で持つ）
- Zodでの入力バリデーション強化
- 認証（ユーザー切り替え）

