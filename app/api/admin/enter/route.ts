import { NextResponse } from "next/server";
import { adminStub, authenticateAdmin, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { secret?: string };
  const ok = authenticateAdmin(body.secret ?? "");

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await createSession(adminStub, "admin");
  return NextResponse.json({ ok: true });
}
