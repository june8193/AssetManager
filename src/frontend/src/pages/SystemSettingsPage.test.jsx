import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SystemSettingsPage from './SystemSettingsPage';
import { systemService } from '../services/systemService';

// systemService 모킹
vi.mock('../services/systemService', () => ({
  systemService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    restoreSettings: vi.fn(),
    restartServer: vi.fn(),
    getTaskStatus: vi.fn(),
  },
}));

describe('SystemSettingsPage Component', () => {
  const mockSettingsData = {
    settings: {
      base_url: 'https://api.kiwoom.com',
      ws_url: 'wss://api.kiwoom.com/ws',
      database: {
        url: 'sqlite:///./src/assets.db',
      },
      accounts: [
        {
          broker: '키움증권',
          account: '1234-5678',
          app_key: 'MY_APP_KEY',
          secret_key: 'MY_SECRET_KEY',
        },
      ],
      backup: {
        interval_hours: 24,
        path: './backups',
        max_files: 7,
      },
      telegram: {
        enabled: true,
        bot_token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        storage_dir: './storage',
        allowed_user_ids: [123456789, 987654321],
      },
      naver: {
        client_id: 'NAVER_ID',
        client_secret: 'NAVER_SECRET',
      },
    },
    raw_toml: '# Raw TOML Content\nbase_url = "https://api.kiwoom.com"\n',
    has_backup: true,
    backup_modified_at: '2026-11-01T12:00:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    systemService.getSettings.mockResolvedValue(mockSettingsData);
    systemService.updateSettings.mockResolvedValue(mockSettingsData);
    systemService.restoreSettings.mockResolvedValue(mockSettingsData);
    systemService.restartServer.mockResolvedValue({ status: 'restarting', message: '서버 재시작 중' });
    systemService.getTaskStatus.mockResolvedValue({ task_status: 'ok' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기 진입 시 설정을 로드하고 폼 필드들을 평문으로 렌더링한다', async () => {
    render(<SystemSettingsPage />);

    expect(screen.getByText('환경 설정 및 서버 관리')).toBeInTheDocument();

    await waitFor(() => {
      expect(systemService.getSettings).toHaveBeenCalledTimes(1);
    });

    // 키움 설정
    expect(screen.getByDisplayValue('https://api.kiwoom.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('wss://api.kiwoom.com/ws')).toBeInTheDocument();

    // DB 설정
    expect(screen.getByDisplayValue('sqlite:///./src/assets.db')).toBeInTheDocument();

    // 계좌 카드
    expect(screen.getByDisplayValue('1234-5678')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MY_APP_KEY')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MY_SECRET_KEY')).toBeInTheDocument();

    // 백업 설정
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
    expect(screen.getByDisplayValue('./backups')).toBeInTheDocument();

    // 텔레그램 설정
    expect(screen.getByDisplayValue('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123456789, 987654321')).toBeInTheDocument();

    // 네이버 설정
    expect(screen.getByDisplayValue('NAVER_ID')).toBeInTheDocument();
    expect(screen.getByDisplayValue('NAVER_SECRET')).toBeInTheDocument();

    // 평문 노출 확인 (password 타입 input이 없어야 함)
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(0);
  });

  it('계좌 추가 및 삭제가 정상 동작한다', async () => {
    render(<SystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('1234-5678')).toBeInTheDocument();
    });

    // 계좌 추가 버튼 클릭
    const addAccountBtn = screen.getByRole('button', { name: /\+ 계좌 추가/i });
    fireEvent.click(addAccountBtn);

    // 새 계좌 카드가 추가되어 계좌 입력 칸이 2개가 됨
    const accountInputs = screen.getAllByPlaceholderText(/계좌 번호/i);
    expect(accountInputs.length).toBe(2);

    // 새로 추가된 카드의 필드 입력
    fireEvent.change(accountInputs[1], { target: { value: '9999-8888' } });
    expect(accountInputs[1].value).toBe('9999-8888');

    // 두 번째 계좌 삭제 버튼 클릭
    const deleteBtns = screen.getAllByRole('button', { name: /계좌 삭제|삭제/i });
    fireEvent.click(deleteBtns[1]);

    // 계좌 카드가 1개로 줄어듦
    expect(screen.getAllByPlaceholderText(/계좌 번호/i).length).toBe(1);
    expect(screen.queryByDisplayValue('9999-8888')).not.toBeInTheDocument();
  });

  it('구조화 폼 탭과 Raw TOML 탭 간 전환이 정상 동작한다', async () => {
    render(<SystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://api.kiwoom.com')).toBeInTheDocument();
    });

    // Raw TOML 편집 탭 클릭
    const rawTabBtn = screen.getByRole('tab', { name: /Raw TOML 편집/i });
    fireEvent.click(rawTabBtn);

    // Raw TOML 내용이 텍스트영역에 표시됨
    const textarea = screen.getByRole('textbox', { name: /raw toml/i });
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain('base_url = "https://api.kiwoom.com"');

    // 다시 구조화 폼 탭 클릭
    const formTabBtn = screen.getByRole('tab', { name: /구조화 폼 편집/i });
    fireEvent.click(formTabBtn);

    expect(screen.getByDisplayValue('https://api.kiwoom.com')).toBeInTheDocument();
  });

  it('폼 탭에서 설정 저장 시 updateSettings(mode: form)를 호출하고 성공 피드백을 표시한다', async () => {
    render(<SystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://api.kiwoom.com')).toBeInTheDocument();
    });

    const saveBtns = screen.getAllByRole('button', { name: /^설정 저장$/i });
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(systemService.updateSettings).toHaveBeenCalledTimes(1);
      const callArg = systemService.updateSettings.mock.calls[0][0];
      expect(callArg.mode).toBe('form');
      expect(callArg.settings.base_url).toBe('https://api.kiwoom.com');
    });

    expect(await screen.findByText(/설정이 성공적으로 저장되었습니다/i)).toBeInTheDocument();
  });

  it('Raw 탭에서 설정 저장 시 updateSettings(mode: raw)를 호출한다', async () => {
    render(<SystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Raw TOML 편집/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Raw TOML 편집/i }));

    const textarea = screen.getByRole('textbox', { name: /raw toml/i });
    fireEvent.change(textarea, { target: { value: 'base_url = "https://new.kiwoom.com"\n' } });

    const saveBtns = screen.getAllByRole('button', { name: /^설정 저장$/i });
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(systemService.updateSettings).toHaveBeenCalledTimes(1);
      const callArg = systemService.updateSettings.mock.calls[0][0];
      expect(callArg.mode).toBe('raw');
      expect(callArg.raw_toml).toBe('base_url = "https://new.kiwoom.com"\n');
    });
  });

  it('저장 실패 시 오류 메시지를 표시한다', async () => {
    systemService.updateSettings.mockRejectedValueOnce({
      response: {
        data: {
          detail: 'TOML 문법 오류: invalid syntax at line 2',
        },
      },
    });

    render(<SystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^설정 저장$/i }).length).toBeGreaterThan(0);
    });

    const saveBtns = screen.getAllByRole('button', { name: /^설정 저장$/i });
    fireEvent.click(saveBtns[0]);

    expect(await screen.findByText(/TOML 문법 오류: invalid syntax at line 2/i)).toBeInTheDocument();
  });

  it('has_backup이 false일 때 직전 설정 복원 버튼이 비활성화된다', async () => {
    systemService.getSettings.mockResolvedValueOnce({
      ...mockSettingsData,
      has_backup: false,
    });

    render(<SystemSettingsPage />);

    await waitFor(() => {
      const restoreBtns = screen.getAllByRole('button', { name: /직전 설정 복원/i });
      expect(restoreBtns[0]).toBeDisabled();
    });
  });

  it('직전 설정 복원 클릭 시 확인 후 restoreSettings를 호출한다', async () => {
    window.confirm = vi.fn(() => true);

    render(<SystemSettingsPage />);

    await waitFor(() => {
      const restoreBtns = screen.getAllByRole('button', { name: /직전 설정 복원/i });
      expect(restoreBtns[0]).not.toBeDisabled();
    });

    const restoreBtns = screen.getAllByRole('button', { name: /직전 설정 복원/i });
    fireEvent.click(restoreBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(systemService.restoreSettings).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText(/설정이 이전 백업본으로 복원되었습니다/i)).toBeInTheDocument();
  });

  it('서버 재시작 시 확인 모달 표시 후 restartServer 및 헬스체크 폴링을 수행한다', async () => {
    window.confirm = vi.fn(() => true);

    render(<SystemSettingsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^서버 재시작$/i }).length).toBeGreaterThan(0);
    });

    const restartBtns = screen.getAllByRole('button', { name: /^서버 재시작$/i });
    fireEvent.click(restartBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(systemService.restartServer).toHaveBeenCalledTimes(1);
    });

    // 재시작 진행 모달 표시 확인
    expect(screen.getByText(/서버 재기동 중/i)).toBeInTheDocument();

    // 헬스체크 성공 후 모달이 닫히고 완료 메시지 표시
    await waitFor(
      () => {
        expect(systemService.getTaskStatus).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    await waitFor(() => {
      expect(screen.queryByText(/서버 재기동 중/i)).not.toBeInTheDocument();
      expect(screen.getByText(/서버가 성공적으로 재기동되었습니다/i)).toBeInTheDocument();
    });
  });
});
