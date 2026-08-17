/**
 * 프론트엔드 통합 API 클라이언트 및 커스텀 에러 모듈
 */
import { API_BASE_URL } from '../config';

/**
 * API 요청 실패 시 발생하는 커스텀 에러 클래스
 */
export class ApiError extends Error {
  /**
   * @param {string} message - 에러 메시지
   * @param {number} status - HTTP 상태 코드
   * @param {string|object} [detail] - 백엔드 반환 에러 상세 정보
   * @param {any} [data] - 파싱된 응답 데이터 원본
   */
  constructor(message, status, detail, data) {
    const resolvedDetail = detail ?? message;
    const resolvedMessage = message || (typeof resolvedDetail === 'string' 
      ? resolvedDetail 
      : (typeof resolvedDetail === 'object' ? JSON.stringify(resolvedDetail) : `HTTP Error ${status}`));
    
    super(resolvedMessage);
    this.name = 'ApiError';
    this.status = status;
    this.detail = resolvedDetail;
    this.data = data;
  }
}

/**
 * URL 경로와 쿼리 파라미터를 정규화하여 완전한 요청 URL을 생성합니다.
 * @param {string} path - API 엔드포인트 경로 또는 완전한 URL
 * @param {Record<string, any>} [params] - 쿼리 파라미터 객체
 * @returns {string} 정규화된 URL
 */
function buildUrl(path, params) {
  let fullUrl = '';

  if (/^https?:\/\//i.test(path)) {
    fullUrl = path;
  } else {
    const base = (API_BASE_URL || '').replace(/\/+$/, '');
    let cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Base URL이 /api로 끝나는 경우 경로의 /api 중복 제거 (/api/api/... 방지)
    if (base.endsWith('/api') && cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.slice(4);
    } else if (base.endsWith('/api') && cleanPath === '/api') {
      cleanPath = '';
    }

    fullUrl = `${base}${cleanPath}`;
  }

  if (params && typeof params === 'object') {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  return fullUrl;
}

/**
 * 공통 fetch 요청 처리 함수
 * @param {string} path - 요청 경로
 * @param {RequestInit & { params?: Record<string, any> }} [options] - fetch 옵션 및 쿼리 파라미터
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const { params, body, headers = {}, timeout, signal, ...restOptions } = options;
  const url = buildUrl(path, params);

  const reqHeaders = { ...headers };
  let reqBody = body;

  if (
    body !== undefined &&
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer)
  ) {
    reqBody = JSON.stringify(body);
    if (!reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
  }

  let timeoutId;
  let reqSignal = signal;

  if (timeout && !signal && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    reqSignal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(new Error(`요청 시간이 초과되었습니다 (${timeout}ms)`)), timeout);
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: reqHeaders,
      body: reqBody,
      signal: reqSignal,
    });

    if (!response.ok) {
      let parsed = null;
      try {
        const text = await response.text();
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      } catch {
        parsed = null;
      }

      const detail = (parsed && typeof parsed === 'object' && parsed.detail !== undefined)
        ? parsed.detail
        : (typeof parsed === 'string' && parsed ? parsed : response.statusText || '요청 처리에 실패했습니다.');

      const message = typeof detail === 'string' 
        ? detail 
        : (typeof detail === 'object' ? JSON.stringify(detail) : `HTTP ${response.status}`);

      throw new ApiError(message, response.status, detail, parsed);
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * 네이티브 fetch 기반의 경량 통합 API 클라이언트
 */
export const apiClient = {
  /**
   * GET 요청을 수행합니다.
   * @param {string} path - API 경로
   * @param {Record<string, any>} [params] - 쿼리 파라미터
   * @param {RequestInit} [options] - 추가 fetch 옵션
   */
  get(path, params, options) {
    return request(path, { ...options, method: 'GET', params });
  },

  /**
   * POST 요청을 수행합니다.
   * @param {string} path - API 경로
   * @param {any} [body] - 요청 본문 데이터
   * @param {RequestInit} [options] - 추가 fetch 옵션
   */
  post(path, body, options) {
    return request(path, { ...options, method: 'POST', body });
  },

  /**
   * PUT 요청을 수행합니다.
   * @param {string} path - API 경로
   * @param {any} [body] - 요청 본문 데이터
   * @param {RequestInit} [options] - 추가 fetch 옵션
   */
  put(path, body, options) {
    return request(path, { ...options, method: 'PUT', body });
  },

  /**
   * DELETE 요청을 수행합니다.
   * @param {string} path - API 경로
   * @param {RequestInit} [options] - 추가 fetch 옵션
   */
  delete(path, options) {
    return request(path, { ...options, method: 'DELETE' });
  },

  /**
   * 저수준 커스텀 요청을 수행합니다.
   */
  request,
};
