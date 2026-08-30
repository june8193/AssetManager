import { useState, useEffect } from 'react';

/**
 * 모바일 뷰포트 너비(< 768px) 또는 PWA Standalone 실행 환경 여부를 감지하는 훅
 *
 * @returns {boolean} 모바일 환경 여부 (true: 모바일 / false: 데스크톱)
 */
export function useIsMobile() {
  const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;

    const isSmallScreen = window.innerWidth < 768;
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator?.standalone === true;

    return isSmallScreen || Boolean(isStandalone);
  };

  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };

    window.addEventListener('resize', handleResize);

    const mediaQueryList = window.matchMedia ? window.matchMedia('(display-mode: standalone)') : null;
    const handleMediaChange = () => {
      setIsMobile(checkIsMobile());
    };

    if (mediaQueryList?.addEventListener) {
      mediaQueryList.addEventListener('change', handleMediaChange);
    } else if (mediaQueryList?.addListener) {
      mediaQueryList.addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mediaQueryList?.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleMediaChange);
      } else if (mediaQueryList?.removeListener) {
        mediaQueryList.removeListener(handleMediaChange);
      }
    };
  }, []);

  return isMobile;
}

export default useIsMobile;
