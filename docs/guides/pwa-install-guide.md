# AssetManager PWA 모바일 설치 및 접속 가이드

AssetManager는 Tailscale Serve의 안전한 HTTPS 암호화 터널과 프로그레시브 웹 앱(PWA, Progressive Web App) 기술을 통해, 안드로이드와 iOS 모바일 기기에서 네이티브 앱과 동일한 전체화면(Standalone) 환경으로 사용할 수 있습니다.

---

## 1. 사전 준비사항

PWA를 설치하고 사용하기 위해서는 모바일 기기가 호스트 머신(MacBook Air)과 동일한 **Tailscale 네트워크(Tailnet)**에 연결되어 있어야 합니다.

1. **Tailscale 앱 설치**:
   - **Android**: Google Play Store에서 [Tailscale](https://play.google.com/store/apps/details?id=com.tailscale.ipn) 설치
   - **iOS**: Apple App Store에서 [Tailscale](https://apps.apple.com/app/tailscale/id1470499037) 설치
2. **로그인 및 활성화**:
   - Mac 호스트와 동일한 계정 또는 공유된 Tailnet 계정으로 로그인합니다.
   - Tailscale VPN 스위치를 **ON(Connected)**으로 켭니다.
3. **접속 주소(URL)**:
   - `https://seongeuns-macbook-air.tail9df66b.ts.net`
   - 포트 번호(`:5173` 또는 `:8000`) 없이 표준 HTTPS 포트(443)로 접속합니다.

---

## 2. Android (Chrome / 삼성 인터넷) 설치 가이드

안드로이드에서는 브라우저의 PWA 자동 감지 기능을 통해 WebAPK 형태의 독립 실행형 앱으로 설치됩니다.

### 설치 단계
1. **Chrome 브라우저**를 열고 `https://seongeuns-macbook-air.tail9df66b.ts.net`에 접속합니다.
2. 페이지 하단에 **"홈 화면에 AssetManager 추가"** 배너가 나타나면 **[설치]**를 누릅니다.
   - 배너가 나타나지 않을 경우:
     1. 브라우저 우측 상단 **더보기 메뉴(⋮)**를 누릅니다.
     2. 메뉴에서 **[앱 설치]** 또는 **[홈 화면에 추가]**를 선택합니다.
3. 확인 팝업에서 **[설치]**를 누르면 백그라운드에서 앱 설치가 완료됩니다.

### 실행 및 특징
- 홈 화면 및 앱 서랍(App Drawer)에 고해상도 앱 아이콘(`pwa-192x192.png`, `pwa-512x512.png`)으로 등록됩니다.
- 앱을 실행하면 브라우저 주소창 및 탐색 바 없이 네이티브 앱처럼 전체화면으로 실행됩니다.
- 모바일 전용 레이아웃과 하단 탭 내비게이션이 자동으로 최적화되어 제공됩니다.

---

## 3. iOS (Safari) 설치 가이드

iOS Safari는 Apple의 보안 정책상 브라우저 공유 메뉴를 통해 홈 화면에 웹앱을 추가합니다.

### 설치 단계
1. **Safari 브라우저**를 열고 `https://seongeuns-macbook-air.tail9df66b.ts.net`에 접속합니다.
   > **주의**: Chrome 등 서드파티 브라우저가 아닌 **반드시 Safari**를 사용해야 독립 실행형(Standalone) 모드로 등록됩니다.
2. 브라우저 하단 중앙의 **공유 버튼** (네모 상자 위로 향하는 화살표 아이콘)을 누릅니다.
3. 메뉴 스크롤 후 **[홈 화면에 추가 (Add to Home Screen)]**를 선택합니다.
4. 이름이 `AssetManager`로 지정된 것을 확인하고 우측 상단의 **[추가]**를 누릅니다.

### 실행 및 특징
- iOS 규격 전용 고화질 터치 아이콘(`apple-touch-icon.png`, 180x180)이 홈 화면에 선명하게 생성됩니다.
- 홈 화면 아이콘을 탭하여 실행하면 상단 상태 표시줄 및 하단 Safari 툴바가 사라진 **전체화면(Standalone)** 모드로 구동됩니다.
- iOS 제스처(스와이프 탐색 등) 및 모바일 최적화 UI가 매끄럽게 동작합니다.

---

## 4. 아키텍처 및 동작 원리

```
[ 모바일 기기 (Android / iOS) ]
       │
       │ Tailscale HTTPS (443 / WireGuard 암호화 터널)
       ▼
[ Tailscale Serve 프록시 (호스트 머신) ]
       │
       │ 로컬 포워딩 (http://127.0.0.1:5173)
       ▼
[ Vite Preview 서버 (포트 5173) ]
       │
       ├── 정적 에셋 서빙 (HTML, JS, CSS, PNG 아이콘, PWA Manifest, Service Worker)
       │
       └── /api/* 요청 내부 프록시 ──▶ [ FastAPI 백엔드 (포트 8000) ] ──▶ [ SQLite DB ]
```

- **HTTPS 암호화**: Tailscale 정식 도메인 인증서를 통해 브라우저 보안 경고 없이 서비스 워커가 등록됩니다.
- **Mixed Content 방지**: 프론트엔드와 백엔드 API 호출이 동일 오리진(`https://seongeuns-macbook-air.tail9df66b.ts.net`)으로 처리되어 통신 차단이 발생하지 않습니다.
- **오프라인 캐싱**: Workbox 기반 서비스 워커(`sw.js`)가 정적 리소스 및 폰트를 사전 캐싱하여 빠른 기동 속도를 보장합니다.

---

## 5. 자주 묻는 질문 및 문제 해결 (Troubleshooting)

### Q1. 사이트에 연결할 수 없거나 접속 시간이 초과됩니다.
- 모바일 기기에서 **Tailscale 앱이 켜져 있는지(VPN 스위치 ON)** 확인하세요.
- 호스트 PC(Mac)에서 서버가 구동 중인지 확인하세요 (`uv run python scripts/run_prod.py`).

### Q2. 안드로이드에서 "앱 설치" 메뉴가 나타나지 않습니다.
- 이미 브라우저에 해당 사이트가 일반 바로가기로 등록되어 있다면 기존 바로가기를 삭제한 후 브라우저 캐시를 새로고침(새로고침 아이콘 길게 누르기)해 보세요.
- Chrome 설정 > 사이트 설정에서 쿠키 및 데이터 저장이 허용되어 있는지 확인하세요.

### Q3. iOS에서 홈 화면에 추가했는데 브라우저 주소창이 여전히 보입니다.
- Chrome이나 네이버 앱 등 인앱 브라우저로 접속한 경우 주소창이 유지될 수 있습니다. **반드시 기본 Safari 앱**에서 `홈 화면에 추가`를 실행해 주시기 바랍니다.

### Q4. "403 Forbidden" 에러가 발생합니다.
- Vite의 호스트 검증 설정에 `.ts.net`이 정상 반영되었는지 확인하세요 (`src/frontend/vite.config.js`의 `allowedHosts: ['.ts.net']`).
