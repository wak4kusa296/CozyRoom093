import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { normalizeSlugParam } from "@/lib/content";
import { getHeartStateForGuest, pressHeart } from "@/lib/hearts";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  const state = await getHeartStateForGuest(normalizedSlug, session.guestId);

  return NextResponse.json({
    ok: true,
    pressedByGuest: state.pressedByGuest,
    remaining: state.remaining,
    limit: state.limit,
    locked: state.locked
  });
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  const result = await pressHeart(normalizedSlug, session.guestId);

  return NextResponse.json({
    ok: true,
    accepted: result.accepted,
    reachedLimit: !result.accepted,
    remaining: result.remaining,
    pressedByGuest: result.pressedByGuest
  });
}
