import type { MetadataRoute } from "next";

/** 登録入口などは検索に載せない */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/join", "/admin", "/api/"]
    }
  };
}
