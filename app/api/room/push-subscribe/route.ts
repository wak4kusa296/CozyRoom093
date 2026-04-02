import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import {
  removeGuestPushSubscription,
  upsertGuestPushSubscription,
  type PushSubscriptionJSON
} from "@/lib/push-subscriptions";
import { getVapidConfig } from "@/lib/web-push-config";

export async function GET() {
  const cfg = getVapidConfig();
  return NextResponse.json({
    ok: true,
    vapidPublicKey: cfg?.publicKey ?? null
  });
}

export async function POST(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!getVapidConfig()) {
    return NextResponse.json({ ok: false, error: "vapid_not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as PushSubscriptionJSON;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400 });
  }

  await upsertGuestPushSubscription(session.guestId, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as { endpoint?: string };
  const endpoint = String(body?.endpoint ?? "").trim();
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "endpoint_required" }, { status: 400 });
  }

  await removeGuestPushSubscription(session.guestId, endpoint);
  return NextResponse.json({ ok: true });
}
