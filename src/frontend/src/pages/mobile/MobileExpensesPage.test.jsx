import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobileExpensesPage from './MobileExpensesPage';

describe('MobileExpensesPage', () => {
  it('페이지 헤더와 지출 관리 타이틀이 정상적으로 렌더링되어야 한다', () => {
    render(<MobileExpensesPage />);

    expect(screen.getByRole('heading', { level: 1, name: /지출 관리/i })).toBeInTheDocument();
    expect(screen.getByText(/월별 및 다기간 지출 내역과 소비 패턴을 분석합니다/i)).toBeInTheDocument();
  });

  it('준비 중 안내 메시지 및 스켈레톤 UI가 렌더링되어야 한다', () => {
    render(<MobileExpensesPage />);

    expect(screen.getByRole('heading', { level: 2, name: /지출 관리 화면 준비 중/i })).toBeInTheDocument();
    expect(screen.getByText(/모바일 전용 지출 요약 카드, 기간별 지출 추이 및 거래 내역 상세 기능이 곧 제공됩니다/i)).toBeInTheDocument();
  });
});
