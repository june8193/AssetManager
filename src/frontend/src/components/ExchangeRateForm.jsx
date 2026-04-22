import { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2 } from 'lucide-react';

/**
 * 환율 입력 및 최근 내역 조회 폼 컴포넌트입니다.
 * 
 * 일자별 USD/KRW 환율을 입력하고 서버에 저장하며, 최근 10건의 입력 내역을 테이블 형태로 표시합니다.
 * 동일 날짜에 데이터가 존재할 경우 사용자 확인 후 덮어쓰기 기능을 지원합니다.
 *
 * @returns {JSX.Element} 환율 입력 폼 및 내역 테이블
 */
export default function ExchangeRateForm() {
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    date: today,
    currency: 'USD',
    rate: ''
  });
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // 최근 환율 목록 가져오기
  const fetchRates = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/exchange/rates?limit=10');
      if (response.ok) {
        const data = await response.json();
        setRates(data);
      }
    } catch (err) {
      console.error('환율 목록 로드 실패:', err);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    if (!formData.rate) {
      setError('환율을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`http://localhost:8000/api/exchange/rates?force=${force}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          currency: formData.currency,
          rate: parseFloat(formData.rate)
        })
      });

      if (response.status === 409) {
        const confirmUpdate = window.confirm('해당 날짜에 이미 환율이 존재합니다. 새로운 값으로 덮어쓰시겠습니까?');
        if (confirmUpdate) {
          // force=true로 재요청
          setLoading(true);
          const forceResponse = await fetch(`http://localhost:8000/api/exchange/rates?force=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: formData.date,
              currency: formData.currency,
              rate: parseFloat(formData.rate)
            })
          });
          
          if (forceResponse.ok) {
            setMessage('환율이 성공적으로 업데이트되었습니다.');
            setFormData({ ...formData, rate: '' });
            fetchRates();
          } else {
            const errorData = await forceResponse.json();
            throw new Error(errorData.detail || '업데이트 중 오류가 발생했습니다.');
          }
          return;
        } else {
          setLoading(false);
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '저장 중 오류가 발생했습니다.');
      }

      setMessage('환율이 성공적으로 저장되었습니다.');
      setFormData({ ...formData, rate: '' });
      fetchRates();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 입력 폼 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Save size={20} className="text-blue-500" />
          환율 입력 (USD)
        </h3>
        
        <form onSubmit={(e) => handleSubmit(e)} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-50 pb-6 mb-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-600">날짜</label>
            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-600">환율 (원/달러)</label>
            <input
              type="number"
              step="0.1"
              placeholder="예: 1380.5"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              required
            />
          </div>
          
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-blue-300"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              저장하기
            </button>
          </div>
        </form>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm mb-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">
            {message}
          </div>
        )}
      </div>

      {/* 리스트 내역 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">최근 입력 내역</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-3 px-4 text-sm font-semibold text-gray-600">날짜</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600">통화</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">환율</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right">입력일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rates.length > 0 ? (
                rates.map((r, idx) => (
                  <tr key={r.id || `${r.date}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-700 font-medium">{r.date}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">{r.currency}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 text-right font-mono font-bold">
                      {r.rate.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400 text-right">
                      {r.created_at ? new Date(r.created_at.replace(' ', 'T')).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-400 text-sm italic">
                    등록된 환율 데이터가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
