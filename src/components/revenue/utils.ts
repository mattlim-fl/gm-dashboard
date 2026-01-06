/**
 * @deprecated Use formatCurrency from @/utils/currencyUtils instead
 * This file is kept for backward compatibility but re-exports from the consolidated utility
 */
import { 
  formatCurrency as formatCurrencyUtil, 
  formatPercent, 
  getPercentColor,
  calculatePercentChange,
  centsToDollars
} from '@/utils/currencyUtils';

/**
 * @deprecated Use formatCurrency from @/utils/currencyUtils with excludeGST option
 */
export const formatCurrency = (amount: number) => {
  return formatCurrencyUtil(amount, { excludeGST: true });
};

export { formatPercent, getPercentColor };

/**
 * @deprecated Use calculatePercentChange from @/utils/currencyUtils instead
 */
export const calculatePercent = calculatePercentChange;

/**
 * @deprecated Use centsToDollars from @/utils/currencyUtils instead
 */
export const formatDollars = centsToDollars;