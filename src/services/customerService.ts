import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

export type CustomerRow = Database['public']['Tables']['customers']['Row'];
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

export interface CustomerFilters {
  search?: string;
  includeArchived?: boolean;
}

export const customerService = {
  // Get all customers with optional filtering
  async getCustomers(filters?: CustomerFilters): Promise<CustomerRow[]> {
    let query = supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    // By default, exclude archived customers unless explicitly requested
    if (!filters?.includeArchived) {
      query = query.eq('is_archived', false);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch customers: ${error.message}`);
    }

    return data || [];
  },

  // Get specific customer by ID
  async getCustomer(id: string): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch customer: ${error.message}`);
    }

    return data;
  },

  // Check if a customer with the same email or phone already exists
  async checkDuplicate(email?: string | null, phone?: string | null): Promise<CustomerRow | null> {
    if (!email && !phone) {
      return null; // Can't check duplicates without email or phone
    }

    let query = supabase
      .from('customers')
      .select('*')
      .eq('is_archived', false); // Only check non-archived customers

    const conditions: string[] = [];
    
    if (email) {
      // Use ilike for case-insensitive exact email matching
      conditions.push(`email.ilike.${email}`);
    }
    
    if (phone) {
      // For phone, we want exact match
      conditions.push(`phone.eq.${phone}`);
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }

    const { data, error } = await query.limit(1);

    if (error) {
      throw new Error(`Failed to check for duplicate customer: ${error.message}`);
    }

    return data && data.length > 0 ? data[0] : null;
  },

  // Create new customer (or member)
  async createCustomer(customer: CustomerInsert): Promise<CustomerRow> {
    // Check for duplicates before creating
    const duplicate = await this.checkDuplicate(customer.email, customer.phone);
    
    if (duplicate) {
      const duplicateFields: string[] = [];
      if (customer.email && duplicate.email && duplicate.email.toLowerCase() === customer.email.toLowerCase()) {
        duplicateFields.push('email');
      }
      if (customer.phone && duplicate.phone && duplicate.phone === customer.phone) {
        duplicateFields.push('phone');
      }
      
      throw new Error(
        `A customer with the same ${duplicateFields.join(' and ')} already exists: ${duplicate.name}`
      );
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create customer: ${error.message}`);
    }

    return data;
  },

  // Update existing customer
  async updateCustomer(id: string, updates: CustomerUpdate): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    return data;
  },

  // Archive a customer (soft delete)
  async archiveCustomer(id: string): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('customers')
      .update({ 
        is_archived: true,
        archived_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive customer: ${error.message}`);
    }

    return data;
  },

  // Unarchive a customer
  async unarchiveCustomer(id: string): Promise<CustomerRow> {
    const { data, error } = await supabase
      .from('customers')
      .update({ 
        is_archived: false,
        archived_at: null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to unarchive customer: ${error.message}`);
    }

    return data;
  }
};
