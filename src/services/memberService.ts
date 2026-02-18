import { supabase } from "@/integrations/supabase/client";

export type Venue = 'manor' | 'hippie' | 'daisy';
export type MemberStatus = 'active' | 'expired' | 'cancelled';

export interface Member {
  id: string;
  venue: Venue;
  name: string;
  phone: string;
  date_of_birth: string | null;
  membership_start: string;
  membership_expiry: string;
  first_visit_date: string | null;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberInsert {
  venue: Venue;
  name: string;
  phone: string;
  date_of_birth?: string;
  notes?: string;
}

export interface MemberUpdate {
  name?: string;
  phone?: string;
  date_of_birth?: string;
  status?: MemberStatus;
  first_visit_date?: string | null;
  notes?: string | null;
}

export interface MemberFilters {
  venue?: Venue;
  status?: MemberStatus;
  search?: string;
}

export interface MemberWithCheckin extends Member {
  isCheckedIn: boolean;
  checkedInAt: string | null;
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
    const insertData: any = {
      venue: data.venue,
      name: data.name,
      phone: data.phone,
    };
    if (data.date_of_birth) {
      insertData.date_of_birth = data.date_of_birth;
    }

    const { data: member, error } = await supabase
      .from('members')
      .insert(insertData)
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

  // Fetch members with check-in status for a specific date
  async fetchMembersWithCheckins(date: string, venue?: Venue): Promise<MemberWithCheckin[]> {
    // Fetch all active members
    let membersQuery = supabase
      .from('members')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (venue) {
      membersQuery = membersQuery.eq('venue', venue);
    }

    const { data: members, error: membersError } = await membersQuery;

    if (membersError) {
      throw new Error(`Failed to fetch members: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      return [];
    }

    // Fetch check-ins for this date
    const memberIds = members.map(m => m.id);
    const { data: checkins, error: checkinsError } = await supabase
      .from('member_checkins')
      .select('member_id, checked_in_at')
      .eq('checkin_date', date)
      .in('member_id', memberIds);

    if (checkinsError) {
      throw new Error(`Failed to fetch check-ins: ${checkinsError.message}`);
    }

    // Create a map of member_id -> check-in for quick lookup
    const checkinMap = new Map<string, string>();
    (checkins || []).forEach((c: any) => {
      checkinMap.set(c.member_id, c.checked_in_at);
    });

    // Transform to MemberWithCheckin format
    return members.map((member: any) => {
      const checkedInAt = checkinMap.get(member.id) || null;

      return {
        id: member.id,
        venue: member.venue,
        name: member.name,
        phone: member.phone,
        date_of_birth: member.date_of_birth,
        membership_start: member.membership_start,
        membership_expiry: member.membership_expiry,
        first_visit_date: member.first_visit_date,
        status: member.status,
        notes: member.notes,
        created_at: member.created_at,
        updated_at: member.updated_at,
        isCheckedIn: !!checkedInAt,
        checkedInAt,
      } as MemberWithCheckin;
    });
  },

  // Check in a member for a specific date
  async checkInMember(memberId: string, date: string): Promise<void> {
    const { error } = await supabase
      .from('member_checkins')
      .upsert({
        member_id: memberId,
        checkin_date: date,
        checked_in_at: new Date().toISOString(),
      }, { onConflict: 'member_id,checkin_date' });

    if (error) {
      throw new Error(`Failed to check in member: ${error.message}`);
    }
  },

  // Uncheck a member for a specific date
  async uncheckMember(memberId: string, date: string): Promise<void> {
    const { error } = await supabase
      .from('member_checkins')
      .delete()
      .eq('member_id', memberId)
      .eq('checkin_date', date);

    if (error) {
      throw new Error(`Failed to uncheck member: ${error.message}`);
    }
  },
};
