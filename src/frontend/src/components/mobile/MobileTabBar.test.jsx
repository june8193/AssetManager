import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileTabBar from './MobileTabBar';

describe('MobileTabBar', () => {
  it('4대 핵심 탭(대시보드, 자산 조회, 비중 점검, 설정)이 모두 렌더링되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MobileTabBar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /대시보드/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /자산 조회/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /비중 점검/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /설정/i })).toBeInTheDocument();
  });

  it('현재 경로에 해당하는 탭이 활성화(active) 스타일을 가져야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/m/ratios']}>
        <MobileTabBar />
      </MemoryRouter>
    );

    const ratioLink = screen.getByRole('link', { name: /비중 점검/i });
    expect(ratioLink).toHaveAttribute('data-active', 'true');

    const dashboardLink = screen.getByRole('link', { name: /대시보드/i });
    expect(dashboardLink).toHaveAttribute('data-active', 'false');
  });

  it('루트 경로(/) 및 /dashboard, /m/dashboard는 대시보드 탭을 활성화해야 한다', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <MobileTabBar />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /대시보드/i })).toHaveAttribute('data-active', 'true');
    unmount();

    render(
      <MemoryRouter initialEntries={['/m/dashboard']}>
        <MobileTabBar />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /대시보드/i })).toHaveAttribute('data-active', 'true');
  });
});
