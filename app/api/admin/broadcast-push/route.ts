import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appendBroadcastPush } from "@/lib/broadcast-pushes";
import type { GuestCredential } from "@/lib/guest-credentials";
import { listGuestCredentials } from "@/lib/guest-credentials";
import { pingAllRoomNotificationSubscribers, pingRoomNotificationSubscribers } from "@/lib/notification-push";
import { sendWebPushForBroadcast, type WebPushBroadcastResult } from "@/lib/web-push-broadcast";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    audience?: string;
    guestIds?: unknown;
    lead?: string;
    linkUrl?: string;
    linkLabel?: string;
    imageUrl?: string;
  };

  const title = String(body.title ?? "");
  const text = String(body.body ?? "");
  const audience = body.audience === "selected" ? "selected" : "all";
  const guestIdsRaw = body.guestIds;
  const guestIds = Array.isArray(guestIdsRaw)
    ? guestIdsRaw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];

  try {
    const valid = new Set((await listGuestCredentials()).map((g: GuestCredential) => g.guestId));
    if (audience === "selected") {
      for (const id of guestIds) {
        if (!valid.has(id)) {
          return NextResponse.json({ ok: false, error: "unknown_guest" }, { status: 400 });
        }
      }
    }

    const row = await appendBroadcastPush({
      title,
      body: text,
      audience,
      guestIds: audience === "selected" ? guestIds : [],
      lead: String(body.lead ?? ""),
      linkUrl: body.linkUrl,
      linkLabel: body.linkLabel,
      imageUrl: body.imageUrl
    });

    if (row.audience === "all") {
      pingAllRoomNotificationSubscribers();
    } else {
      pingRoomNotificationSubscribers(row.guestIds);
    }

    let webPush: WebPushBroadcastResult;
    try {
      webPush = await sendWebPushForBroadcast(row);
    } catch (e) {
      console.error("[broadcast-push] web push error", e);
      webPush = {
        skippedReason: null,
        targetCount: 0,
        sentCount: 0,
        failureCount: 0
      };
    }

    return NextResponse.json({ ok: true, id: row.id, sentAt: row.sentAt, webPush });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "title_and_body_required") {
        return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
      }
      if (e.message === "guests_required") {
        return NextResponse.json({ ok: false, error: "guests_required" }, { status: 400 });
      }
      if (e.message === "lead_required") {
        return NextResponse.json({ ok: false, error: "lead_required" }, { status: 400 });
      }
    }
    throw e;
  }
}
