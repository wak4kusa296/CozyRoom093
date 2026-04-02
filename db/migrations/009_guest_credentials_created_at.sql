-- アカウント（台帳登録）時刻。これより前の記事通知・プッシュをそのユーザーに紐づけない。
ALTER TABLE guest_credentials ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
UPDATE guest_credentials SET created_at = updated_at WHERE created_at IS NULL;
ALTER TABLE guest_credentials ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE guest_credentials ALTER COLUMN created_at SET NOT NULL;
