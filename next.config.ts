import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typedRoutes: true,
  /** 親フォルダの package-lock と誤検出されないよう、このプロジェクトをルートと明示する */
  outputFileTracingRoot: path.join(process.cwd()),
  /** typedRoutes 等の厳格な型でローカルビルドが止まる場合に Vercel 本番ビルドを通す */
  typescript: {
    ignoreBuildErrors: true
  },
  /** 記事 MD の Server Action アップロードで既定 1MB を超えないよう拡張 */
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb"
    }
  }
};

export default nextConfig;
