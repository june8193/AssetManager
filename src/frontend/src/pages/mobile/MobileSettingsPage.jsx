import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Eye,
  EyeOff,
  Server,
  RefreshCw,
  Smartphone,
  Info,
  Share,
  PlusSquare,
  MoreVertical,
  Download,
} from 'lucide-react';
import { useMasking } from '../../contexts/MaskingContext';
import { systemService } from '../../services/systemService';

/**
 * 모바일 환경 설정 페이지 (`/m/settings`)
 * 
 * 1. 개인정보 보호: 자산 금액 마스킹 스위치 On/Off
 * 2. 백엔드 서버 헬스체크: Ping 상태, 응답 시간(Latency), 실시간 재확인
 * 3. 홈 화면 추가(PWA 설치) 인터랙티브 가이드 (iOS / Android)
 * 4. 앱 정보 및 읽기 전용 모드 안내
 */
export default function MobileSettingsPage() {
  const { isMasked, toggleMasking } = useMasking();

  // 서버 연결 헬스체크 상태
  const [healthStatus, setHealthStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [latency, setLatency] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // PWA 가이드 탭: 'ios' | 'android'
  const [activePwaTab, setActivePwaTab] = useState('ios');

  // Standalone PWA 모드 감지
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
  }, []);

  // 서버 헬스체크 수행 함수
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
    } catch (err) {
      setHealthStatus('offline');
      setLatency(null);
      setLastChecked(new Date());
    } finally {
      setIsChecking(false);
    }
  }, []);

  // 초기 마운트 시 헬스체크 실행
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
    <div className="space-y-4 pb-4">
      {/* 상단 페이지 타이틀 */}
      <div className="px-1">
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">환경 설정</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          앱 동작 및 백엔드 연결 상태를 관리합니다.
        </p>
      </div>

      {/* 1. 개인정보 보호 (마스킹 토글) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <Shield className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-200">개인정보 보호</h2>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl transition-colors ${
                isMasked ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700/60 text-slate-400'
              }`}
            >
              {isMasked ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-sm font-medium text-slate-200 block">
                자산 금액 마스킹
              </span>
              <span className="text-xs text-slate-400">
                {isMasked ? '금액이 ***로 숨겨짐' : '모든 금액 정상 표시'}
              </span>
            </div>
          </div>

          {/* 스위치 버튼 */}
          <button
            type="button"
            role="switch"
            aria-checked={isMasked}
            aria-label="자산 금액 마스킹"
            onClick={toggleMasking}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500/50 ${
              isMasked ? 'bg-sky-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                isMasked ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-2.5 px-1 leading-relaxed">
          화면의 모든 자산 총액 및 개별 잔고를 마스킹하여 카페나 대중교통 등 외부 시선으로부터 소중한 자산 정보를 보호합니다.
        </p>
      </div>

      {/* 2. 서버 연결 상태 (헬스체크 카드) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-200">서버 연결 상태</h2>
          </div>

          {/* 상태 배지 */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              healthStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : healthStatus === 'offline'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                healthStatus === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : healthStatus === 'offline'
                  ? 'bg-rose-500'
                  : 'bg-amber-400 animate-ping'
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

        {/* 연결 지표 그리드 */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col">
            <span className="text-[11px] text-slate-400 font-medium">응답 지연 시간</span>
            <span className="text-base font-bold text-slate-100 mt-0.5">
              {latency !== null ? `${latency} ms` : '-'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col">
            <span className="text-[11px] text-slate-400 font-medium">최종 점검 시각</span>
            <span className="text-xs font-semibold text-slate-200 mt-1">
              {formatLastCheckedTime(lastChecked)}
            </span>
          </div>
        </div>

        {/* 재확인 버튼 */}
        <button
          type="button"
          onClick={checkServerHealth}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.99] border border-slate-700/60 text-slate-200 text-xs font-semibold transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-sky-400' : ''}`} />
          <span>{isChecking ? '연결 확인 중...' : '연결 상태 재확인'}</span>
        </button>
      </div>

      {/* 3. 홈 화면 추가 가이드 (PWA 설치) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-200">홈 화면 추가 가이드</h2>
          </div>

          {isStandalone && (
            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[11px] font-medium border border-sky-500/30">
              PWA 앱 모드 실행 중
            </span>
          )}
        </div>

        {/* OS 선택 탭 */}
        <div className="flex rounded-xl bg-slate-800/80 p-1 mb-3 border border-slate-700/60">
          <button
            type="button"
            role="tab"
            aria-selected={activePwaTab === 'ios'}
            onClick={() => setActivePwaTab('ios')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activePwaTab === 'ios'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            iOS (Safari)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePwaTab === 'android'}
            onClick={() => setActivePwaTab('android')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activePwaTab === 'android'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Android (Chrome)
          </button>
        </div>

        {/* 단계별 가이드 내용 */}
        {activePwaTab === 'ios' ? (
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 font-bold text-[11px] mt-0.5">
                1
              </div>
              <div className="text-slate-300 leading-relaxed">
                Safari 브라우저 하단 메뉴 바에서{' '}
                <span className="text-sky-300 font-semibold inline-flex items-center gap-1">
                  <Share className="w-3.5 h-3.5 inline" /> 하단 공유 버튼
                </span>
                을 탭합니다.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 font-bold text-[11px] mt-0.5">
                2
              </div>
              <div className="text-slate-300 leading-relaxed">
                공유 메뉴 목록을 위로 스크롤하여{' '}
                <span className="text-sky-300 font-semibold inline-flex items-center gap-1">
                  <PlusSquare className="w-3.5 h-3.5 inline" /> '홈 화면에 추가'
                </span>
                를 선택합니다.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 font-bold text-[11px] mt-0.5">
                3
              </div>
              <div className="text-slate-300 leading-relaxed">
                우측 상단의 <span className="text-sky-300 font-semibold">'추가'</span> 버튼을 누르면
                홈 화면에서 주소창 없이 네이티브 앱처럼 풀스크린으로 실행됩니다.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 font-bold text-[11px] mt-0.5">
                1
              </div>
              <div className="text-slate-300 leading-relaxed">
                Chrome 브라우저 우측 상단{' '}
                <span className="text-sky-300 font-semibold inline-flex items-center gap-1">
                  <MoreVertical className="w-3.5 h-3.5 inline" /> 브라우저 우측 상단 더보기(⋮)
                </span>{' '}
                메뉴를 탭합니다.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 font-bold text-[11px] mt-0.5">
                2
              </div>
              <div className="text-slate-300 leading-relaxed">
                메뉴에서{' '}
                <span className="text-sky-300 font-semibold inline-flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 inline" /> '앱 설치'
                </span>{' '}
                또는 <span className="text-sky-300 font-semibold">'홈 화면에 추가'</span>를 선택합니다.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0 font-bold text-[11px] mt-0.5">
                3
              </div>
              <div className="text-slate-300 leading-relaxed">
                안내 팝업에서 <span className="text-sky-300 font-semibold">'설치'</span>를 누르면 홈 화면에
                독립 앱으로 즉시 등록됩니다.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. 앱 정보 및 안전 안내 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
            <Info className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-200">앱 정보</h2>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">서비스 명칭</span>
            <span className="font-semibold text-slate-200">AssetManager Mobile</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">앱 버전</span>
            <span className="font-mono text-slate-200">v1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">실행 모드</span>
            <span className="text-sky-400 font-medium">읽기 전용 (Read-Only)</span>
          </div>
        </div>

        <div className="mt-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/30 text-[11px] text-slate-400 leading-relaxed">
          💡 모바일 브라우저 및 PWA 환경에서는 자산 데이터의 안전한 보호를 위해 읽기 전용으로 동작합니다. 계좌 생성, 거래내역 수정 및 DB 관리는 PC 데스크톱 웹 환경을 이용해 주세요.
        </div>
      </div>
    </div>
  );
}
