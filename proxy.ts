import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const NO_STORE = "private, no-store, must-revalidate";

/**
 * HTML / ルームを CDN・ブラウザに長期キャッシュさせない（削除済み ID の古い画面が残らないようにする）
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

export const config = {
  matcher: ["/", "/join", "/room/:path*"]
};
