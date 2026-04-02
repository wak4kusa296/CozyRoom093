/** 管理 API が HTML エラーページを返したときに res.json() が落ちるのを防ぐ */
export async function readAdminJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `サーバーの応答が読み取れませんでした（HTTP ${res.status}）。ページを再読み込みするか、しばらくしてから再試行してください。`
    );
  }
}
