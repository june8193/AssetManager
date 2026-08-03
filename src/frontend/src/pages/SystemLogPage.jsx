import React, { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Search, Play, Pause, AlertCircle } from 'lucide-react';

/**
 * 시스템 로그 보기 컴포넌트
 * 서버 PC의 백엔드/PM2 시스템 로그 파일 조회, 필터링(레벨/키워드), Tailing 라인 조절 및 실시간 Polling을 제공합니다.
 */
const SystemLogPage = () => {
  const [logFileList, setLogFileList] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [logLinesResult, setLogLinesResult] = useState([]);
  const [totalMatchingLines, setTotalMatchingLines] = useState(0);

  // 필터 옵션
  const [tailLineLimit, setTailLineLimit] = useState(100);
  const [logLevelFilter, setLogLevelFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [autoRefreshStatus, setAutoRefreshStatus] = useState(false);

  // 로딩 & 에러
  const [pageLoadingStatus, setPageLoadingStatus] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState(null);

  // 로그 파일 목록 가져오기 (useCallback 의존성 최적화)
  const fetchLogFileList = useCallback(async () => {
    try {
      setPageLoadingStatus(true);
      setPageErrorMessage(null);
      const response = await fetch('/api/v1/system/logs/files');
      if (!response.ok) throw new Error('로그 파일 목록을 불러오지 못했습니다.');
      const data = await response.json();
      setLogFileList(data);

      setSelectedFileName((prev) => prev || (data[0] ? data[0].name : ''));
    } catch (err) {
      setPageErrorMessage(err.message);
    } finally {
      setPageLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchLogFileList();
  }, [fetchLogFileList]);

  // 선택 로그 내용 가져오기
  const fetchLogContent = useCallback(async () => {
    if (!selectedFileName) return;
    try {
      setPageLoadingStatus(true);
      setPageErrorMessage(null);

      const params = new URLSearchParams({
        filename: selectedFileName,
        lines: tailLineLimit.toString(),
      });
      if (logLevelFilter) params.append('level', logLevelFilter);
      if (searchKeyword) params.append('keyword', searchKeyword);

      const response = await fetch(`/api/v1/system/logs/content?${params.toString()}`);
      if (!response.ok) throw new Error('로그 내용을 읽어오지 못했습니다.');
      const data = await response.json();

      setLogLinesResult(data.lines || []);
      setTotalMatchingLines(data.total_lines || 0);
    } catch (err) {
      setPageErrorMessage(err.message);
    } finally {
      setPageLoadingStatus(false);
    }
  }, [selectedFileName, tailLineLimit, logLevelFilter, searchKeyword]);

  useEffect(() => {
    fetchLogContent();
  }, [fetchLogContent]);

  // 키워드 검색 제출 핸들러
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    fetchLogContent();
  };

  // 실시간 폴링 (Auto Refresh)
  useEffect(() => {
    let intervalId = null;
    if (autoRefreshStatus && selectedFileName) {
      intervalId = setInterval(() => {
        fetchLogContent();
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefreshStatus, selectedFileName, fetchLogContent]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">시스템 로그 보기</h1>
            <p className="text-xs text-slate-500">서버 PC 시스템/백엔드 로그 실시간 Tailing 및 필터링</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefreshStatus(!autoRefreshStatus)}
            aria-label={autoRefreshStatus ? '자동 갱신 중지' : '자동 갱신 시작'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              autoRefreshStatus ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {autoRefreshStatus ? <Pause size={14} /> : <Play size={14} />}
            {autoRefreshStatus ? '자동 갱신 중 (3초)' : '자동 갱신 시작'}
          </button>

          <button
            onClick={fetchLogContent}
            aria-label="로그 파일 새로고침"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            <RefreshCw size={14} className={pageLoadingStatus ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {pageErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{pageErrorMessage}</span>
        </div>
      )}

      {/* 툴바 / 필터 조건 */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* 파일 선택 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="log-file-select" className="text-xs font-semibold text-slate-600">
            로그 파일 선택
          </label>
          <select
            id="log-file-select"
            value={selectedFileName}
            onChange={(e) => setSelectedFileName(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            {logFileList.map((fileItem) => (
              <option key={fileItem.name} value={fileItem.name}>
                {fileItem.name} ({Math.round(fileItem.size_bytes / 1024)} KB)
              </option>
            ))}
          </select>
        </div>

        {/* 라인 수 선택 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="line-limit-select" className="text-xs font-semibold text-slate-600">
            표시 줄 수 (Tail)
          </label>
          <select
            id="line-limit-select"
            value={tailLineLimit}
            onChange={(e) => setTailLineLimit(Number(e.target.value))}
            className="p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value={50}>최신 50줄</option>
            <option value={100}>최신 100줄</option>
            <option value={500}>최신 500줄</option>
            <option value={1000}>최신 1000줄</option>
          </select>
        </div>

        {/* 로그 레벨 필터 */}
        <div className="flex flex-col gap-1">
          <label htmlFor="log-level-select" className="text-xs font-semibold text-slate-600">
            로그 레벨 필터
          </label>
          <select
            id="log-level-select"
            value={logLevelFilter}
            onChange={(e) => setLogLevelFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">전체 레벨</option>
            <option value="INFO">INFO 만 보기</option>
            <option value="WARN">WARN 만 보기</option>
            <option value="ERROR">ERROR 만 보기</option>
          </select>
        </div>

        {/* 키워드 검색 */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-1">
          <label htmlFor="log-keyword-input" className="text-xs font-semibold text-slate-600">
            키워드 검색
          </label>
          <div className="flex gap-2">
            <input
              id="log-keyword-input"
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="검색어 입력..."
              className="flex-1 p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="키워드 검색 실행"
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              <Search size={14} />
              검색
            </button>
          </div>
        </form>
      </div>

      {/* 로그 출력 뷰어 */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 shadow-inner space-y-2">
        <div className="flex justify-between items-center text-xs text-slate-400 font-mono border-b border-slate-800 pb-2">
          <span>파일명: {selectedFileName || '-'}</span>
          <span>조건 일치 라인: {totalMatchingLines}줄</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto font-mono text-xs text-slate-200 leading-relaxed space-y-1 p-2">
          {logLinesResult.length === 0 ? (
            <div className="text-slate-500 py-10 text-center italic">
              표시할 로그 항목이 없습니다.
            </div>
          ) : (
            logLinesResult.map((lineText, lineIdx) => {
              let colorClass = 'text-slate-300';
              if (lineText.includes('[ERROR]') || lineText.includes('ERROR')) {
                colorClass = 'text-rose-400 font-semibold bg-rose-950/30 px-1 rounded';
              } else if (lineText.includes('[WARN]') || lineText.includes('WARN')) {
                colorClass = 'text-amber-300 font-semibold';
              } else if (lineText.includes('[INFO]') || lineText.includes('INFO')) {
                colorClass = 'text-emerald-400';
              }

              return (
                <div key={lineIdx} className={`whitespace-pre-wrap break-all hover:bg-slate-900 px-1 py-0.5 rounded ${colorClass}`}>
                  {lineText}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemLogPage;
