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

  it('아코디언을 펼쳤을 때 종목들이 평가금액(valuation_krw) 내림차순으로 정렬되어 렌더링되어야 한다', () => {
    const unsortedAccount = {
      id: 3,
      name: '111-222',
      provider: '토스증권',
      alias: '테스트계좌',
      total_valuation_krw: 60000000,
      assets: [
        { id: 1, name: '카카오', ticker: '035720', valuation_krw: 5000000, quantity: 100, price: 50000 },
        { id: 2, name: '삼성전자', ticker: '005930', valuation_krw: 35000000, quantity: 500, price: 70000 },
        { id: 3, name: '원화예수금', ticker: 'KRW', category: 'CASH', valuation_krw: 15000000, quantity: 15000000, price: 1 },
        { id: 4, name: '테슬라', ticker: 'TSLA', country: 'US', valuation_krw: 50000000, quantity: 200, price: 250 },
      ],
    };

    render(
      <MaskingProvider>
        <MobileAccountCard account={unsortedAccount} />
      </MaskingProvider>
    );

    const cardHeader = screen.getByRole('button', { name: /111-222/i });
    fireEvent.click(cardHeader);

    // 종목명 텍스트 요소들의 순서 검증
    const renderedNames = screen.getAllByText(/테슬라|삼성전자|원화예수금|카카오/).map((el) => el.textContent);
    // 내림차순 기대 순서: 테슬라(50,000,000) -> 삼성전자(35,000,000) -> 원화예수금(15,000,000) -> 카카오(5,000,000)
    expect(renderedNames).toEqual(['테슬라', '삼성전자', '원화예수금', '카카오']);
  });

  it('평가금액이 동일한 경우 종목명(name) 오름차순(localeCompare)으로 정렬되어야 한다', () => {
    const tieAccount = {
      id: 4,
      name: '333-444',
      provider: '미래에셋',
      alias: '동일평가액계좌',
      total_valuation_krw: 30000000,
      assets: [
        { id: 1, name: '현대차', ticker: '005380', valuation_krw: 10000000, quantity: 50, price: 200000 },
        { id: 2, name: '카카오', ticker: '035720', valuation_krw: 10000000, quantity: 200, price: 50000 },
        { id: 3, name: '삼성전자', ticker: '005930', valuation_krw: 10000000, quantity: 100, price: 100000 },
      ],
    };

    render(
      <MaskingProvider>
        <MobileAccountCard account={tieAccount} />
      </MaskingProvider>
    );

    const cardHeader = screen.getByRole('button', { name: /333-444/i });
    fireEvent.click(cardHeader);

    const renderedNames = screen.getAllByText(/삼성전자|카카오|현대차/).map((el) => el.textContent);
    // 가나다 오름차순: '삼성전자' -> '카카오' -> '현대차'
    expect(renderedNames).toEqual(['삼성전자', '카카오', '현대차']);
  });

  it('valuation_krw가 null 또는 undefined인 자산도 0원으로 안전하게 처리되어 정렬되어야 한다', () => {
    const invalidValuationAccount = {
      id: 5,
      name: '555-666',
      provider: '한국투자',
      total_valuation_krw: 10000000,
      assets: [
        { id: 1, name: '기타주식B', ticker: '999992', valuation_krw: null, quantity: 10, price: 0 },
        { id: 2, name: '주력주식', ticker: '005930', valuation_krw: 10000000, quantity: 100, price: 100000 },
        { id: 3, name: '기타주식A', ticker: '999991', valuation_krw: undefined, quantity: 5, price: 0 },
      ],
    };

    render(
      <MaskingProvider>
        <MobileAccountCard account={invalidValuationAccount} />
      </MaskingProvider>
    );

    const cardHeader = screen.getByRole('button', { name: /555-666/i });
    fireEvent.click(cardHeader);

    const renderedNames = screen.getAllByText(/주력주식|기타주식A|기타주식B/).map((el) => el.textContent);
    expect(renderedNames).toEqual(['주력주식', '기타주식A', '기타주식B']);
  });

  it('원본 assets 배열을 직접 수정(mutate)하지 않아야 한다', () => {
    const originalAssets = [
      { id: 1, name: '카카오', ticker: '035720', valuation_krw: 5000000 },
      { id: 2, name: '삼성전자', ticker: '005930', valuation_krw: 35000000 },
    ];
    const accountCopy = {
      id: 6,
      name: '777-888',
      provider: '키움증권',
      assets: originalAssets,
    };

    render(
      <MaskingProvider>
        <MobileAccountCard account={accountCopy} />
      </MaskingProvider>
    );

    const cardHeader = screen.getByRole('button', { name: /777-888/i });
    fireEvent.click(cardHeader);

    // 원본 배열 순서는 그대로 유지되는지 검증
    expect(originalAssets[0].name).toBe('카카오');
    expect(originalAssets[1].name).toBe('삼성전자');
  });

  it('마스킹 모드가 켜져 있어도 정렬 순서가 올바르게 유지되어야 한다', () => {
    localStorage.setItem('isMasked', 'true');
    const unsortedAccount = {
      id: 7,
      name: '999-000',
      provider: '토스증권',
      assets: [
        { id: 1, name: '종목B', ticker: '000002', valuation_krw: 1000000 },
        { id: 2, name: '종목A', ticker: '000001', valuation_krw: 5000000 },
      ],
    };

    render(
      <MaskingProvider>
        <MobileAccountCard account={unsortedAccount} />
      </MaskingProvider>
    );

    const cardHeader = screen.getByRole('button', { name: /계좌 상세/i });
    fireEvent.click(cardHeader);

    const renderedNames = screen.getAllByText(/종목A|종목B/).map((el) => el.textContent);
    expect(renderedNames).toEqual(['종목A', '종목B']);
  });
});
