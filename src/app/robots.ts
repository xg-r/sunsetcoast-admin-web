import type { MetadataRoute } from "next";

/** 내부 관리자 화면이라 모든 검색엔진 크롤링을 막는다 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
