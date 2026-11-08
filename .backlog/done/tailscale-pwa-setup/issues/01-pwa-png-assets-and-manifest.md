# 01 — PWA PNG 에셋 생성 및 웹 매니페스트/HTML 메타 등록

**What to build:**
안드로이드(Chrome/삼성인터넷) WebAPK 생성 및 iOS Safari 홈 화면 아이콘을 지원하기 위해 규격에 맞는 고화질 PNG 에셋(`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`)을 생성하고, Vite PWA 플러그인 매니페스트 및 HTML 메타 태그에 등록하여 브라우저가 유효한 PWA 아이콘으로 인식하도록 합니다.

**Blocked by:** None — can start immediately

**Status:** closed

## Acceptance criteria

- [x] `src/frontend/public/` 하위에 `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`가 유효한 PNG 포맷으로 생성되어 존재해야 함.
- [x] `vite.config.js`의 `VitePWA` 매니페스트 설정에 192x192 및 512x512 PNG 아이콘(표준 및 `any maskable`)이 추가되어야 함.
- [x] `src/frontend/index.html`에 `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`가 등록되어 있어야 함.
- [x] 프론트엔드 빌드 후 생성된 `manifest.webmanifest` 및 PNG 파일들이 정적 서빙 경로에서 올바른 MIME 타입(`image/png`)으로 접근 가능해야 함.
