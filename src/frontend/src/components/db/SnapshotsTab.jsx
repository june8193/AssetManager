import React, { useState, useEffect } from 'react';
import { DB_API_BASE } from '../../config';
import { Camera, Save, RefreshCw, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';

/**
 * 자산 상태 스냅샷 조회 탭 컴포넌트입니다.
 * 특정 시점의 계좌별 평가액, 누적 수익 등의 이력을 조회합니다.
 */
const SnapshotsTab = () => {
  const [snapshots, setSnapshots] = useState([]); // 스냅샷 목록 상태
  const [accounts, setAccounts] = useState([]);   // 계좌 목록 상태 (이름 매핑용)
  const [loading, setLoading] = useState(true);   // 로딩 상태
  const { maskValue } = useMasking();

  // 스냅샷 생성 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'preview'
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRate, setExchangeRate] = useState('');
  const [previews, setPreviews] = useState([]);
  const [processing, setProcessing] = useState(false);

  /**
   * 서버에서 스냅샷 및 계좌 데이터를 가져옵니다.
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      const [snapRes, accRes] = await Promise.all([
        fetch(`${DB_API_BASE}/snapshots`),
        fetch(`${DB_API_BASE}/accounts`)
      ]);
      const snapData = await snapRes.json();
      const accData = await accRes.json();
      setSnapshots(snapData);
      setAccounts(accData);
    } catch (error) {
      console.error('스냅샷 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /**
   * 스냅샷 계산 미리보기 요청
   */
  const handlePreview = async (e) => {
    e.preventDefault();
    if (!exchangeRate || isNaN(exchangeRate)) {
      alert('올바른 환율을 입력해주세요.');
      return;
    }

    try {
      setProcessing(true);
      const response = await fetch(`${DB_API_BASE}/snapshots/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_date: inputDate,
          exchange_rate: parseFloat(exchangeRate)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviews(data);
        setStep('preview');
      } else {
        const err = await response.json();
        alert(`계산 중 오류 발생: ${err.detail || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('미리보기 요청 오류:', error);
      alert('서버와 통신 중 오류가 발생했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 최종 스냅샷 저장 요청
   */
  const handleSave = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`${DB_API_BASE}/snapshots/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previews)
      });

      if (response.ok) {
        setIsModalOpen(false);
        setStep('input');
        setPreviews([]);
        fetchData();
      } else {
        alert('저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('저장 요청 오류:', error);
    } finally {
      setProcessing(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setStep('input');
    setPreviews([]);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">데이터를 불러오는 중입니다...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">자산 상태 스냅샷 이력</h3>
          <p className="text-xs text-slate-500 mt-1">정기적으로 자산 상태를 기록하여 시계열 차트를 생성합니다.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Camera size={16} />
          스냅샷 생성
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">기준 일자</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">계좌</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">기간 입금액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">총 평가액</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">누적 수익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshots.map((snap) => (
              <tr key={snap.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-900 font-medium">{snap.snapshot_date}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {accounts.find(a => a.id === snap.account_id)?.name || snap.account_id}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-blue-600">
                  {maskValue(snap.period_deposit.toLocaleString())}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                  {maskValue(snap.total_valuation.toLocaleString())}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-emerald-600">
                  {maskValue(snap.total_profit.toLocaleString())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {snapshots.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">데이터가 없습니다.</div>
        )}
      </div>

      {/* 스냅샷 생성 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Camera className="text-blue-600" size={20} />
                자산 스냅샷 자동 생성
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {step === 'input' ? (
                <form onSubmit={handlePreview} className="space-y-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">환율 입력 필수</p>
                      <p className="opacity-80">해외 자산을 원화로 환산하기 위해 당일 기준 환율을 입력해야 합니다. 입력된 환율을 바탕으로 전체 계좌의 평가액이 자동 계산됩니다.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">기준 일자</label>
                      <input
                        type="date"
                        value={inputDate}
                        onChange={(e) => setInputDate(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">당일 환율 (USD/KRW)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="예: 1350.5"
                        value={exchangeRate}
                        onChange={(e) => setExchangeRate(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={processing}
                      className="px-8 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-md shadow-blue-200 flex items-center gap-2"
                    >
                      {processing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                      계산하기
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3">
                    <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                    <div className="text-sm text-emerald-800">
                      <p className="font-semibold mb-1">계산 완료</p>
                      <p className="opacity-80">환율 <strong>{exchangeRate}원</strong> 기준, {inputDate} 시점의 예상 스냅샷 데이터입니다. 내용을 확인하신 후 최종 저장을 눌러주세요.</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-600">계좌명</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 text-right">평가액(KRW)</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 text-right">수익(KRW)</th>
                          <th className="px-4 py-3 font-semibold text-slate-600 text-right">입금액</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previews.map((p) => (
                          <tr key={p.account_id}>
                            <td className="px-4 py-3 font-medium text-slate-800">{p.account_name}</td>
                            <td className="px-4 py-3 text-right font-mono font-bold">
                              {maskValue(Math.round(p.total_valuation).toLocaleString())}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-emerald-600">
                              {maskValue(Math.round(p.total_profit).toLocaleString())}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-blue-600">
                              {maskValue(Math.round(p.period_deposit).toLocaleString())}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setStep('input')}
                      className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <RefreshCw size={14} /> 다시 계산하기
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={processing}
                        className="px-8 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-md shadow-blue-200 flex items-center gap-2"
                      >
                        {processing ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                        최종 저장
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotsTab;
