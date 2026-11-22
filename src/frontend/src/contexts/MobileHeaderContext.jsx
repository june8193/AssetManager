import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const MobileHeaderContext = createContext(null);

export const MOBILE_TABS = [
  { name: '홈', path: '/', title: '자산 현황', matchPaths: ['/', '/dashboard', '/m/dashboard'] },
  { name: '자산', path: '/m/assets', title: '보유 자산', prefix: '/m/assets' },
  { name: '지출', path: '/m/expenses', title: '지출 관리', prefix: '/m/expenses' },
  { name: '시장', path: '/m/market', title: '시장 지수', prefix: '/m/market' },
  { name: '비중', path: '/m/ratios', title: '비중 점검', prefix: '/m/ratios' },
];

/**
 * 현재 경로가 특정 모바일 탭에 해당하는지 판별합니다.
 *
 * @param {Object} tab - MOBILE_TABS 항목
 * @param {string} pathname - 현재 URL 경로
 * @returns {boolean}
 */
export function isMobileTabActive(tab, pathname) {
  if (!pathname) return tab.path === '/';
  if (tab.matchPaths) return tab.matchPaths.includes(pathname);
  if (tab.prefix) return pathname.startsWith(tab.prefix);
  return pathname === tab.path;
}

/**
 * 경로별 모바일 단일 헤더 타이틀 매핑
 *
 * @param {string} pathname - 현재 URL 경로
 * @returns {string} 헤더에 표시할 페이지 제목
 */
export function getMobilePageTitle(pathname) {
  if (pathname?.startsWith('/m/settings')) return '환경 설정';
  const matchedTab = MOBILE_TABS.find((tab) => isMobileTabActive(tab, pathname));
  return matchedTab ? matchedTab.title : '자산 현황';
}

/**
 * 모바일 단일 헤더 상태 컨텍스트 프로바이더
 * - 현재 경로에 맞는 페이지 제목 제공
 * - 활성 페이지의 새로고침 콜백과 갱신 상태(isRefreshing) 연동
 */
export function MobileHeaderProvider({ children }) {
  const location = useLocation();
  const [refreshState, setRefreshState] = useState({
    onRefresh: null,
    isRefreshing: false,
  });

  const setRefreshHandler = useCallback((onRefresh, isRefreshing) => {
    setRefreshState({
      onRefresh: onRefresh || null,
      isRefreshing: Boolean(isRefreshing),
    });
  }, []);

  const clearRefreshHandler = useCallback(() => {
    setRefreshState({
      onRefresh: null,
      isRefreshing: false,
    });
  }, []);

  const title = getMobilePageTitle(location.pathname);

  return (
    <MobileHeaderContext.Provider
      value={{
        title,
        pathname: location.pathname,
        onRefresh: refreshState.onRefresh,
        isRefreshing: refreshState.isRefreshing,
        setRefreshHandler,
        clearRefreshHandler,
      }}
    >
      {children}
    </MobileHeaderContext.Provider>
  );
}

/**
 * 모바일 헤더 컨텍스트 훅
 * - Provider 외부에서 호출 시 안전한 기본값 반환
 */
export function useMobileHeader() {
  const ctx = useContext(MobileHeaderContext);
  if (!ctx) {
    return {
      title: '자산 현황',
      pathname: '/',
      onRefresh: null,
      isRefreshing: false,
      setRefreshHandler: () => {},
      clearRefreshHandler: () => {},
    };
  }
  return ctx;
}

/**
 * 페이지 컴포넌트에서 단일 헤더의 새로고침 버튼을 연동하기 위한 훅
 *
 * @param {Function | null} onRefresh - 새로고침 실행 콜백
 * @param {boolean} isRefreshing - 현재 갱신 진행 여부
 */
export function useMobileHeaderRefresh(onRefresh, isRefreshing = false) {
  const ctx = useContext(MobileHeaderContext);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setRefreshHandler = ctx?.setRefreshHandler;
  const clearRefreshHandler = ctx?.clearRefreshHandler;

  useEffect(() => {
    if (!setRefreshHandler || !clearRefreshHandler) return;
    if (!onRefreshRef.current) {
      clearRefreshHandler();
      return;
    }

    const wrappedRefresh = () => onRefreshRef.current?.();
    setRefreshHandler(wrappedRefresh, isRefreshing);

    return () => {
      clearRefreshHandler();
    };
  }, [setRefreshHandler, clearRefreshHandler, isRefreshing]);
}
