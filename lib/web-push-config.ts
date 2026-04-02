/**
 * Web Push（VAPID）。未設定のときはブラウザ通知送信をスキップする。
 * 鍵の生成: `npx web-push generate-vapid-keys`
 */

export function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}
