-- 各ゲストに紐づく管理人専用メモ（ゲスト画面には出さない）
ALTER TABLE guest_credentials
  ADD COLUMN IF NOT EXISTS admin_memo TEXT NOT NULL DEFAULT '';
