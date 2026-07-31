import {
  appendLetter,
  countRecentLettersFromGuest,
  createStandaloneLetterThread,
  guestLetterOpenUrl,
  markGuestLetterNotificationsReadForThread
} from "@/lib/letters";
import {
  ADMIN_DISPLAY_NAME,
  LETTER_BODY_MAX_LENGTH,
  LETTER_TITLE_MAX_LENGTH,
  letterNewThreadPushBody,
  normalizeLetterTitle,
  type Letter
} from "@/lib/letters-shared";
import { pingAdminNotificationSubscribers, pingRoomNotificationSubscriber } from "@/lib/notification-push";
import { sendWebPushGuestLetterToAdmins } from "@/lib/web-push-guest-letter-to-admin";
import { sendWebPushToGuestIds } from "@/lib/web-push-deliver";

export type LetterMutationActor = {
  role: "admin" | "guest";
  guestId: string;
  guestName: string;
};

export type LetterMutationFailureCode =
  | "body_required"
  | "body_too_long"
  | "title_required"
  | "title_too_long"
  | "rate_limited";

const ERROR_MESSAGES: Record<LetterMutationFailureCode, string> = {
  body_required: "本文を入力してください。",
  body_too_long: `本文は${LETTER_BODY_MAX_LENGTH}文字以内で入力してください。`,
  title_required: "件名を入力してください。",
  title_too_long: `件名は${LETTER_TITLE_MAX_LENGTH}文字以内で入力してください。`,
  rate_limited: "短時間に多く送信されました。少し時間をおいてお試しください。"
};

export class LetterMutationError extends Error {
  constructor(
    public readonly code: LetterMutationFailureCode,
    public readonly status: number = code === "rate_limited" ? 429 : 400
  ) {
    super(ERROR_MESSAGES[code]);
  }
}

export function letterMutationErrorPayload(error: unknown): {
  status: number;
  body: { ok: false; error: { code: string; message: string } };
} {
  if (error instanceof LetterMutationError) {
    return { status: error.status, body: { ok: false, error: { code: error.code, message: error.message } } };
  }
  return {
    status: 500,
    body: { ok: false, error: { code: "internal_error", message: "送信に失敗しました。もう一度お試しください。" } }
  };
}

function normalizeBody(raw: string): string {
  const body = raw.trim();
  if (!body) throw new LetterMutationError("body_required");
  if (body.length > LETTER_BODY_MAX_LENGTH) throw new LetterMutationError("body_too_long");
  return body;
}

function normalizeTitle(raw: string): string {
  const title = normalizeLetterTitle(raw);
  if (!title) throw new LetterMutationError("title_required");
  if (title.length > LETTER_TITLE_MAX_LENGTH) throw new LetterMutationError("title_too_long");
  return title;
}

async function ensureGuestRateLimit(actor: LetterMutationActor): Promise<void> {
  if (actor.role !== "guest") return;
  if ((await countRecentLettersFromGuest(actor.guestId)) >= 3) {
    throw new LetterMutationError("rate_limited");
  }
}

function actorLetter(actor: LetterMutationActor, body: string) {
  return {
    // The display name never participates in authorization or notification classification.
    sender: actor.role === "admin" ? ADMIN_DISPLAY_NAME : actor.guestName.trim() || "ゲスト",
    senderRole: actor.role,
    body,
    createdAt: new Date().toISOString()
  } as const;
}

async function notifyAfterPost(
  actor: LetterMutationActor,
  targetGuestId: string,
  slug: string,
  title?: string
): Promise<void> {
  if (actor.role === "admin") {
    await markGuestLetterNotificationsReadForThread(slug, targetGuestId);
    pingRoomNotificationSubscriber(targetGuestId);
    try {
      await sendWebPushToGuestIds([targetGuestId], {
        title: "管理人からの便り",
        body: title ? letterNewThreadPushBody(title) : "文通に返信がありました。",
        url: guestLetterOpenUrl(slug)
      });
    } catch (error) {
      console.error("[letters] web push to guest", error);
    }
    return;
  }

  pingAdminNotificationSubscribers();
  try {
    await sendWebPushGuestLetterToAdmins({
      slug,
      guestId: targetGuestId,
      senderName: actor.guestName
    });
  } catch (error) {
    console.error("[letters] web push to admins", error);
  }
}

export async function postLetterMutation(input: {
  actor: LetterMutationActor;
  targetGuestId: string;
  slug: string;
  body: string;
}): Promise<{ letters: Letter[] }> {
  const body = normalizeBody(input.body);
  await ensureGuestRateLimit(input.actor);
  const letters = await appendLetter(input.slug, input.targetGuestId, actorLetter(input.actor, body));
  await notifyAfterPost(input.actor, input.targetGuestId, input.slug);
  return { letters };
}

export async function createStandaloneLetterMutation(input: {
  actor: LetterMutationActor;
  targetGuestId: string;
  title: string;
  body: string;
}): Promise<{ slug: string; title: string; letters: Letter[] }> {
  const title = normalizeTitle(input.title);
  const body = normalizeBody(input.body);
  await ensureGuestRateLimit(input.actor);
  const created = await createStandaloneLetterThread({
    guestId: input.targetGuestId,
    title,
    letter: actorLetter(input.actor, body)
  });
  await notifyAfterPost(input.actor, input.targetGuestId, created.slug, created.title);
  return created;
}
