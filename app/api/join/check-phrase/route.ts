import { NextResponse } from "next/server";
import { isActivePhraseTaken } from "@/lib/guest-credentials";
import {
  isValidSecretPhrase,
  SECRET_PHRASE_WHITESPACE_MESSAGE,
  secretPhraseContainsWhitespace
} from "@/lib/passphrase-rules";
import { PHRASE_TAKEN_MESSAGE } from "@/lib/signup-email-template";

export async function POST(request: Request) {
  const body = (await request.json()) as { phrase?: string };
  const phrase = String(body.phrase ?? "");

  if (!phrase) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  if (secretPhraseContainsWhitespace(phrase) || !isValidSecretPhrase(phrase)) {
    return NextResponse.json({
      ok: true,
      available: false,
      message: SECRET_PHRASE_WHITESPACE_MESSAGE
    });
  }

  const taken = await isActivePhraseTaken(phrase);
  if (taken) {
    return NextResponse.json({
      ok: true,
      available: false,
      message: PHRASE_TAKEN_MESSAGE
    });
  }

  return NextResponse.json({ ok: true, available: true });
}
