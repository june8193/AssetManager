import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

/**
 * Sidebar 컴포넌트 테스트
 */
describe('Sidebar Component', () => {
  const renderSidebar = (isConnected = true) => {
    return render(
      <BrowserRouter>
        <Sidebar isConnected={isConnected} />
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

  it('연결 상태(isConnected)에 따라 적절한 메시지를 표시해야 한다', () => {
    const { rerender } = renderSidebar(true);
    expect(screen.getByText('실시간 연동 중')).toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <Sidebar isConnected={false} />
      </BrowserRouter>
    );
    expect(screen.getByText('연결 끊김')).toBeInTheDocument();
  });

  it('모든 메뉴 항목이 렌더링되어야 한다', () => {
    renderSidebar();
    const expectedMenus = [
      '대시보드',
      '관심종목(국내)',
      '관심종목(미국)',
      'API 연결 관리',
      'DB 관리'
    ];
    
    expectedMenus.forEach(menu => {
      expect(screen.getByText(menu)).toBeInTheDocument();
    });
  });
});