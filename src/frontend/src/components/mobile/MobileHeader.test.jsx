import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileHeader from './MobileHeader';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileHeader', () => {
  it('앱 타이틀과 마스킹 토글 버튼, 서버 상태 인디케이터가 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileHeader />
      </MaskingProvider>
    );

    expect(screen.getByText('AssetManager')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /마스킹/i })).toBeInTheDocument();
    expect(screen.getByTestId('server-status-indicator')).toBeInTheDocument();
  });

  it('마스킹 토글 버튼 클릭 시 마스킹 상태 아이콘/라벨이 전환되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileHeader />
      </MaskingProvider>
    );

    const toggleBtn = screen.getByRole('button', { name: /마스킹/i });
    expect(screen.getByTestId('masking-icon-visible')).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('masking-icon-hidden')).toBeInTheDocument();
  });
});
