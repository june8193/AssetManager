import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileMarketPage from './MobileMarketPage';
import { MaskingProvider } from '../../contexts/MaskingContext';

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/m/market']}>
      <MaskingProvider>
        <MobileMarketPage />
      </MaskingProvider>
    </MemoryRouter>
  );
}

describe('MobileMarketPage', () => {
  it('헤더와 기본 서브 탭([시장 지수], [포트폴리오 비교])이 올바르게 렌더링되어야 한다', () => {
    renderComponent();

    // 페이지 헤더
    expect(screen.getByRole('heading', { name: /지수분석/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /새로고침/i })).toBeInTheDocument();

    // 서브 탭 스위처 버튼들
    const marketTabBtn = screen.getByRole('tab', { name: /시장 지수/i });
    const compareTabBtn = screen.getByRole('tab', { name: /포트폴리오 비교/i });

    expect(marketTabBtn).toBeInTheDocument();
    expect(compareTabBtn).toBeInTheDocument();

    // 기본 활성 탭은 '시장 지수'
    expect(marketTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(compareTabBtn).toHaveAttribute('aria-selected', 'false');

    // 시장 지수 뷰의 쉘/컨테이너 표시 확인
    expect(screen.getByTestId('market-indices-view')).toBeInTheDocument();
  });

  it('[포트폴리오 비교] 탭을 클릭하면 서브 탭 활성화가 전환되고 해당 뷰가 렌더링되어야 한다', () => {
    renderComponent();

    const compareTabBtn = screen.getByRole('tab', { name: /포트폴리오 비교/i });
    const marketTabBtn = screen.getByRole('tab', { name: /시장 지수/i });

    // 포트폴리오 비교 탭 클릭
    fireEvent.click(compareTabBtn);

    expect(compareTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(marketTabBtn).toHaveAttribute('aria-selected', 'false');

    // 포트폴리오 비교 뷰 컨테이너 표시 확인
    expect(screen.getByTestId('portfolio-comparison-view')).toBeInTheDocument();
    expect(screen.queryByTestId('market-indices-view')).not.toBeInTheDocument();

    // 다시 시장 지수 탭 클릭 시 정상 복귀
    fireEvent.click(marketTabBtn);

    expect(marketTabBtn).toHaveAttribute('aria-selected', 'true');
    expect(compareTabBtn).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('market-indices-view')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-comparison-view')).not.toBeInTheDocument();
  });

  it('새로고침 버튼 클릭 시 최신화 토스트 알림이 표시되어야 한다', async () => {
    renderComponent();

    const refreshBtn = screen.getByRole('button', { name: /새로고침/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByTestId('market-toast')).toBeInTheDocument();
      expect(screen.getByTestId('market-toast')).toHaveTextContent('지수 및 시장 데이터가 최신화되었습니다.');
    });
  });

  it('마스킹이 활성화되었을 때 포트폴리오 수익률 수치가 마스킹되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');
    try {
      renderComponent();

      const compareTabBtn = screen.getByRole('tab', { name: /포트폴리오 비교/i });
      fireEvent.click(compareTabBtn);

      const maskedEl = screen.getByTestId('masked-return');
      expect(maskedEl).toHaveTextContent('***');
    } finally {
      localStorage.removeItem('isMasked');
    }
  });
});
