import type { NextConfig } from "next";

// 브라우저는 /api/* 로 요청하고, Next 서버가 백엔드(sunsetcoast-api)로 넘긴다. (CORS 불필요)
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiBaseUrl}/:path*` },
      // 네이버·카카오 로그인. 콜백 주소가 화면 주소(/login/oauth2/code/kakao)여야 세션 쿠키가 화면 도메인에 생긴다
      { source: "/oauth2/:path*", destination: `${apiBaseUrl}/oauth2/:path*` },
      { source: "/login/oauth2/:path*", destination: `${apiBaseUrl}/login/oauth2/:path*` },
    ];
  },
};

export default nextConfig;
