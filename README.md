# 誰も知らない部屋

## セットアップ
1. `npm install`
2. `.env.example` を `.env.local` にコピーして値を設定
3. `npm run dev`

## 開発環境を本番DBのコピーに接続する（Neon ブランチ）

本番データで動作確認したいときは、本番DBに直接つながず Neon のブランチ（本番のコピー）を作ってそこに接続します。

1. Neon Console → 対象プロジェクト → **Branches** → **New branch**
   - Parent: 本番ブランチ（`production` など）
   - Include data up to: **Now**（作成時点の本番データがコピーされる）
   - 名前: `dev-<自分の名前>`
2. 作成したブランチの **Connection Details** から接続文字列をコピーし、`.env.local` の `DATABASE_URL` に貼る（末尾の `?sslmode=require` は必須）
3. `npm run db:check` で接続先ホストとテーブル行数を確認する（host にブランチ名が入っていること、本番でないことを必ず確認）
4. `npm run dev`

補足:
- ブランチはコピーオンライトなので作成は一瞬で、書き込んでも本番には影響しません。
- 本番のスキーマが更新されたら、ブランチを作り直すか `npm run db:migrate` を実行します。
- データが古くなったらブランチを削除して作り直すのが最も簡単です。
- `.env.local` の `GUEST_PASSPHRASES` は空にしておきます。値を入れると `/admin/ledger` を開いたときに env のゲストがDBへ書き込まれ、コピーしたデータに混ざります。

## ローカルDB（PostgreSQL）実験手順

本番データが不要な場合は Docker のローカルDBを使います（Docker Desktop の起動が必要）。

1. `npm run db:up`
2. `.env.local` の `DATABASE_URL` を `postgres://nobody:nobody_local_password@localhost:5433/nobody_room` にする
3. `npm run db:migrate`
4. `npm run test:db`

補足:
- DBを停止するときは `npm run db:down`
- DBログ確認は `npm run db:logs`
- マイグレーションSQLは `db/migrations` 配下に追加します

## 現在の実装範囲
- 合言葉による入室 (`/`)
- 新規登録 (`/join` … 手書きのパスワード＋自己登録。メアドは控え送付のみで非保存)
- コンテンツ一覧 (`/room`)
- Markdown記事表示 (`/room/[slug]`)
- 記事ごとの往復書簡（ゲスト単位）
- 合言葉復元リクエスト保存
- 管理者確認口 (`/admin`)
- PWA土台 (`public/manifest.json`, `public/sw.js`)

## 備考
- `GUEST_PASSPHRASES` は `name:phrase` をカンマ区切りで設定します。
- 管理画面の「ユーザー管理」では、ユーザー追加・合言葉変更・有効/無効の切替に加え、`/join` 用の手書きのパスワードを管理できます。
- 往復書簡と復元リクエストは `data/` に JSON 保存されます（初期実装）。
- 本番運用時は Supabase/PlanetScale 等に移行してください。
