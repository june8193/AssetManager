import React from 'react';
import { ArrowUpDown } from 'lucide-react';

/**
 * DB 쿼리 결과 테이블 공통 컴포넌트
 *
 * @param {Object} props
 * @param {Array<string>} props.columns - 컬럼명 리스트
 * @param {Array<Array<any>>} props.rows - 데이터 행 리스트
 * @param {string} [props.sortColumn] - 현재 정렬 컬럼
 * @param {string} [props.sortDirection] - 정렬 방향 ('ASC' | 'DESC')
 * @param {Function} [props.onSort] - 헤더 클릭 시 정렬 핸들러
 */
const QueryResultTable = ({ columns = [], rows = [], sortColumn, sortDirection, onSort }) => {
  if (columns.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs italic">
        표시할 테이블 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[450px]">
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-slate-700 font-semibold select-none">
          <tr>
            {columns.map((colName) => (
              <th
                key={colName}
                onClick={() => onSort && onSort(colName)}
                onKeyDown={(e) => {
                  if (onSort && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSort(colName);
                  }
                }}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'button' : undefined}
                className={`px-3 py-2 font-mono whitespace-nowrap ${onSort ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
                aria-label={`${colName} 컬럼 정렬`}
              >
                <div className="flex items-center gap-1">
                  <span>{colName}</span>
                  {onSort && (
                    <ArrowUpDown
                      size={12}
                      className={sortColumn === colName ? 'text-blue-600 font-bold' : 'text-slate-300'}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-mono">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-slate-400">
                조회된 레코드가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((rowItems, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50/80">
                {rowItems.map((cellValue, cellIdx) => (
                  <td key={cellIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-700">
                    {cellValue === null ? <span className="text-slate-300 italic">null</span> : String(cellValue)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default QueryResultTable;
