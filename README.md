# sunsetcoast-admin-web

선셋코스트 운영 관리자 화면 (Next.js). 백엔드는 [sunsetcoast-api](https://github.com/xg-r/sunsetcoast-api).

## 화면

| 경로 | 기능 |
|---|---|
| `/settlements/upload` | 정산 파일 업로드 (떠나요·여기어때·NOL, 여러 파일, 미리보기) |
| `/settlements/history` | 업로드 내역, 확인 필요 행이 있는 파일 필터 |
| `/reservations` | 업소·월별 예약 목록(플랫폼·상태·검색·정렬), 예약 상세(금액, 관리비, 1박별 정산 행) |
| `/management-fees` | 업소·월별 현장 관리비, 예약별 금액 수정(사유 필수), 전체 재계산 |
| `/stay-calendar` | 업소·월별 성수기 달력, 날짜 직접 지정, 전체 재계산 |

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

브라우저는 `/api/*`로 요청하고, Next 서버가 `API_BASE_URL`(기본 `http://localhost:8080`)로 넘깁니다. 그래서 API 서버에 CORS 설정이 필요 없습니다. 주소를 바꾸려면 `.env.example`을 `.env.local`로 복사해 고치세요.
