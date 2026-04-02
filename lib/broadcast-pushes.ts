import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/db";

/** ルーム通知パネル・モーダルに載せるプッシュの内容 */
export type BroadcastPush = {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  audience: "all" | "selected";
  guestIds: string[];
  lead?: string;
  linkUrl?: string;
  linkLabel?: string;
  imageUrl?: string;
};

export type AppendBroadcastPushInput = {
  title: string;
  body: string;
  audience: "all" | "selected";
  guestIds: string[];
  lead: string;
  linkUrl?: string;
  linkLabel?: string;
  imageUrl?: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeGuestIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    const g = typeof x === "string" ? x.trim() : "";
    if (!g || seen.has(g)) continue;
    seen.add(g);
    out.push(g);
  }
  return out;
}

function normalizeOptionalUrl(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  const v = value.trim();
  if (v.startsWith("/")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || u.protocol === "http:") return v;
  } catch {
    return undefined;
  }
  return undefined;
}

type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  sent_at: Date;
  audience: string;
  guest_ids: string[] | null;
  lead: string | null;
  link_url: string | null;
  link_label: string | null;
  image_url: string | null;
};

function rowToPush(row: BroadcastRow): BroadcastPush {
  const audience: "all" | "selected" = row.audience === "selected" ? "selected" : "all";
  const guestIds = audience === "selected" ? normalizeGuestIds(row.guest_ids ?? []) : [];
  return {
    id: row.id,
    title: row.title.trim(),
    body: row.body.trim(),
    sentAt: row.sent_at.toISOString(),
    audience,
    guestIds,
    lead: row.lead?.trim() || undefined,
    linkUrl: normalizeOptionalUrl(row.link_url) ?? undefined,
    linkLabel: row.link_label?.trim() || undefined,
    imageUrl: normalizeOptionalUrl(row.image_url) ?? undefined
  };
}

export async function listBroadcastPushes(): Promise<BroadcastPush[]> {
  const pool = getDbPool();
  const result = await pool.query<BroadcastRow>(
    `SELECT id, title, body, sent_at, audience, guest_ids, lead, link_url, link_label, image_url
     FROM broadcast_pushes
     ORDER BY sent_at DESC`
  );
  return result.rows.map(rowToPush);
}

export async function getBroadcastPushById(id: string): Promise<BroadcastPush | null> {
  const pool = getDbPool();
  const result = await pool.query<BroadcastRow>(
    `SELECT id, title, body, sent_at, audience, guest_ids, lead, link_url, link_label, image_url
     FROM broadcast_pushes WHERE id = $1::uuid`,
    [id]
  );
  const row = result.rows[0];
  return row ? rowToPush(row) : null;
}

export function pushAppliesToGuest(push: BroadcastPush, guestId: string): boolean {
  const g = guestId.trim();
  if (!g) return false;
  if (push.audience === "all") return true;
  return push.guestIds.includes(g);
}

export async function appendBroadcastPush(input: AppendBroadcastPushInput): Promise<BroadcastPush> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("title_and_body_required");
  }
  const audience = input.audience === "selected" ? "selected" : "all";
  const guestIds = audience === "selected" ? normalizeGuestIds(input.guestIds) : [];
  if (audience === "selected" && guestIds.length === 0) {
    throw new Error("guests_required");
  }

  const lead = input.lead.trim();
  if (!lead) {
    throw new Error("lead_required");
  }
  const linkUrl = normalizeOptionalUrl(input.linkUrl);
  const linkLabel = input.linkLabel?.trim() || undefined;
  const imageUrl = normalizeOptionalUrl(input.imageUrl);

  const id = randomUUID();
  const sentAt = new Date();
  const resolvedLinkLabel = linkLabel || (linkUrl ? "開く" : undefined);
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO broadcast_pushes (
      id, title, body, sent_at, audience, guest_ids, lead, link_url, link_label, image_url
    )
    VALUES ($1::uuid, $2, $3, $4, $5, $6::text[], $7, $8, $9, $10)
    `,
    [
      id,
      title,
      body,
      sentAt,
      audience,
      guestIds,
      lead,
      linkUrl ?? null,
      resolvedLinkLabel ?? null,
      imageUrl ?? null
    ]
  );

  return {
    id,
    title,
    body,
    sentAt: sentAt.toISOString(),
    audience,
    guestIds: audience === "selected" ? guestIds : [],
    lead,
    linkUrl,
    linkLabel: resolvedLinkLabel,
    imageUrl
  };
}
