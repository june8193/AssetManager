import React from 'react';
import ExchangeRateForm from '../ExchangeRateForm';

/**
 * 환율 관리 탭 컴포넌트입니다.
 * 기존 ExchangeRateForm을 감싸서 DB 관리 페이지의 탭 인터페이스에 맞게 배치합니다.
 */
const ExchangeRatesTab = () => {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-headline">환율 데이터 관리</h2>
        <p className="text-slate-500 text-sm mt-1">자산 가치 계산을 위한 일자별 환율(USD/KRW) 데이터를 관리합니다.</p>
      </div>
      <ExchangeRateForm />
    </div>
  );
};

export default ExchangeRatesTab;
