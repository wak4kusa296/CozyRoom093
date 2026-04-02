import { NextResponse } from "next/server";
import { appendRecoveryRequest } from "@/lib/recovery-requests";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";

function isValidEmail(value: string) {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { hintName?: string; hintPlace?: string; contactEmail?: string };

  if (!body.hintName?.trim() || !body.hintPlace?.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.contactEmail?.trim() || !isValidEmail(body.contactEmail)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await appendRecoveryRequest(body.hintName, body.hintPlace, body.contactEmail);
  pingAdminNotificationSubscribers();

  return NextResponse.json({ ok: true });
}
