import React, { type ReactElement, type ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { createTestQueryClient } from './renderHook'

interface AllProvidersProps {
  children: ReactNode
  queryClient?: QueryClient
}

/**
 * All providers wrapper for component testing
 * Includes: QueryClientProvider, BrowserRouter
 */
function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient()

  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  route?: string
}

/**
 * Custom render function that wraps components with all providers
 *
 * @example
 * const { getByText, getByRole } = renderWithProviders(<MyComponent />)
 * expect(getByText('Hello')).toBeInTheDocument()
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { queryClient, route = '/', ...renderOptions } = options

  // Set the initial route if provided
  window.history.pushState({}, 'Test page', route)

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AllProviders queryClient={queryClient}>
        {children}
      </AllProviders>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: queryClient || createTestQueryClient(),
  }
}

/**
 * Render with just the QueryClient (no router)
 * Useful for components that don't need routing
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'route'> = {}
) {
  const { queryClient, ...renderOptions } = options
  const client = queryClient || createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {children}
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: client,
  }
}

// Re-export testing library utilities for convenience
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
