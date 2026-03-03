import React, { type ReactNode } from 'react'
import { renderHook as rtlRenderHook, type RenderHookOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Create a fresh QueryClient for each test
 * Configured with sensible test defaults
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

interface WrapperProps {
  children: ReactNode
}

/**
 * Creates a wrapper component with QueryClientProvider
 * @param queryClient - Optional pre-configured QueryClient
 */
export function createQueryWrapper(queryClient?: QueryClient) {
  const client = queryClient || createTestQueryClient()

  return function QueryWrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    )
  }
}

/**
 * Render a hook with React Query provider
 *
 * @example
 * const { result, waitFor } = renderHook(() => useBookings())
 *
 * await waitFor(() => {
 *   expect(result.current.isSuccess).toBe(true)
 * })
 */
export function renderHook<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'> & {
    queryClient?: QueryClient
  }
) {
  const { queryClient, ...restOptions } = options || {}
  const wrapper = createQueryWrapper(queryClient)

  return rtlRenderHook(hook, {
    wrapper,
    ...restOptions,
  })
}

/**
 * Render a hook with a custom wrapper that includes QueryClientProvider
 * Useful when you need additional providers (e.g., Router, Theme)
 *
 * @example
 * const { result } = renderHookWithWrapper(
 *   () => useMyHook(),
 *   ({ children }) => (
 *     <ThemeProvider>
 *       <QueryClientProvider client={queryClient}>
 *         {children}
 *       </QueryClientProvider>
 *     </ThemeProvider>
 *   )
 * )
 */
export function renderHookWithWrapper<TProps, TResult>(
  hook: (props: TProps) => TResult,
  wrapper: React.ComponentType<{ children: ReactNode }>,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>
) {
  return rtlRenderHook(hook, {
    wrapper,
    ...options,
  })
}
