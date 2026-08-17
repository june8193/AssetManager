/**
 * 공통 숫자, 통화, 백분율 포맷팅 및 파싱 유틸리티 모듈
 * 순수 자바스크립트 함수로 구현되어 프론트엔드 전역에서 사용됩니다.
 */

/**
 * 천 단위 쉼표 포맷터 함수
 * 
 * @param {string|number} val - 포맷팅할 값
 * @returns {string} 쉼표가 추가된 문자열
 */
export const formatWithCommas = (val) => {
  if (val === undefined || val === null || val === '') return '';
  const str = val.toString().replace(/,/g, '');
  if (isNaN(str)) return val.toString();
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

/**
 * 천 단위 쉼표가 포함된 문자열을 실수(Number)로 파싱합니다.
 * 
 * @param {string|number} val - 파싱할 값
 * @returns {number} 파싱된 숫자 (실패 시 0)
 */
export const parseCommas = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = val.toString().replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * 통화 금액 포맷팅 함수
 * 
 * @param {number|string} val - 포맷팅할 금액
 * @param {Object} [options]
 * @param {boolean} [options.isMasked=false] - 마스킹 여부
 * @param {string} [options.unit='₩'] - 통화 단위 기호
 * @param {boolean} [options.showSign=false] - 양수 부호(+) 표기 여부
 * @param {string} [options.defaultValue='-'] - 값이 유효하지 않을 때 반환할 기본값
 * @param {number} [options.digits=0] - 소수점 자리수 (기본값 0: 정수 반올림)
 * @returns {string} 포맷팅된 통화 문자열
 */
export const formatCurrency = (val, {
  isMasked = false,
  unit = '₩',
  showSign = false,
  defaultValue = '-',
  digits = 0,
} = {}) => {
  if (val === null || val === undefined || val === '') return defaultValue;
  const num = Number(val);
  if (isNaN(num)) return defaultValue;

  if (isMasked) {
    return '***';
  }

  let formattedNumber;
  if (digits === 0) {
    formattedNumber = formatWithCommas(Math.round(Math.abs(num)));
  } else {
    formattedNumber = formatWithCommas(Math.abs(num).toFixed(digits));
  }

  const prefix = unit ? `${unit} ` : '';

  if (num < 0) {
    return `-${prefix}${formattedNumber}`;
  }
  if (num > 0 && showSign) {
    return `+${prefix}${formattedNumber}`;
  }
  return `${prefix}${formattedNumber}`;
};

/**
 * 백분율(%) 포맷팅 함수
 * 
 * @param {number|string} val - 포맷팅할 수익률/비율 값
 * @param {Object} [options]
 * @param {boolean} [options.showSign=true] - 양수 부호(+) 표기 여부
 * @param {number} [options.digits=2] - 소수점 자리수
 * @param {string} [options.defaultValue='-'] - 값이 유효하지 않을 때 반환할 기본값
 * @returns {string} 포맷팅된 백분율 문자열
 */
export const formatPercent = (val, {
  showSign = true,
  digits = 2,
  defaultValue = '-',
} = {}) => {
  if (val === null || val === undefined || val === '') return defaultValue;
  const num = Number(val);
  if (isNaN(num)) return defaultValue;

  const formatted = num.toFixed(digits);
  if (showSign && num > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
};
