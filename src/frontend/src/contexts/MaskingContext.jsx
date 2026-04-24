import React, { createContext, useContext, useState, useEffect } from 'react';

const MaskingContext = createContext();

/**
 * 자산 정보 마스킹(모자이크 모드) 상태를 관리하는 Provider입니다.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export const MaskingProvider = ({ children }) => {
  const [isMasked, setIsMasked] = useState(() => {
    // localStorage에서 초기 상태 로드
    const saved = localStorage.getItem('isMasked');
    return saved === 'true';
  });

  useEffect(() => {
    // 상태 변경 시 localStorage에 저장
    localStorage.setItem('isMasked', isMasked);
  }, [isMasked]);

  const toggleMasking = () => setIsMasked(prev => !prev);

  /**
   * 마스킹 설정에 따라 값을 마스킹하거나 원본 포맷팅된 값을 반환합니다.
   * 
   * @param {string|number} value - 표시할 값
   * @param {boolean} force - 마스킹 여부를 강제할 때 사용 (기본값 false)
   * @returns {string} 마스킹된 문자열 또는 원본 값
   */
  const maskValue = (value, force = false) => {
    if (isMasked || force) {
      return '***';
    }
    return value;
  };

  return (
    <MaskingContext.Provider value={{ isMasked, toggleMasking, maskValue }}>
      {children}
    </MaskingContext.Provider>
  );
};

/**
 * 마스킹 상태 및 유틸리티 함수를 사용하기 위한 Hook입니다.
 */
export const useMasking = () => {
  const context = useContext(MaskingContext);
  if (!context) {
    throw new Error('useMasking must be used within a MaskingProvider');
  }
  return context;
};
