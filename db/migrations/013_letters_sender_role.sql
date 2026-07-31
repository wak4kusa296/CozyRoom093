-- 文通の差出人を role で保持し、名前文字列(「管理者」/"admin")による判定を廃止する。
-- 併せて slug / guest_id を正規形(英数字・ハイフン・アンダースコアのみ)に一本化し、
-- 通知IDを letters.id 基準へ切り替えるため既読状態をリセットする(プレリリース前提)。

ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT 'guest'
  CHECK (sender_role IN ('admin', 'guest'));

-- 既存行のバックフィル(移行時に一度きりの名前ベース判定)
UPDATE letters
SET sender_role = 'admin'
WHERE LOWER(TRIM(sender)) IN ('管理者', 'admin');

-- キー正規化: letters
UPDATE letters
SET
  slug = regexp_replace(slug, '[^a-zA-Z0-9_-]', '-', 'g'),
  guest_id = regexp_replace(guest_id, '[^a-zA-Z0-9_-]', '-', 'g')
WHERE slug ~ '[^a-zA-Z0-9_-]' OR guest_id ~ '[^a-zA-Z0-9_-]';

-- キー正規化: letter_thread_meta(正規化で PK 衝突する行は古い方を残して削除)
DELETE FROM letter_thread_meta a
USING letter_thread_meta b
WHERE a.ctid <> b.ctid
  AND regexp_replace(a.slug, '[^a-zA-Z0-9_-]', '-', 'g') = regexp_replace(b.slug, '[^a-zA-Z0-9_-]', '-', 'g')
  AND regexp_replace(a.guest_id, '[^a-zA-Z0-9_-]', '-', 'g') = regexp_replace(b.guest_id, '[^a-zA-Z0-9_-]', '-', 'g')
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.ctid > b.ctid));

UPDATE letter_thread_meta
SET
  slug = regexp_replace(slug, '[^a-zA-Z0-9_-]', '-', 'g'),
  guest_id = regexp_replace(guest_id, '[^a-zA-Z0-9_-]', '-', 'g')
WHERE slug ~ '[^a-zA-Z0-9_-]' OR guest_id ~ '[^a-zA-Z0-9_-]';

-- 通知IDが letters.id 基準に変わるため、旧形式の既読レコードをリセット
TRUNCATE letter_notification_reads;
DELETE FROM guest_notification_reads WHERE notification_id LIKE 'adminLetter|%';

-- guest_id 起点の参照(ゲストの通知列挙)用インデックス
CREATE INDEX IF NOT EXISTS letters_guest_created_idx
  ON letters (guest_id, created_at);
