import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, Server, Database } from 'lucide-react';

const ConnectionPage = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/connection/test');
      const data = await response.json();
      if (response.ok) {
        setResults(data.data);
      } else {
        setError(data.detail || 'API 연결 테스트 중 알 수 없는 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요. (기본 포트: 8000)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 p-8 bg-gradient-to-br from-slate-900 to-indigo-900 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -m-12 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-4xl font-extrabold font-headline tracking-tight mb-3">
              API 연결 관리
            </h1>
            <p className="text-indigo-100 max-w-xl text-lg opacity-90">
              등록된 키움증권 계정들의 인증 상태와 서버 연결 가능 여부를 실시간으로 통합 점검합니다.
            </p>
          </div>
          <button
            onClick={runTest}
            disabled={loading}
            className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center gap-3 shadow-lg ${
              loading 
                ? 'bg-white/10 text-white/50 cursor-not-allowed' 
                : 'bg-white text-indigo-900 hover:bg-indigo-50 active:scale-95'
            }`}
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
            {loading ? '테스트 진행 중...' : '전체 연결 테스트 시작'}
          </button>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-red-50 border border-red-100 rounded-2xl text-red-700 flex items-center gap-4 shadow-sm"
        >
          <AlertCircle className="shrink-0" size={28} />
          <div>
            <p className="font-bold text-lg">오류가 발생했습니다</p>
            <p className="opacity-80">{error}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results ? (
          results.map((res, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-1 rounded-3xl transition-all shadow-md hover:shadow-xl ${
                res.api_success ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-rose-400 to-orange-500'
              }`}
            >
              <div className="bg-white rounded-[22px] p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${res.api_success ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        <Server size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-slate-800">{res.broker}</h3>
                        <p className="text-slate-500 font-medium">{res.account}</p>
                      </div>
                    </div>
                    {res.api_success ? (
                      <CheckCircle2 className="text-emerald-500" size={32} />
                    ) : (
                      <XCircle className="text-rose-500" size={32} />
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm py-2 border-b border-slate-50">
                      <span className="text-slate-400">인증 토큰 발급</span>
                      <span className={`font-bold ${res.token_success ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {res.token_success ? '성공' : '실패'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-slate-50">
                      <span className="text-slate-400">연결 계좌 번호</span>
                      <span className="font-mono font-bold text-slate-700">
                        {res.acct_no || '미조회'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl text-sm font-medium ${res.api_success ? 'bg-emerald-50/50 text-emerald-700' : 'bg-rose-50/50 text-rose-700'}`}>
                   {res.message}
                </div>
              </div>
            </motion.div>
          ))
        ) : !loading && (
          <div className="col-span-full py-20 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-4 text-slate-400">
              <Database size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-400">테스트를 시작하려면 상단 버튼을 클릭해 주세요</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionPage;
