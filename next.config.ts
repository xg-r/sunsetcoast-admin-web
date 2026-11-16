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
  // 첫 화면. 페이지 컴포넌트에서 redirect()를 부르면 개발 모드에서
  // "Failed to execute 'measure' on 'Performance': 'Home [Prerender]' cannot have a negative time stamp" 오류가 나서 라우팅 단계에서 보낸다
  // 내부 관리자 화면: 모든 응답에 검색엔진 색인 금지 헤더 (HTML이 아닌 파일·API 응답까지)
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
  async redirects() {
    return [{ source: "/", destination: "/settlements/upload", permanent: false }];
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
