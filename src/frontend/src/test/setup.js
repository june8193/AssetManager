import '@testing-library/jest-dom';
import { vi } from 'vitest';

import React from 'react';

if (typeof window !== 'undefined') {
  window.alert = vi.fn();
  window.confirm = vi.fn(() => true);
  window.prompt = vi.fn();
  window.scrollTo = vi.fn();

  // ResizeObserver mock
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // matchMedia mock
  window.matchMedia = window.matchMedia || function() {
    return {
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  };
}

const DEFAULT_MOCK_WIDTH = 800;
const DEFAULT_MOCK_HEIGHT = 400;

// Recharts ResponsiveContainer 전역 모킹 (크기 계산 경고 방지 및 고속 렌더링)
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    ResponsiveContainer: ({ children, width = DEFAULT_MOCK_WIDTH, height = DEFAULT_MOCK_HEIGHT }) => {
      const w = typeof width === 'number' ? width : DEFAULT_MOCK_WIDTH;
      const h = typeof height === 'number' ? height : DEFAULT_MOCK_HEIGHT;

      let childNode;
      if (typeof children === 'function') {
        childNode = children({ width: w, height: h });
      } else if (React.isValidElement(children)) {
        childNode = React.cloneElement(children, { width: w, height: h });
      } else {
        childNode = children;
      }

      return React.createElement('div', {
        style: { width: w, height: h },
        className: 'recharts-responsive-container'
      }, childNode);
    },
  };
});

if (typeof window !== 'undefined') {
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value.toString(); },
      clear: () => { store = {}; },
      removeItem: (key) => { delete store[key]; }
    };
  })();

  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  });
}

