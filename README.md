# 誰も知らない部屋

## セットアップ
1. `npm install`
2. `.env.example` を `.env.local` にコピーして値を設定
3. `npm run db:migrate`
4. `npm run dev`

## コンテンツとアップロードの保存先

記事 Markdown、サムネイル、プッシュ通知画像は PostgreSQL が唯一の実行時保存先です。`content/` と `public/thumbnails/`、`public/uploads/push/` はローカル開発用の初期データ・移行元としてのみ扱い、本番のデータ源にはしません。

既存の `content/*.md` を初回移行するには、マイグレーション後に実行します。

```sh
npm run db:import-content
```

同名 slug を明示的に上書きする場合だけ `npm run db:import-content -- --replace` を使います。ローカルでファイルを検証・編集する一時用途には `CONTENT_STORE=filesystem` を設定できますが、本番環境では拒否されます。

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
- `GUEST_PASSPHRASES` は `guestId:表示名:秘密の言葉` をカンマ区切りで設定します。後方互換として `表示名:秘密の言葉` も使えます。
- migration 014 は既存のゲスト・ゲート資格情報を削除します。適用後は `GUEST_PASSPHRASES` を設定して `npm run db:sync-guests` を実行するか、管理画面で再発行してください。
- `CREDENTIAL_LOOKUP_PEPPER` は索引付き資格情報検索用の16文字以上の秘密鍵です。未設定時は `SESSION_SECRET` から安全に派生します。
- 管理画面の「ユーザー管理」では、ユーザー追加・合言葉変更・有効/無効の切替に加え、`/join` 用の手書きのパスワードを管理できます。
- アプリケーションの永続データは PostgreSQL に保存します。
- `ADMIN_SESSION_SECRET` を設定すると管理者セッションを専用鍵で署名します。この値をローテーションすると既存の管理者セッションだけを無効化できます。未設定時は後方互換のため `SESSION_SECRET` を使用します。

## TODO: 複数インスタンス時の共有レート制限
現在のレート制限はプロセス内メモリを使うため、単一インスタンスでは有効ですが、水平スケール時はインスタンス間で共有されません。追加の有料サービスは導入していません。複数インスタンスへ移行する前に、既存 PostgreSQL を使う共有カウンタ（TTL・原子的更新・定期削除を含む）または運用環境の共有レート制限機能を導入してください。
