import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DynamicPresetToolbar from './DynamicPresetToolbar';

describe('DynamicPresetToolbar 단위 테스트', () => {
  const mockPresets = [
    {
      id: 1,
      name: '기본 추천 (3단계 분할매수)',
      description: '낙폭 및 VIX 결합 3단계 공포 분할매수 전략',
      base_stock_ratio: 60.0,
      rebalancing_period: 'monthly',
      investment_mode: 'recurring',
      annual_deposit: 20000000,
      period: '5Y',
      is_default: true,
      tiers: [
        { tier: 1, dd_threshold: -10, vix_threshold: 25, target_stock_ratio: 75 },
      ]
    },
    {
      id: 2,
      name: '내 공격형 전략',
      description: '공격형 비중 분할매수',
      base_stock_ratio: 70.0,
      rebalancing_period: 'monthly',
      investment_mode: 'recurring',
      annual_deposit: 10000000,
      period: '10Y',
      is_default: false,
      tiers: [
        { tier: 1, dd_threshold: -15, vix_threshold: 28, target_stock_ratio: 85 },
      ]
    }
  ];

  it('프리셋 셀렉트박스와 저장/수정/삭제 버튼이 렌더링된다', () => {
    render(
      <DynamicPresetToolbar
        presets={mockPresets}
        selectedPresetId={1}
        onSelectPreset={vi.fn()}
        onSaveNewPreset={vi.fn()}
        onUpdatePreset={vi.fn()}
        onDeletePreset={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: /전략 프리셋 선택/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /프리셋 저장/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /프리셋 수정/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /프리셋 삭제/i })).toBeDefined();
  });

  it('셀렉트박스 변경 시 onSelectPreset이 호출된다', () => {
    const handleSelect = vi.fn();
    render(
      <DynamicPresetToolbar
        presets={mockPresets}
        selectedPresetId={1}
        onSelectPreset={handleSelect}
        onSaveNewPreset={vi.fn()}
        onUpdatePreset={vi.fn()}
        onDeletePreset={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox', { name: /전략 프리셋 선택/i });
    fireEvent.change(select, { target: { value: '2' } });

    expect(handleSelect).toHaveBeenCalledWith(mockPresets[1]);
  });

  it('[저장] 버튼 클릭 시 모달이 열리고 이름을 입력하여 저장을 호출한다', async () => {
    const handleSave = vi.fn().mockResolvedValue();
    render(
      <DynamicPresetToolbar
        presets={mockPresets}
        selectedPresetId={1}
        onSelectPreset={vi.fn()}
        onSaveNewPreset={handleSave}
        onUpdatePreset={vi.fn()}
        onDeletePreset={vi.fn()}
      />
    );

    // 모달 열기
    fireEvent.click(screen.getByRole('button', { name: /프리셋 저장/i }));
    expect(screen.getByText('새 전략 프리셋으로 저장')).toBeDefined();

    // 이름 및 설명 입력
    const nameInput = screen.getByPlaceholderText('예: 공포지수 2단계 분할매수');
    const descInput = screen.getByPlaceholderText('전략에 대한 간단한 설명을 입력하세요');
    fireEvent.change(nameInput, { target: { value: '새로운 맞춤 전략' } });
    fireEvent.change(descInput, { target: { value: '나만의 백테스트 세팅' } });

    // 확인 클릭
    const confirmBtn = screen.getByRole('button', { name: '저장하기' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        name: '새로운 맞춤 전략',
        description: '나만의 백테스트 세팅'
      });
    });
  });

  it('[수정] 버튼 클릭 시 모달이 열리고 수정 확인을 호출한다', async () => {
    const handleUpdate = vi.fn().mockResolvedValue();
    render(
      <DynamicPresetToolbar
        presets={mockPresets}
        selectedPresetId={2}
        onSelectPreset={vi.fn()}
        onSaveNewPreset={vi.fn()}
        onUpdatePreset={handleUpdate}
        onDeletePreset={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /프리셋 수정/i }));
    expect(screen.getByText('전략 프리셋 수정')).toBeDefined();

    const nameInput = screen.getByLabelText('수정할 프리셋 명칭');
    fireEvent.change(nameInput, { target: { value: '내 공격형 전략 (수정)' } });


    const confirmBtn = screen.getByRole('button', { name: '수정 완료' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(2, {
        name: '내 공격형 전략 (수정)',
        description: '공격형 비중 분할매수'
      });
    });
  });

  it('[삭제] 버튼 클릭 시 삭제 확인 모달이 열리고 삭제를 호출한다', async () => {
    const handleDelete = vi.fn().mockResolvedValue();
    render(
      <DynamicPresetToolbar
        presets={mockPresets}
        selectedPresetId={2}
        onSelectPreset={vi.fn()}
        onSaveNewPreset={vi.fn()}
        onUpdatePreset={vi.fn()}
        onDeletePreset={handleDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /프리셋 삭제/i }));
    expect(screen.getByText(/프리셋을 삭제하시겠습니까/i)).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: '삭제 확인' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalledWith(2);
    });
  });
});
