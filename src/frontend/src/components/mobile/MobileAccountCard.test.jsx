import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileAccountCard from './MobileAccountCard';
import { MaskingProvider } from '../../contexts/MaskingContext';

describe('MobileAccountCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockAccount = {
    id: 1,
    name: '5526-9093',
    provider: 'KB증권',
    alias: '주식계좌',
    total_valuation_krw: 50000000,
    assets: [
      {
        id: 101,
        ticker: '005930',
        name: '삼성전자',
        category: '국내주식',
        country: 'KR',
        quantity: 500,
        price: 70000,
        valuation_krw: 35000000,
      },
      {
        id: 102,
        ticker: 'KRW',
        name: '원화예수금',
        category: 'CASH',
        country: 'KR',
        quantity: 15000000,
        price: 1,
        valuation_krw: 15000000,
      },
    ],
  };

  it('계좌 헤더(이름, 기관명, 별칭, 총 평가금액, 예수금)가 올바르게 렌더링되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileAccountCard account={mockAccount} />
      </MaskingProvider>
    );

    expect(screen.getByText('KB증권')).toBeInTheDocument();
    expect(screen.getByText('5526-9093')).toBeInTheDocument();
    expect(screen.getByText('주식계좌')).toBeInTheDocument();
    expect(screen.getByText('50,000,000')).toBeInTheDocument();
    // 예수금 15,000,000원 표시 확인
    expect(screen.getByText(/15,000,000/)).toBeInTheDocument();
  });

  it('기본 상태에서는 종목 상세 목록이 접혀있고, 클릭 시 아코디언이 펼쳐져 보유 종목이 표시되어야 한다', () => {
    render(
      <MaskingProvider>
        <MobileAccountCard account={mockAccount} />
      </MaskingProvider>
    );

    // 기본적으로 종목명은 노출되지 않음
    expect(screen.queryByText('삼성전자')).not.toBeInTheDocument();

    // 카드 헤더 클릭 -> 아코디언 펼침
    const cardHeader = screen.getByRole('button', { name: /5526-9093/i });
    fireEvent.click(cardHeader);

    // 보유 종목 정보 노출 확인
    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.getByText('005930')).toBeInTheDocument();
    expect(screen.getByText('35,000,000')).toBeInTheDocument();

    // 다시 클릭 시 접힘
    fireEvent.click(cardHeader);
    expect(screen.queryByText('삼성전자')).not.toBeInTheDocument();
  });

  it('보유 종목이 없는 계좌의 경우 펼쳤을 때 빈 상태 메시지가 표시되어야 한다', () => {
    const emptyAccount = {
      id: 2,
      name: '1234-5678',
      provider: '신한은행',
      alias: '입출금통장',
      total_valuation_krw: 0,
      assets: [],
    };

    render(
      <MaskingProvider>
        <MobileAccountCard account={emptyAccount} />
      </MaskingProvider>
    );

    const cardHeader = screen.getByRole('button', { name: /1234-5678/i });
    fireEvent.click(cardHeader);

    expect(screen.getByText(/보유 종목이 없습니다/i)).toBeInTheDocument();
  });

  it('마스킹 활성화 시 계좌명, 총 평가금액, 예수금, 종목 수량 및 평가액이 마스킹(***)되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');

    render(
      <MaskingProvider>
        <MobileAccountCard account={mockAccount} />
      </MaskingProvider>
    );

    // 마스킹 처리 확인
    expect(screen.queryByText('50,000,000')).not.toBeInTheDocument();
    expect(screen.queryByText('5526-9093')).not.toBeInTheDocument();
    const maskedElements = screen.getAllByText('***');
    expect(maskedElements.length).toBeGreaterThanOrEqual(1);

    // 아코디언 펼침
    const cardHeader = screen.getByRole('button', { name: /계좌 상세/i });
    fireEvent.click(cardHeader);

    expect(screen.getByText('삼성전자')).toBeInTheDocument();
    expect(screen.queryByText('35,000,000')).not.toBeInTheDocument();
  });

  it('CUD(추가, 수정, 삭제) 관련 버튼이 전혀 노출되지 않아야 한다', () => {
    render(
      <MaskingProvider>
        <MobileAccountCard account={mockAccount} />
      </MaskingProvider>
    );

    expect(screen.queryByRole('button', { name: /추가/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /수정/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /삭제/i })).not.toBeInTheDocument();
  });
});
