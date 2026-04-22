/**
 * 프론트엔드 전역 설정 파일입니다.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const DB_API_BASE = `${API_BASE_URL}/db`;
