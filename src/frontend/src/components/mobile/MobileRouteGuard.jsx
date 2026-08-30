import { Navigate, useLocation } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';

/**
 * 모바일 허용 경로 판별 함수
 * @param {string} pathname - 현재 URL 경로
 * @returns {boolean}
 */
export function isAllowedMobilePath(pathname) {
  if (!pathname) return true;
  if (pathname === '/' || pathname === '/dashboard') return true;
  if (pathname.startsWith('/m/') || pathname === '/m') return true;
  return false;
}

/**
 * 모바일 라우트 가드 컴포넌트
 * 모바일 환경에서 데스크톱 전용 관리 URL(/db, /system/*, /benchmark 등)로 접근 시
 * 안전하게 모바일 메인(/)으로 자동 리다이렉트 처리
 */
export default function MobileRouteGuard({ children, isMobile: propIsMobile }) {
  const hookIsMobile = useIsMobile();
  const isMobile = propIsMobile !== undefined ? propIsMobile : hookIsMobile;
  const location = useLocation();

  if (isMobile && !isAllowedMobilePath(location.pathname)) {
    return <Navigate to="/" replace state={{ redirectedFrom: location.pathname }} />;
  }

  return children;
}
