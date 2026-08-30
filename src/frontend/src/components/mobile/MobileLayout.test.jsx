import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileLayout from './MobileLayout';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileLayout', () => {
  it('상단 헤더, 하단 탭 바, 그리고 본문 자식 요소가 정상 렌더링되어야 한다', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <MaskingProvider>
          <MobileLayout>
            <div data-testid="mobile-content">모바일 본문 테스트</div>
          </MobileLayout>
        </MaskingProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('AssetManager')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /대시보드/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /설정/i })).toBeInTheDocument();
  });
});
