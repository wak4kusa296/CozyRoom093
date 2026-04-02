import type { MetadataRoute } from "next";

/** PWA 用（Chrome / Android のインストール、iOS のホーム画面追加の土台） */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "誰も知らない部屋",
    short_name: "誰も知らない部屋",
    description: "招待された人だけが入れる静かな部屋",
    /** ホーム画面起動は /（未ログインのまま /room に行くとリダイレクトが発生し iOS で不安定になりやすい） */
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#eeeeee",
    theme_color: "#eeeeee",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
