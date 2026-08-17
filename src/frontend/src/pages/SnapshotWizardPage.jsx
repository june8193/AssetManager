import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronLeft, ChevronRight, RefreshCw, Save } from 'lucide-react';
import { useSnapshotWizardEngine } from '../hooks/useSnapshotWizardEngine';
import {
  WizardProgressBar,
  Step1BasicInfo,
  Step2BrokerageDetail,
  Step3BankSelect,
  Step4BankDetail,
  Step5FinalConfirm,
} from '../components/snapshot/wizard';

/**
 * 신규 스냅샷 생성을 위한 통합 위저드 페이지 컴포넌트입니다.
 * 5단계의 과정을 통해 증권사와 은행의 자산 상태를 한 번에 기록합니다.
 */
const SnapshotWizardPage = () => {
  const navigate = useNavigate();
  const engine = useSnapshotWizardEngine();
  const [step5WarningConfirmed, setStep5WarningConfirmed] = React.useState(false);

  const handleCancel = () => {
    if (window.confirm('스냅샷 생성을 취소하시겠습니까? 입력 중인 데이터는 저장되지 않습니다.')) {
      navigate('/db');
    }
  };

  const handleSave = async () => {
    try {
      await engine.handleFinalSave();
      alert('스냅샷이 성공적으로 저장되었습니다.');
      navigate('/db');
    } catch (err) {
      // Error alert handled in engine / or re-alert if necessary
    }
  };

  // Step 5에서 정합성 경고가 있는지 여부 확인
  const hasStep5Warnings = React.useMemo(() => {
    return engine.selectedAccountIds.some((id) => {
      const data = engine.accountsFormData[id] || {};
      const calc = data.calcResult;
      if (!calc) return false;
      if (calc.integrity_warnings && calc.integrity_warnings.length > 0) return true;
      const acc = engine.accounts.find((a) => a.id === id);
      if (acc?.account_type === 'BROKERAGE') {
        return Math.abs(calc.diff_krw || 0) > 0.01 || Math.abs(calc.diff_usd || 0) > 0.01;
      } else {
        const theoreticalVal = calc.theoretical_krw || 0;
        const currentVal = data.totalValuation ? parseFloat(data.totalValuation.replace(/,/g, '') || 0) : theoreticalVal;
        return Math.abs(calc.period_profit || 0) > 0.01 || Math.abs(currentVal - theoreticalVal) > 0.01;
      }
    });
  }, [engine.selectedAccountIds, engine.accountsFormData, engine.accounts]);

  const isSaveDisabled =
    engine.processing ||
    engine.selectedAccountIds.length === 0 ||
    !engine.selectedAccountIds.every((id) => engine.accountsFormData[id]?.isConfirmed) ||
    (hasStep5Warnings && !step5WarningConfirmed);


  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="snapshot-wizard-page">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Camera size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">신규 스냅샷 생성</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-slate-500 text-sm">현재 자산 상태를 기록하기 위한 통합 위저드를 시작합니다.</p>
              {engine.latestSnapshotDate && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 font-bold">
                  최근 스냅샷: {engine.latestSnapshotDate}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          취소
        </button>
      </div>

      {/* 스텝 인디케이터 */}
      <WizardProgressBar step={engine.step} totalSteps={engine.totalSteps} />

      {/* 콘텐츠 영역 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[400px]">
        {engine.step === 1 && (
          <Step1BasicInfo
            inputDate={engine.inputDate}
            setInputDate={engine.setInputDate}
            exchangeRate={engine.exchangeRate}
            brokerageAccounts={engine.brokerageAccounts}
            selectedAccountIds={engine.selectedAccountIds}
            loadingAccounts={engine.loadingAccounts}
            toggleAccountSelection={engine.toggleAccountSelection}
            selectAllBrokerage={engine.selectAllBrokerage}
          />
        )}
        {engine.step === 2 && (
          <Step2BrokerageDetail
            currentAccIdx={engine.currentAccIdx}
            selectedBrokerageIds={engine.selectedBrokerageIds}
            accounts={engine.accounts}
            accountsFormData={engine.accountsFormData}
            inputDate={engine.inputDate}
            exchangeRate={engine.exchangeRate}
            processing={engine.processing}
            existingTxs={engine.existingTxs}
            loadingExistingTxs={engine.loadingExistingTxs}
            updateAccData={engine.updateAccData}
            addTx={engine.addTx}
            removeTx={engine.removeTx}
            updateTx={engine.updateTx}
            calculateAccountDiff={engine.calculateAccountDiff}
            handleConfirmAccount={engine.handleConfirmAccount}
          />
        )}
        {engine.step === 3 && (
          <Step3BankSelect
            bankAccounts={engine.bankAccounts}
            selectedAccountIds={engine.selectedAccountIds}
            loadingAccounts={engine.loadingAccounts}
            toggleAccountSelection={engine.toggleAccountSelection}
            selectAllBank={engine.selectAllBank}
          />
        )}
        {engine.step === 4 && (
          <Step4BankDetail
            currentAccIdx={engine.currentAccIdx}
            selectedBankIds={engine.selectedBankIds}
            accounts={engine.accounts}
            accountsFormData={engine.accountsFormData}
            inputDate={engine.inputDate}
            processing={engine.processing}
            existingTxs={engine.existingTxs}
            loadingExistingTxs={engine.loadingExistingTxs}
            updateAccData={engine.updateAccData}
            addTx={engine.addTx}
            removeTx={engine.removeTx}
            updateTx={engine.updateTx}
            calculateBankDiff={engine.calculateBankDiff}
            handleConfirmAccount={engine.handleConfirmAccount}
          />
        )}
        {engine.step === 5 && (
          <Step5FinalConfirm
            accounts={engine.accounts}
            selectedAccountIds={engine.selectedAccountIds}
            accountsFormData={engine.accountsFormData}
            warningConfirmed={step5WarningConfirmed}
            onWarningConfirmChange={setStep5WarningConfirmed}
          />
        )}

      </div>

      {/* 네비게이션 버튼 */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={engine.goToPrev}
          disabled={engine.step === 1}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            engine.step === 1
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ChevronLeft size={18} />
          이전
        </button>
        <button
          type="button"
          onClick={engine.step === engine.totalSteps ? handleSave : engine.goToNext}
          disabled={(engine.step === engine.totalSteps && isSaveDisabled) || engine.processing}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            (engine.step === engine.totalSteps && isSaveDisabled) || engine.processing
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {engine.step === engine.totalSteps ? (
            <>
              {engine.processing ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              저장하기
            </>
          ) : (
            <>
              다음
              <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SnapshotWizardPage;
