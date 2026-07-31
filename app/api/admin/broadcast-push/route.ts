import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appendBroadcastPush, isValidOptionalUrl } from "@/lib/broadcast-pushes";
import type { GuestCredential } from "@/lib/guest-credentials";
import { listGuestCredentials } from "@/lib/guest-credentials";
import { pingAllRoomNotificationSubscribers, pingRoomNotificationSubscribers } from "@/lib/notification-push";
import { sendWebPushForBroadcast, type WebPushBroadcastResult } from "@/lib/web-push-broadcast";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http-json";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return jsonError("forbidden", "管理者権限が必要です。", { status: 403 });
  }

  const body = await parseJsonBody<{
    title?: string;
    body?: string;
    audience?: string;
    guestIds?: unknown;
    lead?: string;
    linkUrl?: string;
    linkLabel?: string;
    imageUrl?: string;
  }>(request);
  if (!body) return jsonError("invalid_json", "送信内容を読み取れませんでした。", { status: 400 });

  const title = String(body.title ?? "");
  const text = String(body.body ?? "");
  const audience = body.audience === "selected" ? "selected" : "all";
  const guestIdsRaw = body.guestIds;
  const guestIds = Array.isArray(guestIdsRaw)
    ? guestIdsRaw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
    : [];
  if (!isValidOptionalUrl(body.linkUrl)) {
    return jsonError("invalid_link_url", "リンク URL はサイト内パスまたは http(s) URL にしてください。", {
      status: 400
    });
  }

  try {
    const valid = new Set((await listGuestCredentials()).map((g: GuestCredential) => g.guestId));
    if (audience === "selected") {
      for (const id of guestIds) {
        if (!valid.has(id)) {
          return jsonError("unknown_guest", "宛先が無効です。再読み込みしてください。", { status: 400 });
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

    return jsonOk({ id: row.id, sentAt: row.sentAt, webPush });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "title_and_body_required") {
        return jsonError("invalid_body", "タイトルと本文が必要です。", { status: 400 });
      }
      if (e.message === "guests_required") {
        return jsonError("guests_required", "宛先を1人以上選んでください。", { status: 400 });
      }
      if (e.message === "lead_required") {
        return jsonError("lead_required", "リード文が必要です。", { status: 400 });
      }
    }
    throw e;
  }
}
