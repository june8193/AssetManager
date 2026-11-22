import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileLayout', () => {
  it('단일 상단 헤더, 하단 5탭 바, 그리고 본문 자식 요소가 정상 렌더링되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MaskingProvider>
          <MobileLayout>
            <div data-testid="mobile-content">모바일 본문 테스트</div>
          </MobileLayout>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '자산 현황' })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /환경 설정/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^홈$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^자산$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^지출$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^시장$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^비중$/i })).toBeInTheDocument();
  });
});
