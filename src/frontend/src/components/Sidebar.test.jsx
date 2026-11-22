import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';
import { MaskingProvider } from '../contexts/MaskingContext';

/**
 * Sidebar 컴포넌트 테스트
 */
describe('Sidebar Component', () => {
  const renderSidebar = () => {
    return render(
      <BrowserRouter>
        <MaskingProvider>
          <Sidebar />
        </MaskingProvider>
      </BrowserRouter>
    );
  };

  it('사이드바가 정상적으로 렌더링되어야 한다', () => {
    renderSidebar();
    expect(screen.getByText('AssetManager')).toBeInTheDocument();
  });

  it('토글 버튼 클릭 시 사이드바가 접히고 펼쳐져야 한다', () => {
    renderSidebar();
    
    // 초기 상태는 열려 있음 (텍스트가 보임)
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    
    // 토글 버튼 클릭 (접기)
    const toggleButton = screen.getByLabelText('사이드바 접기');
    fireEvent.click(toggleButton);
    
    // 텍스트가 사라졌는지 확인 (컴포넌트 구현상 isOpen이 false면 텍스트가 렌더링되지 않음)
    expect(screen.queryByText('대시보드')).not.toBeInTheDocument();
    
    // 토글 버튼 클릭 (펼치기)
    const openButton = screen.getByLabelText('사이드바 펼치기');
    fireEvent.click(openButton);
    
    // 다시 텍스트가 나타남
    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });

  it('모든 메뉴 항목이 지정된 순서대로 렌더링되어야 한다', () => {
    renderSidebar();
    const expectedMenus = [
      '대시보드',
      '지출 관리',
      '비중 점검',
      '시장분석',
      '리스크 관리',
      '배당 분석',
      '시뮬레이션',
      'DB 관리',
      '서버 점검'
    ];

    const nav = screen.getByRole('navigation', { name: '메인 메뉴' });
    const topLevelItems = Array.from(nav.querySelectorAll(':scope > a, :scope > button'));
    const actualMenus = topLevelItems.map(el => el.textContent.trim());

    expect(actualMenus).toEqual(expectedMenus);
  });

  it('시장분석 메뉴 클릭 시 하위 메뉴가 지정된 순서대로 표시되어야 한다', () => {
    renderSidebar();

    // 초기에는 하위 메뉴가 보이지 않음
    expect(screen.queryByText('지수분석')).not.toBeInTheDocument();

    // 시장분석 클릭
    const marketMenu = screen.getByText('시장분석');
    fireEvent.click(marketMenu);

    // 하위 메뉴 순서 검증
    const nav = screen.getByRole('navigation', { name: '메인 메뉴' });
    const subMenuLinks = Array.from(nav.querySelectorAll(':scope > div a'));
    const actualSubMenus = subMenuLinks.map(el => el.textContent.trim());

    expect(actualSubMenus).toEqual([
      '지수분석',
      '종목분석',
      '벤치마크 비교',
      '수익률 비교 분석'
    ]);
  });

  it('DB 관리 메뉴 클릭 시 하위 메뉴가 표시되어야 한다', () => {
    renderSidebar();
    
    // 초기에는 하위 메뉴가 보이지 않음
    expect(screen.queryByText('마스터 관리')).not.toBeInTheDocument();
    
    // DB 관리 클릭
    const dbMenu = screen.getByText('DB 관리');
    fireEvent.click(dbMenu);
    
    // 하위 메뉴가 나타남
    expect(screen.getByText('마스터 관리')).toBeInTheDocument();
    expect(screen.getByText('스냅샷 생성')).toBeInTheDocument();
    expect(screen.getByText('관심종목/섹터 관리')).toBeInTheDocument();
  });

  it('사이드바가 접힌 상태에서 DB 관리 클릭 시 사이드바가 펼쳐지고 하위 메뉴가 보여야 한다', () => {
    renderSidebar();
    
    // 사이드바 접기
    const toggleButton = screen.getByLabelText('사이드바 접기');
    fireEvent.click(toggleButton);
    expect(screen.queryByText('대시보드')).not.toBeInTheDocument();
    
    // DB 관리 아이콘 클릭 (title로 찾음)
    const dbMenuIcon = screen.getByTitle('DB 관리');
    fireEvent.click(dbMenuIcon);
    
    // 사이드바가 펼쳐졌는지 확인
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    
    // 하위 메뉴가 나타남
    expect(screen.getByText('마스터 관리')).toBeInTheDocument();
  });

  it('모자이크 모드 버튼 클릭 시 텍스트가 변경되어야 한다', () => {
    renderSidebar();
    
    // 초기 상태 확인
    expect(screen.getByText('모자이크 설정')).toBeInTheDocument();
    
    // 모자이크 설정 클릭
    fireEvent.click(screen.getByText('모자이크 설정'));
    
    // 텍스트가 변경되었는지 확인
    expect(screen.getByText('모자이크 해제')).toBeInTheDocument();
    
    // 다시 클릭하여 복구
    fireEvent.click(screen.getByText('모자이크 해제'));
    expect(screen.getByText('모자이크 설정')).toBeInTheDocument();
  });
});