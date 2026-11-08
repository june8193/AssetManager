import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config.js API_BASE_URL', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('브라우저 환경에서는 Mixed Content 방지 및 동일 오리진 프록시를 위해 상대 경로 /api를 반환해야 한다', async () => {
    globalThis.window = {
      location: {
        hostname: 'seongeuns-macbook-air.tail9df66b.ts.net',
        origin: 'https://seongeuns-macbook-air.tail9df66b.ts.net',
        protocol: 'https:',
      },
    };

    const { API_BASE_URL, DB_API_BASE } = await import('./config');
    expect(API_BASE_URL).toBe('/api');
    expect(DB_API_BASE).toBe('/api/db');
  });

  it('VITE_API_URL 환경 변수가 명시적으로 지정된 경우 해당 값을 우선해야 한다', async () => {
    vi.stubEnv('VITE_API_URL', 'https://custom-api.example.com/api');
    globalThis.window = {
      location: {
        hostname: 'seongeuns-macbook-air.tail9df66b.ts.net',
      },
    };

    const { API_BASE_URL, DB_API_BASE } = await import('./config');
    expect(API_BASE_URL).toBe('https://custom-api.example.com/api');
    expect(DB_API_BASE).toBe('https://custom-api.example.com/api/db');
  });
});
