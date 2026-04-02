import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NO_STORE = "private, no-store, must-revalidate";

/**
 * HTML / ルームを CDN・ブラウザに長期キャッシュさせない（削除済み ID の古い画面が残らないようにする）
 */
export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", NO_STORE);
  return res;
}

export const config = {
  matcher: ["/", "/room/:path*"]
};
