import { useMasking } from '../contexts/MaskingContext';
import {
  formatCurrency as baseFormatCurrency,
  formatPercent as baseFormatPercent,
  formatWithCommas,
  parseCommas,
} from '../utils/formatters';

/**
 * 마스킹 컨텍스트 상태(isMasked)가 자동 연동된 포맷터 커스텀 훅
 * 
 * @returns {{
 *   isMasked: boolean,
 *   formatCurrency: (val: number|string, options?: Object) => string,
 *   formatPercent: (val: number|string, options?: Object) => string,
 *   formatWithCommas: (val: number|string) => string,
 *   parseCommas: (val: number|string) => number,
 *   maskValue: (val: any, force?: boolean) => any
 * }}
 */
export const useFormatters = () => {
  const { isMasked, maskValue } = useMasking();

  const formatCurrency = (val, options = {}) => {
    return baseFormatCurrency(val, { isMasked, ...options });
  };

  const formatPercent = (val, options = {}) => {
    return baseFormatPercent(val, options);
  };

  return {
    isMasked,
    formatCurrency,
    formatPercent,
    formatWithCommas,
    parseCommas,
    maskValue,
  };
};

export default useFormatters;
