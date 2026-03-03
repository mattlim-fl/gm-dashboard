import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a mock Supabase response builder
 * Mimics the chainable query builder pattern
 */
export function createMockQueryBuilder<T>(data: T | null = null, error: Error | null = null) {
  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: vi.fn((resolve) => resolve({ data, error })),
  }

  // Make it awaitable
  Object.defineProperty(mockBuilder, 'then', {
    value: (resolve: (result: { data: T | null; error: Error | null }) => void) => {
      return Promise.resolve({ data, error }).then(resolve)
    },
  })

  return mockBuilder
}

/**
 * Creates a mock Supabase RPC response
 */
export function createMockRpcBuilder<T>(data: T | null = null, error: Error | null = null) {
  return vi.fn().mockResolvedValue({ data, error })
}

/**
 * Creates a mock Supabase storage response
 */
export function createMockStorageBuilder() {
  return {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/image.jpg' } }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }
}

/**
 * Creates a mock Supabase auth response
 */
export function createMockAuthBuilder() {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  }
}

interface MockSupabaseConfig {
  tables?: Record<string, { data?: unknown; error?: Error | null }>
  rpc?: Record<string, { data?: unknown; error?: Error | null }>
  auth?: ReturnType<typeof createMockAuthBuilder>
  storage?: ReturnType<typeof createMockStorageBuilder>
}

/**
 * Creates a fully mocked Supabase client
 *
 * @example
 * const mockSupabase = createMockSupabaseClient({
 *   tables: {
 *     bookings: { data: [mockBooking], error: null },
 *     customers: { data: [], error: null },
 *   },
 *   rpc: {
 *     get_revenue_sum: { data: 10000, error: null },
 *   },
 * })
 */
export function createMockSupabaseClient(config: MockSupabaseConfig = {}) {
  const { tables = {}, rpc = {}, auth, storage } = config

  const mockClient = {
    from: vi.fn((tableName: string) => {
      const tableConfig = tables[tableName] || { data: null, error: null }
      return createMockQueryBuilder(tableConfig.data, tableConfig.error)
    }),
    rpc: vi.fn((funcName: string) => {
      const rpcConfig = rpc[funcName] || { data: null, error: null }
      return createMockRpcBuilder(rpcConfig.data, rpcConfig.error)()
    }),
    auth: auth || createMockAuthBuilder(),
    storage: storage || createMockStorageBuilder(),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
  }

  return mockClient as unknown as SupabaseClient
}

/**
 * Helper to mock the supabase client module
 * Use in beforeEach to reset mocks
 *
 * @example
 * vi.mock('@/integrations/supabase/client', () => ({
 *   supabase: createMockSupabaseClient(),
 * }))
 */
export function mockSupabaseModule(config: MockSupabaseConfig = {}) {
  return {
    supabase: createMockSupabaseClient(config),
  }
}
