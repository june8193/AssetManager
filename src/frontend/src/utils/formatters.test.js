import { describe, it, expect } from 'vitest';
import {
  formatWithCommas,
  parseCommas,
  formatCurrency,
  formatPercent,
} from './formatters';

describe('formatters', () => {
  describe('formatWithCommas', () => {
    it('숫자를 천 단위 쉼표 포맷으로 변환해야 한다', () => {
      expect(formatWithCommas(1000)).toBe('1,000');
      expect(formatWithCommas(1234567)).toBe('1,234,567');
      expect(formatWithCommas(0)).toBe('0');
    });

    it('소수점이 포함된 숫자를 올바르게 포맷팅해야 한다', () => {
      expect(formatWithCommas(1234.56)).toBe('1,234.56');
      expect(formatWithCommas('1234567.8910')).toBe('1,234,567.8910');
    });

    it('음수 숫자를 올바르게 포맷팅해야 한다', () => {
      expect(formatWithCommas(-1000)).toBe('-1,000');
      expect(formatWithCommas(-1234567.89)).toBe('-1,234,567.89');
    });

    it('이미 쉼표가 포함된 문자열도 정상 처리해야 한다', () => {
      expect(formatWithCommas('1,000,000')).toBe('1,000,000');
    });

    it('null, undefined, 빈 문자열에 대해 빈 문자열을 반환해야 한다', () => {
      expect(formatWithCommas(null)).toBe('');
      expect(formatWithCommas(undefined)).toBe('');
      expect(formatWithCommas('')).toBe('');
    });

    it('숫자가 아닌 문자열에 대해 원래 문자열을 반환해야 한다', () => {
      expect(formatWithCommas('abc')).toBe('abc');
    });
  });

  describe('parseCommas', () => {
    it('쉼표가 포함된 문자열을 숫자로 파싱해야 한다', () => {
      expect(parseCommas('1,000')).toBe(1000);
      expect(parseCommas('1,234,567.89')).toBe(1234567.89);
      expect(parseCommas('-1,234.5')).toBe(-1234.5);
    });

    it('숫자 타입이 전달된 경우 그대로 반환해야 한다', () => {
      expect(parseCommas(1000)).toBe(1000);
      expect(parseCommas(-500.5)).toBe(-500.5);
    });

    it('null, undefined, 빈 문자열, 비숫자 문자열에 대해 0을 반환해야 한다', () => {
      expect(parseCommas(null)).toBe(0);
      expect(parseCommas(undefined)).toBe(0);
      expect(parseCommas('')).toBe(0);
      expect(parseCommas('abc')).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('기본 통화(₩) 및 쉼표 포맷팅을 적용해야 한다', () => {
      expect(formatCurrency(1000000)).toBe('₩ 1,000,000');
      expect(formatCurrency(0)).toBe('₩ 0');
    });

    it('마스킹 활성화 시 ***를 반환해야 한다', () => {
      expect(formatCurrency(1000000, { isMasked: true })).toBe('***');
      expect(formatCurrency(-50000, { isMasked: true })).toBe('***');
    });

    it('showSign 옵션이 켜진 경우 부호를 표시해야 한다', () => {
      expect(formatCurrency(50000, { showSign: true })).toBe('+₩ 50,000');
      expect(formatCurrency(-50000, { showSign: true })).toBe('-₩ 50,000');
      expect(formatCurrency(0, { showSign: true })).toBe('₩ 0');
    });

    it('unit 옵션으로 다른 통화 단위나 빈 단위를 설정할 수 있어야 한다', () => {
      expect(formatCurrency(1000, { unit: '$' })).toBe('$ 1,000');
      expect(formatCurrency(1000, { unit: '', showSign: true })).toBe('+1,000');
      expect(formatCurrency(-1000, { unit: '', showSign: true })).toBe('-1,000');
      expect(formatCurrency(-1000, { unit: '' })).toBe('-1,000');
    });

    it('반올림 처리가 정상 작동해야 한다', () => {
      expect(formatCurrency(1234.56)).toBe('₩ 1,235');
      expect(formatCurrency(1234.4)).toBe('₩ 1,234');
    });

    it('null, undefined, NaN, 빈 값 입력 시 defaultValue(-)를 반환해야 한다', () => {
      expect(formatCurrency(null)).toBe('-');
      expect(formatCurrency(undefined)).toBe('-');
      expect(formatCurrency('')).toBe('-');
      expect(formatCurrency(NaN)).toBe('-');
      expect(formatCurrency(null, { defaultValue: '0' })).toBe('0');
    });
  });

  describe('formatPercent', () => {
    it('기본 백분율 포맷팅(부호 포함, 소수점 2자리)을 적용해야 한다', () => {
      expect(formatPercent(12.3456)).toBe('+12.35%');
      expect(formatPercent(-5.1)).toBe('-5.10%');
      expect(formatPercent(0)).toBe('0.00%');
    });

    it('showSign이 false인 경우 양수 부호를 생략해야 한다', () => {
      expect(formatPercent(12.3456, { showSign: false })).toBe('12.35%');
      expect(formatPercent(-5.1, { showSign: false })).toBe('-5.10%');
    });

    it('digits 옵션으로 소수점 자리수를 조절할 수 있어야 한다', () => {
      expect(formatPercent(12.3456, { digits: 1 })).toBe('+12.3%');
      expect(formatPercent(12.3456, { digits: 0 })).toBe('+12%');
    });

    it('null, undefined, NaN, 빈 값 입력 시 defaultValue(-)를 반환해야 한다', () => {
      expect(formatPercent(null)).toBe('-');
      expect(formatPercent(undefined)).toBe('-');
      expect(formatPercent('')).toBe('-');
      expect(formatPercent(NaN)).toBe('-');
      expect(formatPercent(null, { defaultValue: '0%' })).toBe('0%');
    });
  });
});
