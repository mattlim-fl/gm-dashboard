export type Category = 'wages' | 'cogs' | 'security' | 'rent' | 'utilities' | 'other';

export type MappingRule = {
  match: { code?: string; nameContains?: string };
  category: Category;
};

// Centralized mapping rules for Xero P&L line items
// Order matters: more specific rules should come first
// Can be extended via DB or config later
export const defaultMappingRules: MappingRule[] = [
  // Wages & Salaries (W&S prefix used in Xero account names)
  { match: { nameContains: 'w&s' }, category: 'wages' },
  { match: { nameContains: 'wage' }, category: 'wages' },
  { match: { nameContains: 'salary' }, category: 'wages' },
  { match: { nameContains: 'salaries' }, category: 'wages' },
  { match: { nameContains: 'payroll' }, category: 'wages' },
  { match: { nameContains: 'staff' }, category: 'wages' },
  { match: { nameContains: 'superannuation' }, category: 'wages' },
  { match: { nameContains: 'super ' }, category: 'wages' },
  
  // Cost of Goods Sold
  { match: { nameContains: 'cost of goods' }, category: 'cogs' },
  { match: { nameContains: 'cogs' }, category: 'cogs' },
  { match: { nameContains: 'cost of sales' }, category: 'cogs' },
  
  // Security
  { match: { nameContains: 'security' }, category: 'security' },
  { match: { nameContains: 'guard' }, category: 'security' },
  { match: { nameContains: 'bouncer' }, category: 'security' },
];

export function mapAccountToCategory(account: { Code?: string; Name?: string }): Category {
  const code = (account.Code || '').toLowerCase();
  const name = (account.Name || '').toLowerCase();
  for (const rule of defaultMappingRules) {
    if (rule.match.code && code === rule.match.code.toLowerCase()) return rule.category;
    if (rule.match.nameContains && name.includes(rule.match.nameContains.toLowerCase())) return rule.category;
  }
  return 'other';
}


