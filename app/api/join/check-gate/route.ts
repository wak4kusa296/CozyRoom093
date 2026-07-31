import { NextResponse } from "next/server";
import {
  HANDWRITTEN_PASSWORD_INVALID_MESSAGE,
  isValidHandwrittenPassword
} from "@/lib/passphrase-rules";
import { findActiveRegistrationGateByPhrase } from "@/lib/registration-gates";

export async function POST(request: Request) {
  const body = (await request.json()) as { gatePhrase?: string };
  const gatePhrase = String(body.gatePhrase ?? "").trim();

  if (!gatePhrase) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  if (!isValidHandwrittenPassword(gatePhrase)) {
    return NextResponse.json(
      { ok: false, error: "invalid_gate_format", message: HANDWRITTEN_PASSWORD_INVALID_MESSAGE },
      { status: 400 }
    );
  }

  const gate = await findActiveRegistrationGateByPhrase(gatePhrase);
  if (!gate) {
    return NextResponse.json(
      { ok: false, error: "invalid_gate", message: "手書きのパスワードが違うか、無効になっています。" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
