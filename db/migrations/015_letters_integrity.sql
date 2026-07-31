-- 013 の role 移行後に、文通データそのものにもサイズ制約を適用する。
-- notification_id は letters.id 由来の `letter|<id>` / `adminLetter|<id>` を継続して使う。

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'letters_body_max_length_check'
  ) THEN
    ALTER TABLE letters
      ADD CONSTRAINT letters_body_max_length_check
      CHECK (char_length(body) BETWEEN 1 AND 4000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'letter_thread_meta_title_max_length_check'
  ) THEN
    ALTER TABLE letter_thread_meta
      ADD CONSTRAINT letter_thread_meta_title_max_length_check
      CHECK (char_length(title) BETWEEN 1 AND 40);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS letters_guest_role_created_idx
  ON letters (guest_id, sender_role, created_at DESC);
