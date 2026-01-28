import { supabase } from "@/integrations/supabase/client";

export type Venue = 'manor' | 'hippie' | 'daisy';
export type MemberStatus = 'active' | 'expired' | 'cancelled';

export interface Member {
  id: string;
  venue: Venue;
  name: string;
  phone: string;
  date_of_birth: string;
  membership_start: string;
  membership_expiry: string;
  first_visit_date: string | null;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

export interface MemberInsert {
  venue: Venue;
  name: string;
  phone: string;
  date_of_birth: string;
}

export interface MemberUpdate {
  name?: string;
  phone?: string;
  date_of_birth?: string;
  status?: MemberStatus;
  first_visit_date?: string | null;
}

export interface MemberFilters {
  venue?: Venue;
  status?: MemberStatus;
  search?: string;
}

export const memberService = {
  // Get all members with optional filtering
  async fetchMembers(filters?: MemberFilters): Promise<Member[]> {
    let query = supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.venue) {
      query = query.eq('venue', filters.venue);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch members: ${error.message}`);
    }

    return (data || []) as Member[];
  },

  // Get specific member by ID
  async fetchMemberById(id: string): Promise<Member> {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch member: ${error.message}`);
    }

    return data as Member;
  },

  // Search members by name or phone (for check-in page)
  async searchMembers(query: string): Promise<Member[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order('name', { ascending: true })
      .limit(20);

    if (error) {
      throw new Error(`Failed to search members: ${error.message}`);
    }

    return (data || []) as Member[];
  },

  // Create a new member
  async createMember(data: MemberInsert): Promise<Member> {
    const { data: member, error } = await supabase
      .from('members')
      .insert({
        venue: data.venue,
        name: data.name,
        phone: data.phone,
        date_of_birth: data.date_of_birth,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`A member with this phone number already exists for ${data.venue}`);
      }
      throw new Error(`Failed to create member: ${error.message}`);
    }

    return member as Member;
  },

  // Update an existing member
  async updateMember(id: string, data: MemberUpdate): Promise<Member> {
    const { data: member, error } = await supabase
      .from('members')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update member: ${error.message}`);
    }

    return member as Member;
  },

  // Record first visit
  async recordFirstVisit(id: string): Promise<Member> {
    const { data: member, error } = await supabase
      .from('members')
      .update({ first_visit_date: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record first visit: ${error.message}`);
    }

    return member as Member;
  },
};
