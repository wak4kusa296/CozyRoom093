/** リクエストボディを JSON として安全にパースする。不正な JSON は null を返す。 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
