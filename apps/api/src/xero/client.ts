export async function getAccounts(accessToken: string, tenantId: string) {
  const resp = await fetch("https://api.xero.com/api.xro/2.0/Accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Xero accounts failed: ${resp.status} ${text}`);
  }
  return await resp.json();
}

export async function getProfitAndLoss(
  accessToken: string,
  tenantId: string,
  startDate: string,
  endDate: string
) {
  // Use Accounting Reports P&L (Finance API is restricted for partners)
  const base = "https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss";
  const params = new URLSearchParams({
    fromDate: startDate,
    toDate: endDate,
  });
  const url = `${base}?${params.toString()}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Xero P&L failed: ${resp.status} ${text}`);
  }
  return await resp.json();
}
