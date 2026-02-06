import { Hono } from 'hono';
import { buildAuthorizeUrl, exchangeCodeForToken, getConnections, getAccounts, getProfitAndLoss, refreshAccessToken } from './client';
import { env } from '../env';
import { z } from 'zod';
import { type Clients } from '../middleware/auth';
import { decryptSecret, getStoredConnection, upsertConnection } from './tokenStore';
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

// Start OAuth consent
xero.get('/connect', (c) => {
  const state = Math.random().toString(36).slice(2);
  const url = buildAuthorizeUrl(state);
  // Temporary debug to diagnose invalid scope/redirect issues
  console.log('[Xero] /connect authorize URL:', url);
  console.log('[Xero] scopes:', env.XERO_SCOPES);
  console.log('[Xero] redirect_uri:', env.XERO_REDIRECT_URI);
  return c.redirect(url, 302);
});

// OAuth callback: exchange code, fetch connections, store tokens
xero.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'Missing code' }, 400);
  const token = await exchangeCodeForToken(code);
  const connections = await getConnections(token.access_token);
  if (!Array.isArray(connections) || connections.length === 0) {
    return c.json({ error: 'No Xero connections found after auth' }, 400);
  }
  const primary = connections[0];
  const tenantId = primary.tenantId;
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  // @ts-ignore
  const { supabaseService } = c.get('clients') as Clients;
  await upsertConnection(supabaseService, {
    tenantId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
    scopes: (token.scope || env.XERO_SCOPES).split(/[\s,]+/).filter(Boolean),
  });

  return c.html('<html><body><h3>Xero connected successfully.</h3><p>You can close this window.</p></body></html>');
});

// Fetch Accounts (trimmed)
xero.get('/accounts', async (c) => {
  // @ts-ignore
  const { supabaseService } = c.get('clients') as Clients;
  let con = await getStoredConnection(supabaseService);
  if (!con) return c.json({ error: 'Xero not connected' }, 400);
  // Refresh if expiring
  if (new Date(con.expires_at).getTime() < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(decryptSecret(con.refresh_token_enc));
    const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await upsertConnection(supabaseService, {
      tenantId: con.tenant_id,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: newExpires,
      scopes: (refreshed.scope || env.XERO_SCOPES).split(/[\s,]+/).filter(Boolean),
    });
    con = (await getStoredConnection(supabaseService))!;
  }
  let json: XeroAccountsResponse | null = null;
  try {
    json = await getAccounts(con.access_token, con.tenant_id) as XeroAccountsResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If Xero responded unauthorized, force a refresh and retry once
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
      const refreshed = await refreshAccessToken(decryptSecret(con.refresh_token_enc));
      const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await upsertConnection(supabaseService, {
        tenantId: con.tenant_id,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: newExpires,
        scopes: (refreshed.scope || env.XERO_SCOPES).split(/[\s,]+/).filter(Boolean),
      });
      con = (await getStoredConnection(supabaseService))!;
      json = await getAccounts(con.access_token, con.tenant_id) as XeroAccountsResponse;
    } else {
      console.error('[Xero] Accounts failed:', msg);
      return c.json({ error: 'Xero Accounts request failed', detail: msg }, 502);
    }
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
  const Body = z.object({ startDate: z.string().min(1), endDate: z.string().min(1), refresh: z.boolean().optional() });
  const input = Body.safeParse(await c.req.json().catch(() => ({})));
  if (!input.success) return c.json({ error: input.error.flatten() }, 400);

  // @ts-ignore
  const { supabaseService } = c.get('clients') as Clients;
  let con = await getStoredConnection(supabaseService);
  if (!con) return c.json({ error: 'Xero not connected' }, 400);
  if (new Date(con.expires_at).getTime() < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(decryptSecret(con.refresh_token_enc));
    const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await upsertConnection(supabaseService, {
      tenantId: con.tenant_id,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: newExpires,
      scopes: (refreshed.scope || env.XERO_SCOPES).split(/[\s,]+/).filter(Boolean),
    });
    con = (await getStoredConnection(supabaseService))!;
  }

  // Caching: try snapshot first unless refresh requested
  if (!input.data.refresh) {
    const { data: existing, error: snapErr } = await supabaseService
      .from('xero_pnl_snapshots')
      .select('id,result_json,updated_at')
      .eq('tenant_id', con.tenant_id)
      .eq('start_date', input.data.startDate)
      .eq('end_date', input.data.endDate)
      .maybeSingle();
    if (!snapErr && existing?.result_json) {
      const withMeta = { ...existing.result_json, meta: { cached: true, lastUpdated: existing.updated_at } };
      return c.json(withMeta);
    }
  }

  let data: XeroPnlResponse | null = null;
  try {
    data = await getProfitAndLoss(con.access_token, con.tenant_id, input.data.startDate, input.data.endDate) as XeroPnlResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // If unauthorized, refresh and retry once
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
      const refreshed = await refreshAccessToken(decryptSecret(con.refresh_token_enc));
      const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await upsertConnection(supabaseService, {
        tenantId: con.tenant_id,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: newExpires,
        scopes: (refreshed.scope || env.XERO_SCOPES).split(/[\s,]+/).filter(Boolean),
      });
      con = (await getStoredConnection(supabaseService))!;
      data = await getProfitAndLoss(con.access_token, con.tenant_id, input.data.startDate, input.data.endDate) as XeroPnlResponse;
    } else {
      console.error('[Xero] P&L fetch failed:', msg);
      return c.json({ error: 'Xero P&L request failed', detail: msg }, 502);
    }
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
      tenant_id: con.tenant_id,
      start_date: input.data.startDate,
      end_date: input.data.endDate,
      result_json: result,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,start_date,end_date' });
  return c.json({ ...result, meta: { cached: false, lastUpdated: new Date().toISOString() } });
});


