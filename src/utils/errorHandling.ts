/**
 * Standardized error handling utilities
 * Provides consistent error handling patterns across the application
 */

import { toast } from "@/hooks/use-toast";

export interface ErrorContext {
  operation: string;
  component?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard error handler that logs and optionally shows toast
 */
export const handleError = (
  error: unknown,
  context: ErrorContext,
  options: {
    showToast?: boolean;
    logToConsole?: boolean;
    silent?: boolean;
  } = {}
): void => {
  const {
    showToast = true,
    logToConsole = true,
    silent = false,
  } = options;

  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : 'An unexpected error occurred';

  const fullMessage = `${context.operation} failed${context.component ? ` in ${context.component}` : ''}`;

  if (logToConsole && !silent) {
    console.error(`[Error] ${fullMessage}:`, error, context.details);
  }

  if (showToast && !silent) {
    toast({
      title: fullMessage,
      description: errorMessage,
      variant: "destructive",
    });
  }
};

/**
 * Wraps an async function with standardized error handling
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext,
  options?: {
    showToast?: boolean;
    logToConsole?: boolean;
    silent?: boolean;
  }
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context, options);
      throw error; // Re-throw to allow caller to handle if needed
    }
  }) as T;
};

/**
 * Handles errors silently (for operations where errors are expected/acceptable)
 * Still logs to console in development
 */
export const handleErrorSilently = (
  error: unknown,
  context: ErrorContext
): void => {
  handleError(error, context, {
    showToast: false,
    logToConsole: process.env.NODE_ENV === 'development',
    silent: true,
  });
};

/**
 * Extracts error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unexpected error occurred';
};

/**
 * Checks if error is a network/API error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout');
  }
  return false;
};

/**
 * Checks if error is an authentication error
 */
export const isAuthError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('401') ||
           error.message.includes('unauthorized') ||
           error.message.includes('authentication');
  }
  return false;
};

