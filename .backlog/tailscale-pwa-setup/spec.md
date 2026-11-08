# Spec: Tailscale HTTPS 연동 및 멀티 OS(Android/iOS) PWA 설치 환경 구축

Status: ready-for-agent

## Problem Statement

현재 AssetManager는 모바일 및 타 기기에서 `http://100.87.65.46:5173` 사설 IP 주소로 직접 접속하여 사용하고 있습니다. 이로 인해 다음과 같은 문제와 한계가 발생합니다:

1. **PWA(웹앱) 설치 불가 (단순 북마크로만 추가됨)**:
   - 안드로이드(Chrome, 삼성 인터넷) 및 iOS(Safari)는 보안 정책상 안전하지 않은 HTTP 환경에서 서비스 워커(`sw.js`) 등록 및 PWA 설치를 원천 차단합니다. 그 결과 홈 화면에 추가하더라도 독립 실행형 앱이 아닌 단순 웹 브라우저 바로가기/북마크로만 생성됩니다.
2. **Tailscale 도메인 접근 차단 (403 Forbidden)**:
   - Tailscale Serve가 활성화되어 있으나 백엔드(`8000`)로 설정되어 있고, 프론트엔드(Vite v8)의 호스트 검증에 의해 `seongeuns-macbook-air.tail9df66b.ts.net` 접속 시 403 차단이 발생합니다.
3. **아이콘 규격 불일치 (SVG 전용)**:
   - 매니페스트 및 HTML 메타 태그가 SVG 아이콘(`*.svg`)만 참조하고 있어, Android WebAPK 패키징 요구사항(192x192, 512x512 PNG) 및 iOS 홈 화면 아이콘 요구사항(180x180 apple-touch-icon PNG)을 만족하지 못해 아이콘이 깨지거나 설치 품질이 저하됩니다.

## Solution

Tailscale Serve의 HTTPS(443) 프록시를 프론트엔드(`5173`)로 연결하고, Vite 호스트 허용 설정 및 표준 PNG 규격의 PWA 아이콘/매니페스트/HTML 메타 태그를 완비하여 안드로이드와 iOS 모두에서 독립 실행형(Standalone) PWA로 원활히 설치 및 실행되도록 합니다.

1. **Vite 설정 업데이트**:
   - `server` 및 `preview` 블록에 Tailnet 도메인(`allowedHosts: ['.ts.net']`)을 허용하여 호스트 차단을 해제합니다.
2. **멀티 OS PWA 아이콘 생성 및 배포**:
   - 기존 SVG 에셋을 기반으로 고화질 PNG 아이콘(`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`)을 정적 디렉토리에 생성합니다.
   - PWA 플러그인 매니페스트 설정(`vite.config.js`) 및 `index.html`에 PNG 아이콘을 등록하고 마스크 가능한(Maskable) 아이콘 및 iOS 전용 터치 아이콘 링크를 연결합니다.
3. **Tailscale Serve 포트 정렬**:
   - `tailscale serve` 대상을 백엔드(8000)에서 프론트엔드(5173)로 변경하여 브라우저가 포트 번호 없는 표준 HTTPS(`https://seongeuns-macbook-air.tail9df66b.ts.net`)로 프론트엔드 웹 화면과 `/api` 프록시를 동시에 수신하도록 구성합니다.

## User Stories

