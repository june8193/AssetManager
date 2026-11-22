import { AlertCircle } from 'lucide-react';

/**
 * 모바일 상단 토스트 알림 배너 컴포넌트
 *
 * @param {Object} props
 * @param {{ type: string, text: string } | null} props.toast - 토스트 메시지 객체
 * @param {string} [props.testId] - 선택적 data-testid
 */
export function MobileToast({ toast, testId }) {
  if (!toast) return null;

  return (
    <div
      role="status"
      data-testid={testId}
      className={`sticky top-2 z-30 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all text-center ${
        toast.type === 'error' ? 'bg-[#F04452] text-white' : 'bg-[#191F28] text-white'
      }`}
    >
      {toast.text}
    </div>
  );
}

/**
 * 모바일 페이지 공통 에러 및 재시도 카드 컴포넌트
 *
 * @param {Object} props
 * @param {string} [props.title] - 에러 제목
 * @param {string} props.message - 에러 상세 메시지
 * @param {Function} props.onRetry - 재시도 버튼 클릭 핸들러
 */
export function MobileErrorCard({ title = '데이터 로드 실패', message, onRetry }) {
  return (
    <div className="py-10 px-2 text-center max-w-md mx-auto">
      <div className="bg-white border border-[#E5E8EB]/60 rounded-2xl p-6 flex flex-col items-center">
        <div className="w-11 h-11 rounded-full bg-[#FFF0F1] flex items-center justify-center text-[#F04452] mb-3">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h2 className="text-base font-bold text-[#191F28] mb-1">{title}</h2>
        <p className="text-xs text-[#6B7684] mb-5 leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-3 px-4 bg-[#3182F6] hover:bg-[#1B64DA] active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
