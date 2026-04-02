# 誰も知らない部屋

## セットアップ
1. `npm install`
2. `.env.example` を `.env.local` にコピーして値を設定
3. `npm run dev`

## ローカルDB（PostgreSQL）実験手順
1. `npm run db:up`
2. `.env.local` の `DATABASE_URL` を確認
3. `npm run db:migrate`
4. `npm run test:db`

補足:
- DBを停止するときは `npm run db:down`
- DBログ確認は `npm run db:logs`
- マイグレーションSQLは `db/migrations` 配下に追加します

## 現在の実装範囲
- 合言葉による入室 (`/`)
- コンテンツ一覧 (`/room`)
- Markdown記事表示 (`/room/[slug]`)
- 記事ごとの往復書簡（ゲスト単位）
- 合言葉復元リクエスト保存
- 管理者確認口 (`/admin`)
- PWA土台 (`public/manifest.json`, `public/sw.js`)

## 備考
- `GUEST_PASSPHRASES` は `name:phrase` をカンマ区切りで設定します。
- 管理画面の「ユーザー管理」では、ユーザー追加・合言葉変更・有効/無効の切替ができます（DBへ自動同期）。
- 往復書簡と復元リクエストは `data/` に JSON 保存されます（初期実装）。
- 本番運用時は Supabase/PlanetScale 等に移行してください。
