import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { listBroadcastPushes } from "@/lib/broadcast-pushes";
import { listGuestCredentials } from "@/lib/guest-credentials";
import { countPushSubscriptions } from "@/lib/push-subscriptions";
import { getVapidConfig } from "@/lib/web-push-config";
import { PushBroadcastForm } from "./push-broadcast-form";
import { PushHistory } from "./push-history";

export default async function AdminPushPage() {
  await requireAdminSession();
  const [guestRows, pushes, vapidOk, subscriptionCount] = await Promise.all([
    listGuestCredentials(),
    listBroadcastPushes(),
    Promise.resolve(Boolean(getVapidConfig())),
    countPushSubscriptions()
  ]);
  const guests = guestRows.map((g) => ({ guestId: g.guestId, guestName: g.guestName }));

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>プッシュ通知</h1>
          <p className="lead">
            右側のシミュレーションで、ルーム通知とスマホ通知バー風の見え方を確認できます。
          </p>
        </div>
        <AdminNav />

        {!vapidOk ? (
          <p className="meta admin-push-page-status" role="status">
            Web Push 用の VAPID 鍵が未設定です。環境変数{" "}
            <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> と <code>VAPID_PRIVATE_KEY</code> を設定し、再デプロイしてください（
            <code>npx web-push generate-vapid-keys</code> で生成）。
          </p>
        ) : subscriptionCount === 0 ? (
          <p className="meta admin-push-page-status" role="status">
            ブラウザ通知の購読がまだ 0 件です。ゲストがルームで「通知を許可する」を押すと、端末がここに紐づきます。
          </p>
        ) : (
          <p className="meta admin-push-page-status" role="status">
            ブラウザ通知の購読: {subscriptionCount} 端末
          </p>
        )}

        <PushBroadcastForm guests={guests} />
        <PushHistory pushes={pushes} />
      </section>
    </main>
  );
}
