import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { isAdmin } from '@/lib/permissions';

export type Venue = 'manor' | 'hippie' | 'daisy';
export type VenueSelection = Venue | 'all';

export const ALL_VENUES: Venue[] = ['manor', 'hippie', 'daisy'];

export const VENUE_LABELS: Record<Venue, string> = {
  manor: 'Manor',
  hippie: 'Hippie Club',
  daisy: 'Daisy',
};

interface VenueContextType {
  accessibleVenues: Venue[];
  selectedVenue: VenueSelection;
  setSelectedVenue: (venue: VenueSelection) => void;
  loading: boolean;
  canAccessVenue: (venue: Venue) => boolean;
  hasMultipleVenues: boolean;
}

const VenueContext = createContext<VenueContextType | undefined>(undefined);

const STORAGE_KEY = 'gm-dashboard-selected-venue';

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [accessibleVenues, setAccessibleVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenueState] = useState<VenueSelection>('all');
  const [loading, setLoading] = useState(true);

  // Fetch user's accessible venues
  useEffect(() => {
    async function fetchVenueAccess() {
      if (!user?.email) {
        setAccessibleVenues([]);
        setLoading(false);
        return;
      }

      // Admins get all venues
      if (isAdmin(role)) {
        setAccessibleVenues(ALL_VENUES);
        setLoading(false);
        return;
      }

      try {
        // Fetch from user_venue_access table
        const { data, error } = await supabase
          .from('user_venue_access')
          .select('venue')
          .eq('email', user.email);

        if (error) {
          console.error('Failed to fetch venue access:', error);
          setAccessibleVenues([]);
        } else {
          const venues = (data || []).map(row => row.venue as Venue);
          setAccessibleVenues(venues);
        }
      } catch (err) {
        console.error('Failed to fetch venue access:', err);
        setAccessibleVenues([]);
      } finally {
        setLoading(false);
      }
    }

    fetchVenueAccess();
  }, [user?.email, role]);

  // Load persisted venue selection
  useEffect(() => {
    if (loading || accessibleVenues.length === 0) return;

    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      // Validate stored selection is still accessible
      if (stored === 'all' && accessibleVenues.length > 1) {
        setSelectedVenueState('all');
      } else if (accessibleVenues.includes(stored as Venue)) {
        setSelectedVenueState(stored as VenueSelection);
      } else {
        // Default to first accessible venue if stored is invalid
        setSelectedVenueState(accessibleVenues.length === 1 ? accessibleVenues[0] : 'all');
      }
    } else {
      // No stored value - default to 'all' if multiple venues, otherwise the single venue
      setSelectedVenueState(accessibleVenues.length === 1 ? accessibleVenues[0] : 'all');
    }
  }, [loading, accessibleVenues]);

  const setSelectedVenue = useCallback((venue: VenueSelection) => {
    setSelectedVenueState(venue);
    localStorage.setItem(STORAGE_KEY, venue);
  }, []);

  const canAccessVenue = useCallback((venue: Venue) => {
    return accessibleVenues.includes(venue);
  }, [accessibleVenues]);

  const hasMultipleVenues = accessibleVenues.length > 1;

  return (
    <VenueContext.Provider
      value={{
        accessibleVenues,
        selectedVenue,
        setSelectedVenue,
        loading,
        canAccessVenue,
        hasMultipleVenues,
      }}
    >
      {children}
    </VenueContext.Provider>
  );
}

export function useVenue() {
  const context = useContext(VenueContext);
  if (context === undefined) {
    throw new Error('useVenue must be used within a VenueProvider');
  }
  return context;
}
