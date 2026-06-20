import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 경로별 탭 타이틀 매핑 정보
 */
const TITLE_MAP = {
  '/': '대시보드',
  '/dashboard': '대시보드',
  '/benchmark': '벤치마크 비교',
  '/benchmark/compare-returns': '수익률 비교 분석',
  '/ratios/check': '비중 점검',
  '/db': '마스터 관리',
  '/db/snapshots/new': '스냅샷 생성',
  '/connection': 'API 연결 관리'
};

/**
 * 라우트 경로 변경을 감지하여 브라우저 탭 타이틀(document.title)을 업데이트하는 컴포넌트입니다.
 * 
 * Returns:
 *     null: 렌더링 요소가 없는 기능성 컴포넌트
 */
const TitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = TITLE_MAP[location.pathname];
    if (pageTitle) {
      document.title = `AssetManager - ${pageTitle}`;
    } else {
      document.title = 'AssetManager';
    }
  }, [location]);

  return null;
};

export default TitleManager;
