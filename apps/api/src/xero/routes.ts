import { Hono } from 'hono';
import { getAccounts, getProfitAndLoss } from './client';
import { z } from 'zod';
import { type Clients } from '../middleware/auth';
import { getXeroAccessToken, getXeroCredentials } from '../shared/credentials';
import { mapAccountToCategory } from './mapping';
import type {
  XeroAccount,
  XeroAccountsResponse,
  XeroPnlResponse,
  XeroPnlRow,
  XeroPnlCell,
  UncategorizedItem,
  PnlResult,
} from './types';

export const xero = new Hono();

// Default venue for Xero operations (uses organization-level credentials)
// All venues in the same org share Xero credentials
const DEFAULT_VENUE_FOR_XERO = 'manor';

// Fetch Accounts (trimmed)
xero.get('/accounts', async (c) => {
  const venue = c.req.query('venue') || DEFAULT_VENUE_FOR_XERO;

  // @ts-ignore
  const { supabaseService } = c.get('clients') as Clients;

  // Get fresh access token using the new credentials system
  const xeroAuth = await getXeroAccessToken(supabaseService, venue);
  if (!xeroAuth) return c.json({ error: 'Xero not connected' }, 400);

  let json: XeroAccountsResponse | null = null;
  try {
    json = await getAccounts(xeroAuth.accessToken, xeroAuth.tenantId) as XeroAccountsResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Xero] Accounts failed:', msg);
    return c.json({ error: 'Xero Accounts request failed', detail: msg }, 502);
  }

  const items = (json?.Accounts || []).map((a: XeroAccount) => ({
    AccountID: a.AccountID,
    Code: a.Code,
    Name: a.Name,
    Type: a.Type,
  }));
  return c.json({ accounts: items });
});

// Fetch Profit & Loss and normalize
xero.post('/pnl', async (c) => {
  const Body = z.object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    refresh: z.boolean().optional(),
    venue: z.string().optional(),
  });
  const input = Body.safeParse(await c.req.json().catch(() => ({})));
  if (!input.success) return c.json({ error: input.error.flatten() }, 400);

  const venue = input.data.venue || DEFAULT_VENUE_FOR_XERO;

  // @ts-ignore
  const { supabaseService } = c.get('clients') as Clients;

  // Get Xero credentials to check tenant_id for caching
  const creds = await getXeroCredentials(supabaseService, venue);
  if (!creds) return c.json({ error: 'Xero not connected' }, 400);

  // Caching: try snapshot first unless refresh requested
  if (!input.data.refresh) {
    const { data: existing, error: snapErr } = await supabaseService
      .from('xero_pnl_snapshots')
      .select('id,result_json,updated_at')
      .eq('tenant_id', creds.tenant_id)
      .eq('start_date', input.data.startDate)
      .eq('end_date', input.data.endDate)
      .maybeSingle();
    if (!snapErr && existing?.result_json) {
      const withMeta = { ...existing.result_json, meta: { cached: true, lastUpdated: existing.updated_at } };
      return c.json(withMeta);
    }
  }

  // Get fresh access token
  const xeroAuth = await getXeroAccessToken(supabaseService, venue);
  if (!xeroAuth) return c.json({ error: 'Xero not connected' }, 400);

  let data: XeroPnlResponse | null = null;
  try {
    data = await getProfitAndLoss(xeroAuth.accessToken, xeroAuth.tenantId, input.data.startDate, input.data.endDate) as XeroPnlResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Xero] P&L fetch failed:', msg);
    return c.json({ error: 'Xero P&L request failed', detail: msg }, 502);
  }

  // Accounting Reports API structure: data.Reports[0].Rows is a tree.
  const period = { start: input.data.startDate, end: input.data.endDate };
  let incomeTotal = 0;
  let expenseTotal = 0;
  const categories: Record<string, number> = {};
  const uncategorized: UncategorizedItem[] = [];

  const rows: XeroPnlRow[] = data?.Reports?.[0]?.Rows || [];

  const parseAmount = (s: string | number | undefined | null): number => {
    if (s == null) return 0;
    const str = String(s).replace(/[,\s]/g, '');
    if (!str) return 0;
    // Handle (123.45) as negative
    const negative = /^\(.*\)$/.test(str);
    const cleaned = str.replace(/[()]/g, '');
    const n = Number(cleaned);
    return negative ? -Math.abs(n) : n;
  };

  function walk(rowsToWalk: XeroPnlRow[], section: string | null) {
    for (const r of rowsToWalk || []) {
      if (r.RowType === 'Section') {
        const title = (r.Title || section || '').toString();
        walk(r.Rows || [], title);
        continue;
      }
      if (r.RowType === 'SummaryRow') {
        // Skip summary rows like "Total Income", "Total Operating Expenses", etc.
        continue;
      }
      if (r.RowType === 'Row' && Array.isArray(r.Cells)) {
        const label = (r.Cells[0]?.Value || '').toString();
        // pick the last numeric-looking cell as amount
        const lastCell = [...r.Cells].reverse().find((c: XeroPnlCell) => c && c.Value != null);
        const amount = parseAmount(lastCell?.Value);
        if (!label) continue;

        // Skip calculated values that aren't actual line items
        const labelL = label.toLowerCase();
        if (labelL === 'gross profit' || labelL === 'net profit' || labelL.startsWith('total ')) {
          continue;
        }

        const sectionL = (section || '').toLowerCase();

        // Determine if this is income or expense based on section
        const isIncome = sectionL.includes('revenue') || sectionL.includes('income');
        // Treat everything that is not income as an expense. This is more robust
        // than trying to enumerate all possible expense section names (Operating Expenses,
        // Direct Costs, Overheads, etc.) and matches how Xero structures P&L.
        const isExpense = !isIncome;

        // Use centralized mapping function to categorize line items
        // This allows us to maintain all mapping rules in one place (mapping.ts)
        // and makes it easier to extend to database-backed mappings later
        let cat = mapAccountToCategory({ Name: label });

        // Also check section name for COGS (Direct Costs, Cost of Sales sections)
        if (
          cat === 'other' &&
          (sectionL.includes('cost of sales') ||
           sectionL.includes('cost of goods') ||
           sectionL.includes('direct costs'))
        ) {
          cat = 'cogs';
        }

        if (isIncome) {
          // Income items - add to income total, don't add to categories
          incomeTotal += amount;
        } else if (isExpense) {
          // Expenses - add to expense total and categories
          expenseTotal += Math.abs(amount);
          categories[cat] = (categories[cat] || 0) + Math.abs(amount);
          // Only add to uncategorized if it's in the "other" category
          // so we can inspect where remaining costs are coming from.
          if (cat === 'other') {
            uncategorized.push({ name: label, section, amount });
          }
        }
        // Skip rows with unclear sections (like empty sections for Gross Profit/Net Profit)
        continue;
      }
      if (Array.isArray(r.Rows)) walk(r.Rows, section);
    }
  }

  walk(rows, null);

  const result: PnlResult = {
    period,
    totals: { income: incomeTotal, expenses: expenseTotal, netProfit: incomeTotal - expenseTotal },
    categories,
    uncategorized,
    raw: data ?? undefined,
  };
  // Save snapshot
  await supabaseService
    .from('xero_pnl_snapshots')
    .upsert({
      tenant_id: creds.tenant_id,
      start_date: input.data.startDate,
      end_date: input.data.endDate,
      result_json: result,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,start_date,end_date' });
  return c.json({ ...result, meta: { cached: false, lastUpdated: new Date().toISOString() } });
});