1. As an android mobile user, I want to access AssetManager via `https://seongeuns-macbook-air.tail9df66b.ts.net`, so that I don't need to memorize or type local IP addresses and port numbers.
2. As an android mobile user, I want the browser to prompt me to "Install App" (or find it in the browser menu), so that I can install AssetManager as a true standalone WebAPK on my home screen and app drawer.
3. As an android mobile user, I want the installed PWA to show a crisp, high-resolution app icon on my home screen and splash screen, so that it looks like a native financial app.
4. As an iOS mobile user (e.g. spouse's iPhone), I want to open the Tailscale HTTPS URL in Safari and tap "Add to Home Screen", so that it opens as a fullscreen standalone web application without browser address bars.
5. As an iOS mobile user, I want the home screen icon on iPhone to clearly display the AssetManager logo rather than a shrunken website screenshot.
6. As a user on any device on the Tailnet, I want all API requests (`/api/...`) and WebSocket connections (`/ws`) to route transparently to the backend server through the Vite proxy without CORS or mixed-content (HTTP vs HTTPS) security blocks.
7. As a developer running the production server via `run_prod.py`, I want the build and preview configuration to persist and survive rebuilds automatically.

## Implementation Decisions

1. **Vite Configuration for Tailscale Host Acceptance**:
   - `src/frontend/vite.config.js`의 `server` 및 `preview` 객체에 `allowedHosts: ['.ts.net']`를 선언하여 Tailscale에서 발급하는 모든 `*.ts.net` 서브도메인의 Host 헤더 요청을 수락하도록 설정합니다.
2. **PWA Manifest & Asset Standardization**:
   - `src/frontend/public/` 하위에 다음 규격의 PNG 파일을 추가합니다:
     - `pwa-192x192.png`: Android 표준 런처 아이콘
     - `pwa-512x512.png`: 스플래시 화면 및 고해상도 WebAPK 빌드용 아이콘
     - `apple-touch-icon.png`: iOS Safari 전용 홈 화면 아이콘 (180x180)
   - `vite.config.js`의 `VitePWA` 매니페스트 `icons` 목록에 SVG 외에 위 PNG 아이콘들을 추가하며, `512x512`는 `purpose: "any maskable"`을 포함하도록 명시합니다.
   - `src/frontend/index.html`의 `<head>` 영역에 `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`를 추가(또는 PNG로 교체)합니다.
3. **Tailscale Serve Route Alignment**:
   - 호스트 머신의 Tailscale Serve 설정을 `tailscale serve --bg 5173`으로 갱신하여 인바운드 443(HTTPS) 트래픽이 5173번 포트(Vite Preview)로 프록시되도록 매핑합니다.
   - 프론트엔드의 `vite preview` 프록시(`/api` -> `http://localhost:8000`)를 통해 단일 HTTPS 오리진에서 프론트와 백엔드 통신이 모두 완결되므로 브라우저 Mixed Content 경고를 방지합니다.

## Testing Decisions

- **검증 대상(Seam) 및 원칙**:
  - 외부 사용자 인터페이스 및 브라우저 프로토콜 응답 검증을 최상위 심(Highest Seam)으로 설정합니다.
  - 내부 로직을 모킹하지 않고 실제 HTTP/HTTPS 응답 헤더, 매니페스트 JSON 반환값, 서비스 워커 등록 파일 유효성을 직접 검증합니다.
- **테스트 케이스**:
  1. **호스트 헤더 검증**: `curl -i -H "Host: seongeuns-macbook-air.tail9df66b.ts.net" http://127.0.0.1:5173/` 요청 시 403 차단 없이 200 OK와 올바른 HTML이 반환되는지 확인.
  2. **매니페스트 정합성 검증**: `http://127.0.0.1:5173/manifest.webmanifest` 조회 시 `pwa-192x192.png`, `pwa-512x512.png`가 `type: "image/png"`로 포함되어 있는지 확인.
  3. **에셋 응답 검증**: 생성된 `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`가 200 OK 응답 및 올바른 이미지 헤더(`image/png`)로 전송되는지 확인.
  4. **API 프록시 연속성 검증**: `http://127.0.0.1:5173/api/db/users` 조회 시 200 OK와 JSON 결과가 정상 전달되는지 확인.
  5. **기존 프론트엔드 단위/컴포넌트 테스트 통과**: `pnpm test` (Vitest) 실행하여 기존 테스트 스위트에 영향이 없는지 확인.

## Out of Scope

- Tailnet 외부의 일반 공용 인터넷(Public Web)으로 공개하기 위한 `tailscale funnel` 설정 (내부 보안을 위해 Tailnet 사용자만 접속하도록 유지).
- 네이티브 앱스토어(Google Play Store, Apple App Store) 패키징 및 등록.
- 오프라인 데이터 전체 동기화 및 오프라인 쓰기 큐 기능 (기존 캐싱 정책 유지).

## Further Notes

- iOS 사용자의 경우 Safari에서 '홈 화면에 추가'를 통해 설치할 수 있으며, 이 때 `standalone` 모드로 동작하여 상단 주소창 없이 네이티브 앱처럼 동작합니다.
- Android 기기에서는 Tailscale 앱이 켜져 있는 상태에서 Chrome으로 접속 시 설치 팝업이 표시됩니다.
