/**
 * Unified currency formatting utilities
 * Handles all currency formatting needs across the application
 */

export interface CurrencyFormatOptions {
  /** Currency code (USD, AUD, etc.) */
  currency?: 'USD' | 'AUD';
  /** Whether to exclude GST (divide by 1.1) */
  excludeGST?: boolean;
  /** Number of decimal places */
  decimals?: number;
  /** Whether the input is in cents (true) or dollars (false) */
  inputInCents?: boolean;
}

/**
 * Formats a currency amount with consistent options
 * 
 * @param amount - The amount to format (in cents or dollars based on inputInCents)
 * @param options - Formatting options
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(10000, { inputInCents: true }) // "$100.00"
 * formatCurrency(100, { excludeGST: true }) // "$90.91" (GST excluded)
 * formatCurrency(100, { currency: 'AUD' }) // "A$100.00"
 */
export const formatCurrency = (
  amount: number | null | undefined,
  options: CurrencyFormatOptions = {}
): string => {
  if (amount === null || amount === undefined) return '-';
  
  const {
    currency = 'USD',
    excludeGST = false,
    decimals = 0,
    inputInCents = false,
  } = options;

  // Convert from cents to dollars if needed
  let dollars = inputInCents ? amount / 100 : amount;

  // Exclude GST by dividing by 1.1 (removes 10% GST component)
  if (excludeGST) {
    dollars = dollars / 1.1;
  }

  // Determine locale based on currency
  const locale = currency === 'AUD' ? 'en-AU' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(dollars);
};

/**
 * Formats a percentage value with optional sign
 * 
 * @param value - The percentage value (e.g., 5.5 for 5.5%)
 * @param options - Formatting options
 * @returns Formatted percentage string
 * 
 * @example
 * formatPercent(5.5) // "+5.5%"
 * formatPercent(-3.2) // "-3.2%"
 * formatPercent(0) // "0.0%"
 */
export const formatPercent = (
  value: number | null | undefined,
  options: { decimals?: number; showSign?: boolean } = {}
): string => {
  if (value === null || value === undefined) return '—';
  
  const { decimals = 1, showSign = true } = options;
  
  if (value === 0) return `0.${'0'.repeat(decimals)}%`;
  
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

/**
 * Gets the color class for a percentage value (positive/negative)
 * 
 * @param value - The percentage value
 * @returns Tailwind CSS color class
 */
export const getPercentColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'text-muted-foreground';
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-muted-foreground';
};

/**
 * Calculates percentage change between two values
 * 
 * @param current - Current value
 * @param previous - Previous value
 * @returns Percentage change
 */
export const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Converts cents to dollars
 * 
 * @param cents - Amount in cents
 * @returns Amount in dollars
 */
export const centsToDollars = (cents: number): number => cents / 100;

/**
 * Converts dollars to cents
 * 
 * @param dollars - Amount in dollars
 * @returns Amount in cents
 */
export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);

