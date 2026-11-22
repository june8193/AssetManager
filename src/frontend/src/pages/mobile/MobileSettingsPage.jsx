import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';
import { systemService } from '../../services/systemService';

/**
 * 모바일 환경 설정 페이지 (`/m/settings`, 클린 라이트 톤)
 * 1. 개인정보 보호: 자산 금액 마스킹 스위치 On/Off
 * 2. 백엔드 서버 헬스체크: Ping 상태, 응답 시간(Latency), 실시간 재확인
 * 3. 앱 정보 및 읽기 전용 모드 안내
 */
export default function MobileSettingsPage() {
  const { isMasked, toggleMasking } = useMasking();

  const [healthStatus, setHealthStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [latency, setLatency] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkServerHealth = useCallback(async () => {
    setIsChecking(true);
    const startTime = performance.now();

    try {
      await systemService.getTaskStatus();
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      setLatency(durationMs);
      setHealthStatus('online');
      setLastChecked(new Date());
    } catch {
      setHealthStatus('offline');
      setLatency(null);
      setLastChecked(new Date());
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  const formatLastCheckedTime = (date) => {
    if (!date) return '-';
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-3 max-w-md mx-auto pb-6">
      {/* 1. 개인정보 보호 (마스킹 토글) */}
      <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3">
        <h2 className="text-[15px] font-bold text-[#191F28]">개인정보 보호</h2>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                isMasked ? 'bg-[#E8F3FF] text-[#3182F6]' : 'bg-[#F2F4F6] text-[#6B7684]'
              }`}
            >
              {isMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[13px] font-semibold text-[#191F28] block">
                자산 금액 마스킹
              </span>
              <span className="text-xs text-[#8B95A1]">
                {isMasked ? '금액이 ***로 숨겨짐' : '모든 금액 정상 표시'}
              </span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={isMasked}
            aria-label="자산 금액 마스킹"
            onClick={toggleMasking}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3182F6]/30 ${
              isMasked ? 'bg-[#3182F6]' : 'bg-[#CBD5E1]'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                isMasked ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-[#8B95A1] leading-relaxed pt-2 border-t border-[#F2F4F6]">
          화면의 모든 자산 총액 및 개별 잔고를 마스킹하여 외부 시선으로부터 소중한 자산 정보를 보호합니다.
        </p>
      </section>

      {/* 2. 서버 연결 상태 (헬스체크 카드) */}
      <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[#191F28]">서버 연결 상태</h2>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              healthStatus === 'online'
                ? 'bg-[#E8F8F2] text-[#00A870]'
                : healthStatus === 'offline'
                ? 'bg-[#FFF0F1] text-[#F04452]'
                : 'bg-[#FFF8E6] text-[#D97706]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                healthStatus === 'online'
                  ? 'bg-[#00A870]'
                  : healthStatus === 'offline'
                  ? 'bg-[#F04452]'
                  : 'bg-[#D97706] animate-ping'
              }`}
            />
            <span>
              {healthStatus === 'online'
                ? '정상 연결됨 (Online)'
                : healthStatus === 'offline'
                ? '연결 실패 (Offline)'
                : '확인 중...'}
            </span>
          </div>
        </div>

        <div className="divide-y divide-[#F2F4F6] text-xs tabular-nums">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#8B95A1]">응답 지연 시간</span>
            <span className="font-semibold text-[#191F28]">
              {latency !== null ? `${latency} ms` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#8B95A1]">최종 점검 시각</span>
            <span className="font-semibold text-[#4E5968]">
              {formatLastCheckedTime(lastChecked)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={checkServerHealth}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#F2F4F6] hover:bg-[#E5E8EB] active:scale-[0.99] text-[#191F28] text-xs font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-[#3182F6]' : 'text-[#4E5968]'}`} />
          <span>{isChecking ? '연결 확인 중...' : '연결 상태 재확인'}</span>
        </button>
      </section>

      {/* 3. 앱 정보 및 안전 안내 */}
      <section className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-5 space-y-3">
        <h2 className="text-[15px] font-bold text-[#191F28]">앱 정보</h2>

        <div className="divide-y divide-[#F2F4F6] text-xs">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#8B95A1]">서비스 명칭</span>
            <span className="font-semibold text-[#191F28]">AssetManager Mobile</span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#8B95A1]">앱 버전</span>
            <span className="font-semibold text-[#4E5968] tabular-nums">
              v{import.meta.env.VITE_APP_VERSION || '1.0.0'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[#8B95A1]">실행 모드</span>
            <span className="text-[#3182F6] font-semibold">읽기 전용 (Read-Only)</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#F9FAFB] text-[11px] text-[#6B7684] leading-relaxed">
          모바일 브라우저 및 PWA 환경에서는 자산 데이터의 안전한 보호를 위해 읽기 전용으로 동작합니다. 계좌 생성, 거래내역 수정 및 DB 관리는 PC 데스크톱 웹 환경을 이용해 주세요.
        </div>
      </section>
    </div>
  );
}
