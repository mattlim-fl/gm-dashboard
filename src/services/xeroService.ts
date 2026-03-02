import { config } from '@/config/env';

const API_BASE_URL = config.apiBaseUrl;

export type PnlResponse = {
  period: { start: string; end: string };
  totals: { income: number; expenses: number; netProfit: number };
  categories: Record<string, number>;
  uncategorized: Array<{ name?: string; section?: string; amount: number }>;
  meta?: { cached: boolean; lastUpdated?: string };
};

export async function fetchAccounts() {
  const resp = await fetch(`${API_BASE_URL}/xero/accounts`);
  if (!resp.ok) throw new Error(`Accounts failed: ${resp.status}`);
  return await resp.json();
}

export async function fetchPnl(startDate: string, endDate: string, refresh?: boolean): Promise<PnlResponse> {
  const resp = await fetch(`${API_BASE_URL}/xero/pnl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, refresh: !!refresh }),
  });
  const text = await resp.text();
  let json: PnlResponse | { detail?: string; error?: string } | null = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore parse errors */ }
  if (!resp.ok) {
    const errorJson = json as { detail?: string; error?: string } | null;
    throw new Error(errorJson?.detail || errorJson?.error || `P&L failed: ${resp.status}`);
  }
  return json as PnlResponse;
}



