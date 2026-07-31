import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NO_STORE = "private, no-store, must-revalidate";
const SESSION_COOKIE_NAME = "room_session";
const MIN_SECRET_LENGTH = 16;

/**
 * Proxy runs in the Edge runtime, so this verifies the admin session with Web
 * Crypto instead of importing the Node.js-only helpers from lib/auth.ts.
 */
async function verifyAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [body, signature] = token.split(".");
  if (!body || !signature) return false;

  try {
    const base64Body = body.replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = atob(base64Body.padEnd(base64Body.length + ((4 - (base64Body.length % 4)) % 4), "="));
    const payload = JSON.parse(payloadJson) as { role?: unknown; exp?: unknown };
    if (payload.role !== "admin" || typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp < Date.now()) {
      return false;
    }

    const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
    if (!sessionSecret || sessionSecret.length < MIN_SECRET_LENGTH) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(sessionSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedHex = Array.from(new Uint8Array(expected), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (signature.length !== expectedHex.length) return false;

    let mismatch = 0;
    for (let index = 0; index < signature.length; index += 1) {
      mismatch |= signature.charCodeAt(index) ^ expectedHex.charCodeAt(index);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

function isProtectedAdminPath(pathname: string): boolean {
  return (pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) && pathname !== "/api/admin/enter";
}

/**
 * HTML / ルームを CDN・ブラウザに長期キャッシュさせず、管理領域は
 * エッジで集中認可する。各 Route Handler / Server Action の認可も維持する。
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (isProtectedAdminPath(pathname)) {
    const isAdmin = await verifyAdminSession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        const response = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
        response.headers.set("Cache-Control", NO_STORE);
        return response;
      }
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

export const config = {
  matcher: ["/", "/join", "/room/:path*", "/admin/:path*", "/api/admin/:path*"]
};
