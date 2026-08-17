import React, { useState, useEffect, useCallback } from 'react';
import { Database, Table as TableIcon, Play, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Key } from 'lucide-react';
import QueryResultTable from '../components/QueryResultTable';
import { systemService } from '../services';

/**
 * DB 탐색기 컴포넌트
 * 서버 PC의 SQLite 데이터베이스 테이블 목록, 스키마(PK/FK), 데이터 페이징/정렬 및 Read-Only SQL(SELECT) 직접 실행 기능을 제공합니다.
 */
const DbExplorerPage = () => {
  const [tableList, setTableList] = useState([]);
  const [selectedTableName, setSelectedTableName] = useState('');
  const [tableSchemaInfo, setTableSchemaInfo] = useState(null);
  const [tableDataResult, setTableDataResult] = useState({ columns: [], rows: [], row_count: 0, truncated: false });
  const [activeTab, setActiveTab] = useState('data');

  // 페이징 및 정렬 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('ASC');
  const pageSize = 50;

  // SQL 직접 실행 상태
  const [sqlQueryText, setSqlQueryText] = useState('');
  const [sqlExecutionResult, setSqlExecutionResult] = useState(null);
  const [sqlLoadingStatus, setSqlLoadingStatus] = useState(false);
  const [sqlErrorMessage, setSqlErrorMessage] = useState(null);

  // 일반 로딩 및 에러
  const [pageLoadingStatus, setPageLoadingStatus] = useState(false);
  const [pageErrorMessage, setPageErrorMessage] = useState(null);

  // 테이블 목록 조회 (useCallback 의존성 최적화)
  const fetchTableList = useCallback(async () => {
    try {
      setPageLoadingStatus(true);
      setPageErrorMessage(null);
      const data = await systemService.getDbTables();
      setTableList(data);

      setSelectedTableName((prev) => prev || (data[0] ? data[0].name : ''));
    } catch (err) {
      setPageErrorMessage(err.message);
    } finally {
      setPageLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchTableList();
  }, [fetchTableList]);

  // 선택된 테이블 상세 데이터 및 스키마 조회
  const fetchTableDetails = useCallback(async () => {
    if (!selectedTableName) return;
    try {
      setPageLoadingStatus(true);
      setPageErrorMessage(null);

      // 스키마 조회
      try {
        const schemaData = await systemService.getDbSchema(selectedTableName);
        setTableSchemaInfo(schemaData);
      } catch (schemaErr) {
        console.warn(`테이블 ${selectedTableName} 스키마 조회 실패:`, schemaErr);
      }

      // 정렬 조건 적용하여 SELECT 실행
      const offset = (currentPage - 1) * pageSize;
      let orderClause = '';
      if (sortColumn) {
        orderClause = ` ORDER BY "${sortColumn}" ${sortDirection}`;
      }

      const data = await systemService.executeDbQuery(
        `SELECT * FROM "${selectedTableName}"${orderClause} LIMIT ${pageSize} OFFSET ${offset}`,
        pageSize
      );
      setTableDataResult(data);
    } catch (err) {
      setPageErrorMessage(err.message);
    } finally {
      setPageLoadingStatus(false);
    }
  }, [selectedTableName, currentPage, sortColumn, sortDirection]);

  useEffect(() => {
    fetchTableDetails();
  }, [fetchTableDetails]);

  // 컬럼 헤더 클릭 시 정렬 토글
  const handleSortToggle = useCallback((columnName) => {
    if (sortColumn === columnName) {
      if (sortDirection === 'ASC') {
        setSortDirection('DESC');
      } else {
        setSortColumn('');
        setSortDirection('ASC');
      }
    } else {
      setSortColumn(columnName);
      setSortDirection('ASC');
    }
    setCurrentPage(1);
  }, [sortColumn, sortDirection]);

  // SQL 직접 실행
  const handleExecuteSql = async () => {
    if (!sqlQueryText.trim()) return;
    try {
      setSqlLoadingStatus(true);
      setSqlErrorMessage(null);
      setSqlExecutionResult(null);

      const data = await systemService.executeDbQuery(sqlQueryText, 500);
      setSqlExecutionResult(data);
    } catch (err) {
      setSqlErrorMessage(err.detail || err.message || 'SQL 실행 중 오류가 발생했습니다.');
    } finally {
      setSqlLoadingStatus(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">DB 탐색기</h1>
            <p className="text-xs text-slate-500">서버 PC SQLite 데이터베이스 테이블, 스키마(PK/FK) 및 Read-Only 쿼리 조회</p>
          </div>
        </div>
        <button
          onClick={fetchTableList}
          aria-label="테이블 목록 새로고침"
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={pageLoadingStatus ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {pageErrorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{pageErrorMessage}</span>
        </div>
      )}

      {/* 레이아웃 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 좌측: 테이블 사이드바 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-sm font-semibold text-slate-700">테이블 목록</span>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">{tableList.length}개</span>
          </div>

          <div className="space-y-1 max-h-[550px] overflow-y-auto pr-1">
            {tableList.map((tableItem) => (
              <button
                key={tableItem.name}
                onClick={() => {
                  setSelectedTableName(tableItem.name);
                  setCurrentPage(1);
                  setSortColumn('');
                  setSortDirection('ASC');
                  setSqlQueryText(`SELECT * FROM "${tableItem.name}" LIMIT 50;`);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                  selectedTableName === tableItem.name
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <TableIcon size={14} className="text-slate-400 flex-shrink-0" />
                  <span className="truncate">{tableItem.name}</span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2">
                  {tableItem.row_count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 우측 메인 영역 */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col">
          {/* 탭 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('data')}
                aria-label="데이터 조회 탭으로 전환"
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'data' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                데이터 조회
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                aria-label="스키마 구조 탭으로 전환"
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'schema' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                스키마 및 외래키(FK)
              </button>
              <button
                onClick={() => setActiveTab('sql')}
                aria-label="SQL 직접 실행 탭으로 전환"
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'sql' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                SQL 직접 실행
              </button>
            </div>

            {selectedTableName && (
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                테이블: {selectedTableName}
              </span>
            )}
          </div>

          {/* 탭 1: 데이터 조회 */}
          {activeTab === 'data' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <QueryResultTable
                columns={tableDataResult.columns}
                rows={tableDataResult.rows}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSortToggle}
              />

              {/* 페이징 컨트롤 */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>페이지 당 {pageSize}개 표시 (헤더 클릭 시 정렬)</span>
                <div className="flex items-center gap-2">
                  <button
                    aria-label="이전 페이지 이동"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-semibold font-mono">{currentPage} 페이지</span>
                  <button
                    aria-label="다음 페이지 이동"
                    disabled={tableDataResult.rows.length < pageSize}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 탭 2: 스키마 및 FK 구조 */}
          {activeTab === 'schema' && tableSchemaInfo && (
            <div className="space-y-6">
              {/* 컬럼 스키마 테이블 */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <TableIcon size={14} className="text-blue-600" />
                  컬럼 정의
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <tr>
                        <th className="px-3 py-2">컬럼명</th>
                        <th className="px-3 py-2">데이터 타입</th>
                        <th className="px-3 py-2">PK</th>
                        <th className="px-3 py-2">Nullable</th>
                        <th className="px-3 py-2">기본값</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {tableSchemaInfo.columns.map((columnSchema) => (
                        <tr key={columnSchema.name} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-semibold text-slate-800">{columnSchema.name}</td>
                          <td className="px-3 py-2 text-blue-600">{columnSchema.type}</td>
                          <td className="px-3 py-2">
                            {columnSchema.primary_key ? <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold">PK</span> : '-'}
                          </td>
                          <td className="px-3 py-2">{columnSchema.nullable ? 'YES' : 'NO'}</td>
                          <td className="px-3 py-2 text-slate-400">{columnSchema.default || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 외래 키(Foreign Key) 정의 */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Key size={14} className="text-indigo-600" />
                  외래 키 (Foreign Keys)
                </h3>
                {tableSchemaInfo.foreign_keys.length === 0 ? (
                  <div className="p-4 border border-slate-200 rounded-lg text-xs text-slate-400 italic bg-slate-50">
                    등록된 외래 키 제약 조건이 없습니다.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <tr>
                          <th className="px-3 py-2">제약조건 명칭</th>
                          <th className="px-3 py-2">소속 컬럼</th>
                          <th className="px-3 py-2">참조 테이블</th>
                          <th className="px-3 py-2">참조 컬럼</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {tableSchemaInfo.foreign_keys.map((fk, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-500">{fk.name || `fk_${idx + 1}`}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800">{(fk.constrained_columns || []).join(', ')}</td>
                            <td className="px-3 py-2 text-indigo-600 font-semibold">{fk.referred_table}</td>
                            <td className="px-3 py-2 text-slate-700">{(fk.referred_columns || []).join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 탭 3: SQL 직접 실행 */}
          {activeTab === 'sql' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="sql-editor-textarea" className="text-xs font-semibold text-slate-700">
                    SELECT SQL 입력 (Read-Only)
                  </label>
                  <button
                    onClick={handleExecuteSql}
                    disabled={sqlLoadingStatus}
                    aria-label="SQL 쿼리 실행"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Play size={14} />
                    쿼리 실행
                  </button>
                </div>
                <textarea
                  id="sql-editor-textarea"
                  value={sqlQueryText}
                  onChange={(e) => setSqlQueryText(e.target.value)}
                  placeholder="SELECT * FROM accounts LIMIT 10;"
                  rows={4}
                  aria-label="SQL 쿼리 입력창"
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-900 text-slate-100"
                />
              </div>

              {sqlErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{sqlErrorMessage}</span>
                </div>
              )}

              {sqlExecutionResult && (
                <div className="space-y-2 flex-1">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                    <span>결과 {sqlExecutionResult.row_count}건 {sqlExecutionResult.truncated && '(최대 제한 500건 적용됨)'}</span>
                  </div>

                  <QueryResultTable
                    columns={sqlExecutionResult.columns}
                    rows={sqlExecutionResult.rows}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DbExplorerPage;
