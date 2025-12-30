import type { Enums } from '@/integrations/supabase/types';

export type StaffRole = Enums<'staff_role'> | null;

export function isAdmin(role: StaffRole): boolean {
  return role === 'admin';
}

export function canViewFinancial(role: StaffRole): boolean {
  return isAdmin(role);
}

export function canManageTeam(role: StaffRole): boolean {
  return isAdmin(role);
}


















