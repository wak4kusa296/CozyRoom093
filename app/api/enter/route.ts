import { NextResponse } from "next/server";
import { authenticateGuest, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { phrase?: string };
  const phrase = body.phrase?.trim() ?? "";

  const guest = await authenticateGuest(phrase);
  if (!guest) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await createSession(guest, "guest");
  return NextResponse.json({ ok: true });
}
