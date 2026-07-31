import { NextResponse } from "next/server";

export type JsonError = {
  code: string;
  message: string;
};

export type JsonFailure = {
  ok: false;
  error: JsonError;
};

/** API 成功レスポンスを共通形式で返す。 */
export function jsonOk<T extends object>(body: T, init?: ResponseInit): NextResponse<T & { ok: true }> {
  return NextResponse.json({ ok: true, ...body }, init);
}

/** API 失敗レスポンスを { ok, error: { code, message } } に統一する。 */
export function jsonError(code: string, message: string, init?: ResponseInit): NextResponse<JsonFailure> {
  return NextResponse.json({ ok: false, error: { code, message } }, init);
}

/** リクエストボディを JSON として安全にパースする。不正な JSON は null を返す。 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
