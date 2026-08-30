import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MobileRouteGuard from './MobileRouteGuard';

describe('MobileRouteGuard', () => {
  it('모바일 모드에서 허용된 경로(/, /m/assets 등) 접근 시 정상적으로 컨텐츠를 렌더링해야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/m/assets']}>
        <MobileRouteGuard isMobile={true}>
          <div data-testid="allowed-content">허용된 페이지</div>
        </MobileRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId('allowed-content')).toBeInTheDocument();
  });

  it('모바일 모드에서 데스크톱 전용 경로(/db, /system/logs 등) 접근 시 루트(/)로 리다이렉트되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/db']}>
        <Routes>
          <Route
            path="/"
            element={<div data-testid="dashboard-fallback">대시보드 리다이렉트 완료</div>}
          />
          <Route
            path="/db"
            element={
              <MobileRouteGuard isMobile={true}>
                <div data-testid="desktop-only-content">DB 관리 페이지</div>
              </MobileRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('desktop-only-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('dashboard-fallback')).toBeInTheDocument();
  });

  it('데스크톱 모드(isMobile=false)에서는 모든 경로가 정상적으로 렌더링되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/db']}>
        <MobileRouteGuard isMobile={false}>
          <div data-testid="desktop-only-content">DB 관리 페이지</div>
        </MobileRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByTestId('desktop-only-content')).toBeInTheDocument();
  });
});
