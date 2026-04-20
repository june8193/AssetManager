import React from 'react';
import ExchangeRateForm from '../components/ExchangeRateForm';
import { Database } from 'lucide-react';

const DataInputPage = () => {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 p-6 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -m-16 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
        <h1 className="text-3xl font-bold font-headline tracking-tight mb-2 relative z-10 flex items-center gap-3">
          <Database size={32} className="text-blue-300" />
          정보 입력
        </h1>
        <p className="text-blue-200 max-w-2xl text-sm relative z-10">
          자산 관리에 필요한 수동 데이터들을 입력합니다. 
          현재는 일자별 환율 입력을 지원하며, 추후 거래 내역 수동 입력 기능이 추가될 예정입니다.
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 font-headline">환율 데이터 관리</h2>
          </div>
          <ExchangeRateForm />
        </section>
        
        {/* 추후 여기에 거래내역 입력 섹션 등이 추가될 수 있음 */}
      </div>
    </main>
  );
};

export default DataInputPage;
