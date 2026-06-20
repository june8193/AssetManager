/**
 * 프론트엔드 전역 설정 파일입니다.
 */
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const port = import.meta.env.VITE_API_PORT || '8000';
  return `http://${hostname}:${port}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const DB_API_BASE = `${API_BASE_URL}/db`;

