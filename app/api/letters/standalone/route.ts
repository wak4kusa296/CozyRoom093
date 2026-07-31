import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { parseJsonBody } from "@/lib/http-json";
import { createStandaloneLetterMutation, letterMutationErrorPayload } from "@/lib/letters-mutations";

export async function POST(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "ログインが必要です。" } },
      { status: 401 }
    );
  }

  const parsed = await parseJsonBody<{ title?: string; body?: string; guestId?: string }>(request);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "送信内容を読み取れませんでした。" } },
      { status: 400 }
    );
  }

  const guestFromBody = (parsed.guestId ?? "").trim();
  const targetGuestId = session.role === "admin" && guestFromBody ? guestFromBody : session.guestId;

  try {
    const created = await createStandaloneLetterMutation({
      actor: { role: session.role, guestId: session.guestId, guestName: session.guestName },
      targetGuestId,
      title: parsed.title ?? "",
      body: parsed.body ?? ""
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const response = letterMutationErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
