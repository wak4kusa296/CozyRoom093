import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { toPublicAbsoluteHref } from "@/lib/public-url";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(new URL(toPublicAbsoluteHref("/"), "http://localhost:3000"));
}
