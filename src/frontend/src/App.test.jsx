import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App 적응형 레이아웃 분기', () => {
  let originalInnerWidth;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    vi.restoreAllMocks();
  });

  it('데스크톱 너비(1024px)에서는 사이드바(Desktop Navigation)가 렌더링되어야 한다', () => {
    window.innerWidth = 1024;
    render(<App />);

    // 데스크톱 사이드바 네비게이션 확인
    expect(screen.getByRole('navigation', { name: /메인 메뉴/i })).toBeInTheDocument();
    // 모바일 탭바는 렌더링되지 않아야 함
    expect(screen.queryByRole('link', { name: /자산 조회/i })).not.toBeInTheDocument();
  });

  it('모바일 너비(500px)에서는 MobileLayout(상단 헤더 + 하단 탭바)이 렌더링되어야 한다', () => {
    window.innerWidth = 500;
    render(<App />);

    // 모바일 탭 바 및 헤더 확인
    expect(screen.getByText('AssetManager')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /대시보드/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /자산 조회/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /비중 점검/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /설정/i })).toBeInTheDocument();

    // 데스크톱 사이드바는 렌더링되지 않아야 함
    expect(screen.queryByRole('navigation', { name: /메인 메뉴/i })).not.toBeInTheDocument();
  });
});
