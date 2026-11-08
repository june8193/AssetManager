/**
 * 프론트엔드 전역 설정 파일입니다.
 */
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 브라우저 환경에서는 동일 오리진의 /api 프록시 경로를 사용합니다.
  // 이를 통해 HTTPS(Tailscale 도메인 등) 접속 시 Mixed Content 차단 및 포트 불일치를 방지합니다.
  if (typeof window !== 'undefined') {
    return '/api';
  }
  // Node.js 환경(테스트 등)에서는 기본 로컬 백엔드 주소를 사용합니다.
  const port = import.meta.env.VITE_API_PORT || '8000';
  return `http://localhost:${port}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const DB_API_BASE = `${API_BASE_URL}/db`;
