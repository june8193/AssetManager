import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileHeader from './MobileHeader';
import { MaskingProvider } from '../../contexts/MaskingContext';
import { MobileHeaderProvider, useMobileHeaderRefresh } from '../../contexts/MobileHeaderContext';

function RefreshRegistrar({ onRefresh, isRefreshing = false }) {
  useMobileHeaderRefresh(onRefresh, isRefreshing);
  return null;
}

describe('MobileHeader', () => {
  it('현재 경로에 맞는 페이지 타이틀과 마스킹 토글, 환경 설정 링크가 렌더링되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '자산 현황' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /마스킹/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /환경 설정/i })).toHaveAttribute('href', '/m/settings');
  });

  it('마스킹 토글 버튼 클릭 시 마스킹 상태 아이콘이 전환되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole('button', { name: /마스킹/i });
    expect(screen.getByTestId('masking-icon-visible')).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('masking-icon-hidden')).toBeInTheDocument();
  });

  it('페이지에서 새로고침 핸들러를 등록하면 헤더 새로고침 버튼이 노출되고 클릭 시 호출되어야 한다', () => {
    const onRefresh = vi.fn();
    render(
      <MemoryRouter initialEntries={['/m/assets']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
            <RefreshRegistrar onRefresh={onRefresh} />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '보유 자산' })).toBeInTheDocument();
    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('/m/settings 경로에서는 뒤로 가기 버튼과 환경 설정 타이틀이 렌더링되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/m/settings']}>
        <MaskingProvider>
          <MobileHeaderProvider>
            <MobileHeader />
          </MobileHeaderProvider>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '환경 설정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /뒤로 가기/i })).toBeInTheDocument();
  });
});
