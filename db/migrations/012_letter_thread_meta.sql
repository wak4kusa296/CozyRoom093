CREATE TABLE IF NOT EXISTS letter_thread_meta (
  slug TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (slug, guest_id)
);

CREATE INDEX IF NOT EXISTS letter_thread_meta_guest_idx
  ON letter_thread_meta (guest_id);

-- 既存のお手紙スレッドは従来どおり「お手紙」を初期件名にする
INSERT INTO letter_thread_meta (slug, guest_id, title)
SELECT DISTINCT slug, guest_id, 'お手紙'
FROM letters
WHERE slug = '__fan'
ON CONFLICT (slug, guest_id) DO NOTHING;
