import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { getLetters } from "@/lib/letters";
import { normalizeSlugParam } from "@/lib/content";
import { letterMutationErrorPayload, postLetterMutation } from "@/lib/letters-mutations";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "ログインが必要です。" } }, { status: 401 });

  const guestFromQuery = new URL(request.url).searchParams.get("guest") ?? "";
  const targetGuestId = session.role === "admin" && guestFromQuery ? guestFromQuery : session.guestId;
  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  const letters = await getLetters(normalizedSlug, targetGuestId);
  return NextResponse.json({ ok: true, letters });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "ログインが必要です。" } }, { status: 401 });

  let body: { body?: string };
  try {
    body = (await request.json()) as { body?: string };
  } catch {
    return NextResponse.json({ ok: false, error: { code: "invalid_json", message: "送信内容を読み取れませんでした。" } }, { status: 400 });
  }

  const guestFromQuery = new URL(request.url).searchParams.get("guest") ?? "";
  const targetGuestId = session.role === "admin" && guestFromQuery ? guestFromQuery : session.guestId;
  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  try {
    const result = await postLetterMutation({
      actor: { role: session.role, guestId: session.guestId, guestName: session.guestName },
      targetGuestId,
      slug: normalizedSlug,
      body: body.body ?? ""
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const response = letterMutationErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
