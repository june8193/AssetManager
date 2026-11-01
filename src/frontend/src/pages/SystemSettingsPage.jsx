import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  RefreshCw,
  Power,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Server,
  Key,
  Database,
  Archive,
  Send,
  Search,
  Code,
  Layout,
} from 'lucide-react';
import { systemService } from '../services/systemService';

/**
 * 환경 설정 및 서버 관리 컴포넌트
 * settings.toml 설정을 평문으로 확인/수정(Form/Raw TOML 모드)하고
 * 직전 설정 복원 및 서버 재시작(헬스체크 폴링)을 지원합니다.
 */
const SystemSettingsPage = () => {
  // 탭 상태: 'form' | 'raw'
  const [activeTab, setActiveTab] = useState('form');

  // 데이터 로딩 & 처리 상태
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // 알림 메시지 상태
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // 백업 정보 상태
  const [hasBackup, setHasBackup] = useState(false);
  const [backupModifiedAt, setBackupModifiedAt] = useState(null);

  // 재시작 폴링 상태
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartTimeElapsed, setRestartTimeElapsed] = useState(0);
  const restartPollingRef = useRef(null);
  const restartTimerRef = useRef(null);

  // 구조화 폼 데이터 상태
  const [formData, setFormData] = useState({
    base_url: 'https://api.kiwoom.com',
    ws_url: '',
    database: {
      url: 'sqlite:///./src/assets.db',
    },
    accounts: [
      {
        broker: '키움증권',
        account: '',
        app_key: '',
        secret_key: '',
      },
    ],
    backup: {
      interval_hours: 24,
      path: './backups',
      max_files: 7,
    },
    telegram: {
      enabled: false,
      bot_token: '',
      storage_dir: './storage',
      allowed_user_ids: '',
    },
    naver: {
      client_id: '',
      client_secret: '',
    },
  });

  // Raw TOML 원문 상태
  const [rawToml, setRawToml] = useState('');

  /**
   * 응답 데이터로부터 폼 및 Raw 상태를 반영합니다.
   */
  const applySettingsData = (data) => {
    if (!data) return;
    setHasBackup(Boolean(data.has_backup));
    setBackupModifiedAt(data.backup_modified_at || null);

    if (data.raw_toml !== undefined) {
      setRawToml(data.raw_toml);
    }

    if (data.settings) {
      const s = data.settings;
      setFormData({
        base_url: s.base_url || '',
        ws_url: s.ws_url || '',
        database: {
          url: s.database?.url || '',
        },
        accounts: Array.isArray(s.accounts) && s.accounts.length > 0
          ? s.accounts.map((acc) => ({
              broker: acc.broker || '키움증권',
              account: acc.account || '',
              app_key: acc.app_key || '',
              secret_key: acc.secret_key || '',
            }))
          : [
              {
                broker: '키움증권',
                account: '',
                app_key: '',
                secret_key: '',
              },
            ],
        backup: {
          interval_hours: s.backup?.interval_hours ?? 24,
          path: s.backup?.path || './backups',
          max_files: s.backup?.max_files ?? 7,
        },
        telegram: {
          enabled: Boolean(s.telegram?.enabled),
          bot_token: s.telegram?.bot_token || '',
          storage_dir: s.telegram?.storage_dir || './storage',
          allowed_user_ids: Array.isArray(s.telegram?.allowed_user_ids)
            ? s.telegram.allowed_user_ids.join(', ')
            : '',
        },
        naver: {
          client_id: s.naver?.client_id || '',
          client_secret: s.naver?.client_secret || '',
        },
      });
    }
  };

  /**
   * 서버로부터 최신 설정을 조회합니다.
   * @param {boolean} [showLoading=false] - 로딩 스피너 활성화 여부
   */
  const fetchSettings = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await systemService.getSettings();
      setErrorMessage(null);
      applySettingsData(data);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || '설정 데이터를 불러오지 못했습니다.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (restartPollingRef.current) clearInterval(restartPollingRef.current);
      if (restartTimerRef.current) clearInterval(restartTimerRef.current);
    };
  }, []);

  // 메시지 5초 후 자동 숨김
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // 계좌 추가
  const handleAddAccount = () => {
    setFormData((prev) => ({
      ...prev,
      accounts: [
        ...prev.accounts,
        {
          broker: '키움증권',
          account: '',
          app_key: '',
          secret_key: '',
        },
      ],
    }));
  };

  // 계좌 삭제
  const handleDeleteAccount = (index) => {
    if (formData.accounts.length <= 1) {
      alert('최소 1개 이상의 계좌 설정이 필요합니다.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((_, i) => i !== index),
    }));
  };

  // 계좌 필드 변경
  const handleAccountChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.accounts];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, accounts: updated };
    });
  };

  /**
   * 설정 저장 (mode: 'form' | 'raw')
   */
  const handleSave = async (restartAfter = false) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      let payload;
      if (activeTab === 'raw') {
        payload = {
          mode: 'raw',
          raw_toml: rawToml,
        };
      } else {
        // allowed_user_ids 파싱 (콤마/공백 구분 정수 배열)
        const allowedUserIds = String(formData.telegram.allowed_user_ids)
          .split(/[\s,]+/)
          .filter(Boolean)
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id));

        payload = {
          mode: 'form',
          settings: {
            base_url: formData.base_url.trim(),
            ws_url: formData.ws_url.trim(),
            database: {
              url: formData.database.url.trim(),
            },
            accounts: formData.accounts.map((acc) => ({
              broker: acc.broker.trim(),
              account: acc.account.trim(),
              app_key: acc.app_key.trim(),
              secret_key: acc.secret_key.trim(),
            })),
            backup: {
              interval_hours: Number(formData.backup.interval_hours),
              path: formData.backup.path.trim(),
              max_files: Number(formData.backup.max_files),
            },
            telegram: {
              enabled: Boolean(formData.telegram.enabled),
              bot_token: formData.telegram.bot_token.trim(),
              storage_dir: formData.telegram.storage_dir.trim(),
              allowed_user_ids: allowedUserIds,
            },
            naver: {
              client_id: formData.naver.client_id.trim(),
              client_secret: formData.naver.client_secret.trim(),
            },
          },
        };
      }

      const res = await systemService.updateSettings(payload);
      applySettingsData(res);

      if (restartAfter) {
        await executeServerRestart();
      } else {
        setSuccessMessage('설정이 성공적으로 저장되었습니다.');
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || '설정 저장 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 직전 설정 복원 (settings.toml.bak)
   */
  const handleRestore = async () => {
    if (!hasBackup) return;
    const confirmed = window.confirm(
      '직전 백업 설정(settings.toml.bak)으로 복원하시겠습니까?\n현재 저장되지 않은 수정 사항은 취소됩니다.'
    );
    if (!confirmed) return;

    try {
      setRestoring(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await systemService.restoreSettings();
      applySettingsData(res);
      setSuccessMessage('설정이 이전 백업본으로 복원되었습니다.');
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || '설정 복원 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    } finally {
      setRestoring(false);
    }
  };

  /**
   * 서버 재시작 실행 및 헬스체크 폴링
   */
  const executeServerRestart = async () => {
    try {
      setIsRestarting(true);
      setRestartTimeElapsed(0);
      setErrorMessage(null);

      await systemService.restartServer();

      // 경과 시간 카운터 시작
      const startTime = Date.now();
      restartTimerRef.current = setInterval(() => {
        setRestartTimeElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // 1.5초 대기 후 폴링 루프 시작 (최대 30초 대기)
      const MAX_WAIT_SECONDS = 30;
      let isChecking = false;

      restartPollingRef.current = setInterval(async () => {
        if (isChecking) return;
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);

        if (elapsedSec > MAX_WAIT_SECONDS) {
          // 타임아웃
          clearInterval(restartPollingRef.current);
          clearInterval(restartTimerRef.current);
          setIsRestarting(false);
          setErrorMessage('서버 재기동 응답 대기 시간이 초과되었습니다. 터미널 또는 서버 로그를 확인해주세요.');
          return;
        }

        try {
          isChecking = true;
          // 일시적인 네트워크 다운은 무시하고 다시 시도
          const statusRes = await systemService.getTaskStatus();
          if (statusRes) {
            // 서버 정상 재기동 완료
            clearInterval(restartPollingRef.current);
            clearInterval(restartTimerRef.current);
            setIsRestarting(false);
            setSuccessMessage('서버가 성공적으로 재기동되었습니다.');
            // 최신 설정 재로드
            await fetchSettings(true);
          }
        } catch {
          // 서버 다운 또는 재기동 중이므로 다음 틱까지 대기
        } finally {
          isChecking = false;
        }
      }, 1200);
    } catch (err) {
      setIsRestarting(false);
      if (restartTimerRef.current) clearInterval(restartTimerRef.current);
      if (restartPollingRef.current) clearInterval(restartPollingRef.current);
      const msg = err.response?.data?.detail || err.message || '서버 재시작 요청 중 오류가 발생했습니다.';
      setErrorMessage(msg);
    }
  };

  /**
   * 단독 서버 재시작 확인
   */
  const handleRestartClick = () => {
    const confirmed = window.confirm(
      '서버를 재시작하시겠습니까?\n재기동 중에는 일시적으로 서비스 연결이 중단됩니다.'
    );
    if (confirmed) {
      executeServerRestart();
    }
  };

  /**
   * 저장 후 서버 재시작 확인
   */
  const handleSaveAndRestartClick = () => {
    const confirmed = window.confirm(
      '현재 설정을 저장하고 서버를 재시작하시겠습니까?\n재기동 중에는 일시적으로 서비스 연결이 중단됩니다.'
    );
    if (confirmed) {
      handleSave(true);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 영역 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-800">환경 설정 및 서버 관리</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            settings.toml 설정을 실시간으로 조회·수정하고 서버를 안전하게 재기동합니다. 모든 보안 키는 즉시 확인 가능하도록 평문으로 표시됩니다.
          </p>
        </div>

        {/* 상단 액션 버튼 바 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRestore}
            disabled={!hasBackup || restoring || saving || isRestarting}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              hasBackup && !restoring && !saving && !isRestarting
                ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            title={backupModifiedAt ? `백업 시각: ${new Date(backupModifiedAt).toLocaleString()}` : '백업 파일 없음'}
          >
            <RotateCcw className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
            직전 설정 복원
          </button>

          <button
            type="button"
            onClick={handleRestartClick}
            disabled={saving || isRestarting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-sm transition-colors"
          >
            <Power className="w-4 h-4 text-rose-500" />
            서버 재시작
          </button>

          <button
            type="button"
            onClick={handleSaveAndRestartClick}
            disabled={saving || isRestarting}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            저장 후 서버 재시작
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || isRestarting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            설정 저장
          </button>
        </div>
      </div>

      {/* 안내 팁 박스 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-900 leading-relaxed">
          <span className="font-semibold">안내:</span> 키움 API 키, 계좌 정보, 네이버 검색 API 설정은{' '}
          <span className="font-medium underline">설정 저장</span> 즉시 서버 캐시에 반영됩니다. 단, 텔레그램 봇
          연동 및 DB 연결 URL 변경 등 서버 시작 시 초기화되는 항목은{' '}
          <span className="font-semibold text-blue-800">‘저장 후 서버 재시작’</span>을 권장합니다.
          {hasBackup && backupModifiedAt && (
            <span className="ml-2 text-blue-700">
              (직전 백업 생성: {new Date(backupModifiedAt).toLocaleString()})
            </span>
          )}
        </div>
      </div>

      {/* 피드백 알림 배너 */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-900">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-sm font-medium text-rose-900 whitespace-pre-wrap">{errorMessage}</div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'form'}
          onClick={() => setActiveTab('form')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'form'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Layout className="w-4 h-4" />
          구조화 폼 편집
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'raw'}
          onClick={() => setActiveTab('raw')}
          className={`flex items-center gap-2 py-3 px-5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'raw'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Code className="w-4 h-4" />
          Raw TOML 편집
        </button>
      </div>

      {/* 로딩 표시 */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-indigo-500" />
          설정을 불러오는 중입니다...
        </div>
      ) : activeTab === 'form' ? (
        /* 구조화 폼 탭 */
        <div className="space-y-6">
          {/* 섹션 1: 키움 API 기본 설정 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Server className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-800">키움증권 API 기본 설정</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  서비스 기본 URL (base_url) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  placeholder="https://api.kiwoom.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  실시간 웹소켓 URL (ws_url)
                </label>
                <input
                  type="text"
                  value={formData.ws_url}
                  onChange={(e) => setFormData({ ...formData, ws_url: e.target.value })}
                  placeholder="wss://api.kiwoom.com/ws"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 섹션 2: 증권사 계좌 목록 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-800">증권사 계좌 목록 ([[accounts]])</h2>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {formData.accounts.length}개
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddAccount}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                + 계좌 추가
              </button>
            </div>

            <div className="space-y-4">
              {formData.accounts.map((account, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded">
                      계좌 #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(idx)}
                      disabled={formData.accounts.length <= 1}
                      aria-label="계좌 삭제"
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors ${
                        formData.accounts.length <= 1
                          ? 'text-slate-300 cursor-not-allowed'
                          : 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">증권사</label>
                      <input
                        type="text"
                        value={account.broker}
                        onChange={(e) => handleAccountChange(idx, 'broker', e.target.value)}
                        placeholder="키움증권"
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">계좌 번호</label>
                      <input
                        type="text"
                        value={account.account}
                        onChange={(e) => handleAccountChange(idx, 'account', e.target.value)}
                        placeholder="계좌 번호 (예: 1234-5678)"
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">APP KEY</label>
                      <input
                        type="text"
                        value={account.app_key}
                        onChange={(e) => handleAccountChange(idx, 'app_key', e.target.value)}
                        placeholder="발급받은 APP KEY"
                        className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">SECRET KEY</label>
                      <input
                        type="text"
                        value={account.secret_key}
                        onChange={(e) => handleAccountChange(idx, 'secret_key', e.target.value)}
                        placeholder="발급받은 SECRET KEY"
                        className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 섹션 3: 데이터베이스 및 자동 백업 설정 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DB 설정 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Database className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-800">데이터베이스 설정 ([database])</h2>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  데이터베이스 URL (url) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.database.url}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      database: { ...formData.database, url: e.target.value },
                    })
                  }
                  placeholder="sqlite:///./src/assets.db"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  DB 경로 변경 시 서버 재시작이 필요합니다.
                </p>
              </div>
            </div>

            {/* 자동 백업 설정 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Archive className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-800">자동 백업 설정 ([backup])</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    주기 (시간) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.backup.interval_hours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backup: { ...formData.backup, interval_hours: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    저장 경로 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.backup.path}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backup: { ...formData.backup, path: e.target.value },
                      })
                    }
                    placeholder="./backups"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    최대 보관 개수 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.backup.max_files}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backup: { ...formData.backup, max_files: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 섹션 4: 텔레그램 봇 및 네이버 API 설정 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 텔레그램 봇 설정 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-semibold text-slate-800">텔레그램 봇 설정 ([telegram])</h2>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.telegram.enabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        telegram: { ...formData.telegram, enabled: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  봇 활성화
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">봇 토큰 (bot_token)</label>
                  <input
                    type="text"
                    value={formData.telegram.bot_token}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        telegram: { ...formData.telegram, bot_token: e.target.value },
                      })
                    }
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    허용 사용자 ID (allowed_user_ids, 콤마 구분)
                  </label>
                  <input
                    type="text"
                    value={formData.telegram.allowed_user_ids}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        telegram: { ...formData.telegram, allowed_user_ids: e.target.value },
                      })
                    }
                    placeholder="123456789, 987654321"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    스토리지 디렉터리 (storage_dir)
                  </label>
                  <input
                    type="text"
                    value={formData.telegram.storage_dir}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        telegram: { ...formData.telegram, storage_dir: e.target.value },
                      })
                    }
                    placeholder="./storage"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 네이버 API 설정 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Search className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-slate-800">네이버 검색 API 설정 ([naver])</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">클라이언트 ID (client_id)</label>
                  <input
                    type="text"
                    value={formData.naver.client_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        naver: { ...formData.naver, client_id: e.target.value },
                      })
                    }
                    placeholder="YOUR_NAVER_CLIENT_ID"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    클라이언트 시크릿 (client_secret)
                  </label>
                  <input
                    type="text"
                    value={formData.naver.client_secret}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        naver: { ...formData.naver, client_secret: e.target.value },
                      })
                    }
                    placeholder="YOUR_NAVER_CLIENT_SECRET"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Raw TOML 탭 */
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-semibold text-slate-800">settings.toml 원문 직접 편집</h2>
            </div>
            <span className="text-xs text-slate-400">
              저장 시 문법 및 스키마 유효성을 자동 검증합니다.
            </span>
          </div>

          <textarea
            aria-label="raw toml"
            value={rawToml}
            onChange={(e) => setRawToml(e.target.value)}
            rows={22}
            className="w-full p-4 font-mono text-xs bg-slate-900 text-slate-100 rounded-lg border border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
            placeholder="# settings.toml 내용을 입력하세요..."
          />
        </div>
      )}

      {/* 하단 공통 액션 바 */}
      <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleRestore}
          disabled={!hasBackup || restoring || saving || isRestarting}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            hasBackup && !restoring && !saving && !isRestarting
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm'
              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <RotateCcw className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
          직전 설정 복원
        </button>

        <button
          type="button"
          onClick={handleRestartClick}
          disabled={saving || isRestarting}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-rose-600 hover:bg-rose-50 shadow-sm transition-colors"
        >
          <Power className="w-4 h-4 text-rose-500" />
          서버 재시작
        </button>

        <button
          type="button"
          onClick={handleSaveAndRestartClick}
          disabled={saving || isRestarting}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          저장 후 서버 재시작
        </button>

        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving || isRestarting}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
        >
          <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
          설정 저장
        </button>
      </div>

      {/* 서버 재시작 진행 모달 오버레이 */}
      {isRestarting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">서버 재기동 중...</h3>
              <p className="text-sm text-slate-500 mt-1">
                서버 프로세스를 재시작하고 있습니다. 잠시만 기다려주세요.
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <div>헬스체크 폴링 진행 중 (경과 시간: {restartTimeElapsed}초 / 최대 30초)</div>
              <div className="text-slate-400">서버가 다시 준비되면 화면이 자동으로 갱신됩니다.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettingsPage;
