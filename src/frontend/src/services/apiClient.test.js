import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './apiClient';

describe('ApiError', () => {
  it('상태 코드, detail 메시지, data를 포함하는 ApiError 인스턴스를 생성한다', () => {
    const error = new ApiError('유효하지 않은 요청입니다', 400, '잘못된 계좌 ID', { detail: '잘못된 계좌 ID' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('유효하지 않은 요청입니다');
    expect(error.status).toBe(400);
    expect(error.detail).toBe('잘못된 계좌 ID');
    expect(error.data).toEqual({ detail: '잘못된 계좌 ID' });
  });

  it('detail이 없는 경우 기본 상태 텍스트 또는 메시지를 detail로 설정한다', () => {
    const error = new ApiError('서버 오류', 500);
    expect(error.status).toBe(500);
    expect(error.detail).toBe('서버 오류');
  });
});

describe('apiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('HTTP 메서드 및 요청 처리', () => {
    it('GET 요청 성공 시 JSON 응답을 역직렬화하여 반환한다', async () => {
      const mockData = { total_assets: 1000000 };
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce(JSON.stringify(mockData)),
        json: vi.fn().mockResolvedValueOnce(mockData),
      });

      const result = await apiClient.get('/v1/summary');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('/v1/summary');
      expect(options.method).toBe('GET');
      expect(result).toEqual(mockData);
    });

    it('GET 요청 시 params 객체를 쿼리 스트링으로 올바르게 직렬화한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce('[]'),
        json: vi.fn().mockResolvedValueOnce([]),
      });

      await apiClient.get('/transactions', { page: 1, limit: 20, search: '월급' });

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('page=1');
      expect(url).toContain('limit=20');
      expect(url).toContain('search=%EC%9B%94%EA%B8%89');
    });

    it('params에 null이나 undefined가 포함된 경우 쿼리 파라미터에서 제외한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce('[]'),
        json: vi.fn().mockResolvedValueOnce([]),
      });

      await apiClient.get('/transactions', { page: 1, filter: undefined, tag: null });

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toContain('page=1');
      expect(url).not.toContain('filter');
      expect(url).not.toContain('tag');
    });

    it('POST 요청 시 객체 본문을 JSON 문자열로 직렬화하고 Content-Type 헤더를 설정한다', async () => {
      const requestBody = { name: '새 계좌', balance: 50000 };
      const responseData = { id: 1, ...requestBody };

      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce(JSON.stringify(responseData)),
        json: vi.fn().mockResolvedValueOnce(responseData),
      });

      const result = await apiClient.post('/accounts', requestBody);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify(requestBody));
      expect(result).toEqual(responseData);
    });

    it('PUT 요청 시 본문을 전송하고 응답을 반환한다', async () => {
      const updateData = { name: '수정된 계좌' };
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce(JSON.stringify({ id: 1, ...updateData })),
        json: vi.fn().mockResolvedValueOnce({ id: 1, ...updateData }),
      });

      const result = await apiClient.put('/accounts/1', updateData);

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.method).toBe('PUT');
      expect(options.body).toBe(JSON.stringify(updateData));
      expect(result).toEqual({ id: 1, ...updateData });
    });

    it('DELETE 요청을 정상적으로 수행한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce(JSON.stringify({ success: true })),
        json: vi.fn().mockResolvedValueOnce({ success: true }),
      });

      const result = await apiClient.delete('/accounts/1');

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(result).toEqual({ success: true });
    });

    it('204 No Content 응답 시 null을 반환한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: vi.fn().mockResolvedValueOnce(''),
      });

      const result = await apiClient.delete('/accounts/1');
      expect(result).toBeNull();
    });
  });

  describe('URL 정규화', () => {
    it('경로가 /api로 시작하더라도 Base URL의 /api와 중복(/api/api)되지 않도록 정규화한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce('{}'),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await apiClient.get('/api/v1/summary');

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).not.toContain('/api/api');
      expect(url).toMatch(/\/api\/v1\/summary$/);
    });

    it('경로가 슬래시 없이 시작해도 올바르게 결합한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce('{}'),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await apiClient.get('v1/summary');

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toMatch(/\/api\/v1\/summary$/);
    });

    it('절대 URL(http:// 또는 https://)이 전달되면 그대로 사용한다', async () => {
      globalThis.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValueOnce('{}'),
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await apiClient.get('https://example.com/external-api');

      const [url] = globalThis.fetch.mock.calls[0];
      expect(url).toBe('https://example.com/external-api');
    });
  });

  describe('에러 핸들링', () => {
    it('4xx 에러 응답 시 백엔드 detail 메시지를 포함한 ApiError를 throw한다', async () => {
      const errorResponse = { detail: '존재하지 않는 계좌입니다' };
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue(JSON.stringify(errorResponse)),
        json: vi.fn().mockResolvedValue(errorResponse),
      });

      await expect(apiClient.get('/accounts/999')).rejects.toThrow(ApiError);

      try {
        await apiClient.get('/accounts/999');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(404);
        expect(err.detail).toBe('존재하지 않는 계좌입니다');
        expect(err.data).toEqual(errorResponse);
      }
    });

    it('500 서버 오류 응답 시 적절한 ApiError를 throw한다', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: vi.fn().mockResolvedValue('Database connection failed'),
      });

      await expect(apiClient.get('/error')).rejects.toThrow(ApiError);
    });

    it('timeout 옵션 지정 시 타임아웃 에러를 발생시킨다', async () => {
      globalThis.fetch.mockImplementationOnce((url, options) => {
        return new Promise((_, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new Error('AbortError'));
          });
        });
      });

      await expect(apiClient.get('/timeout-endpoint', null, { timeout: 20 })).rejects.toThrow();
    });
  });
});
