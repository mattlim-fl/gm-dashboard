export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: []
      }
      booking_guests: {
        Row: {
          booking_id: string
          created_at: string | null
          guest_name: string
          id: string
          is_organiser: boolean
          updated_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          guest_name: string
          id?: string
          is_organiser?: boolean
          updated_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          guest_name?: string
          id?: string
          is_organiser?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "karaoke_booking_guests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          booking_source: string | null
          booking_type: string
          capacity: number | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          duration_hours: number | null
          end_time: string | null
          export_date: string | null
          exported_to_megatix: boolean | null
          guest_count: number | null
          guest_list_token: string | null
          id: string
          is_occasion_organiser: boolean | null
          karaoke_booth_id: string | null
          occasion_name: string | null
          organiser_token: string | null
          parent_booking_id: string | null
          payment_attempted_at: string | null
          payment_completed_at: string | null
          payment_status: string | null
          reference_code: string | null
          share_token: string | null
          special_requests: string | null
          square_payment_id: string | null
          staff_notes: string | null
          start_time: string | null
          status: string
          ticket_checkins: Json | null
          ticket_price_cents: number | null
          ticket_quantity: number | null
          total_amount: number | null
          updated_at: string | null
          venue: string
          venue_area: string | null
        }
        Insert: {
          booking_date: string
          booking_source?: string | null
          booking_type: string
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          duration_hours?: number | null
          end_time?: string | null
          export_date?: string | null
          exported_to_megatix?: boolean | null
          guest_count?: number | null
          guest_list_token?: string | null
          id?: string
          is_occasion_organiser?: boolean | null
          karaoke_booth_id?: string | null
          occasion_name?: string | null
          organiser_token?: string | null
          parent_booking_id?: string | null
          payment_attempted_at?: string | null
          payment_completed_at?: string | null
          payment_status?: string | null
          reference_code?: string | null
          share_token?: string | null
          special_requests?: string | null
          square_payment_id?: string | null
          staff_notes?: string | null
          start_time?: string | null
          status?: string
          ticket_checkins?: Json | null
          ticket_price_cents?: number | null
          ticket_quantity?: number | null
          total_amount?: number | null
          updated_at?: string | null
          venue: string
          venue_area?: string | null
        }
        Update: {
          booking_date?: string
          booking_source?: string | null
          booking_type?: string
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          duration_hours?: number | null
          end_time?: string | null
          export_date?: string | null
          exported_to_megatix?: boolean | null
          guest_count?: number | null
          guest_list_token?: string | null
          id?: string
          is_occasion_organiser?: boolean | null
          karaoke_booth_id?: string | null
          occasion_name?: string | null
          organiser_token?: string | null
          parent_booking_id?: string | null
          payment_attempted_at?: string | null
          payment_completed_at?: string | null
          payment_status?: string | null
          reference_code?: string | null
          share_token?: string | null
          special_requests?: string | null
          square_payment_id?: string | null
          staff_notes?: string | null
          start_time?: string | null
          status?: string
          ticket_checkins?: Json | null
          ticket_price_cents?: number | null
          ticket_quantity?: number | null
          total_amount?: number | null
          updated_at?: string | null
          venue?: string
          venue_area?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_karaoke_booth_id_fkey"
            columns: ["karaoke_booth_id"]
            isOneToOne: false
            referencedRelation: "karaoke_booths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_benchmarks: {
        Row: {
          benchmark_percent: number
          category: string
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          benchmark_percent?: number
          category: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          benchmark_percent?: number
          category?: string
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          archived_at: string | null
          created_at: string | null
          email: string | null
          id: string
          is_archived: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          venue: string
          name: string
          phone: string
          date_of_birth: string
          membership_start: string
          membership_expiry: string
          first_visit_date: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue: string
          name: string
          phone: string
          date_of_birth: string
          membership_start?: string
          membership_expiry?: string
          first_visit_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue?: string
          name?: string
          phone?: string
          date_of_birth?: string
          membership_start?: string
          membership_expiry?: string
          first_visit_date?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_events: {
        Row: {
          booking_id: string | null
          created_at: string | null
          error: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          status: string
          template: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          status: string
          template: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          html: string
          name: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          html: string
          name: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          html?: string
          name?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      karaoke_booth_holds: {
        Row: {
          booking_date: string
          booking_id: string | null
          booth_id: string
          created_at: string | null
          customer_email: string | null
          end_time: string
          expires_at: string
          id: string
          session_id: string
          start_time: string
          status: string
          updated_at: string | null
          venue: string
        }
        Insert: {
          booking_date: string
          booking_id?: string | null
          booth_id: string
          created_at?: string | null
          customer_email?: string | null
          end_time: string
          expires_at?: string
          id?: string
          session_id: string
          start_time: string
          status?: string
          updated_at?: string | null
          venue: string
        }
        Update: {
          booking_date?: string
          booking_id?: string | null
          booth_id?: string
          created_at?: string | null
          customer_email?: string | null
          end_time?: string
          expires_at?: string
          id?: string
          session_id?: string
          start_time?: string
          status?: string
          updated_at?: string | null
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "karaoke_booth_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "karaoke_booth_holds_booth_id_fkey"
            columns: ["booth_id"]
            isOneToOne: false
            referencedRelation: "karaoke_booths"
            referencedColumns: ["id"]
          },
        ]
      }
      karaoke_booths: {
        Row: {
          capacity: number | null
          created_at: string | null
          hourly_rate: number | null
          id: string
          is_available: boolean | null
          maintenance_notes: string | null
          name: string
          operating_hours_end: string | null
          operating_hours_start: string | null
          updated_at: string | null
          venue: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          is_available?: boolean | null
          maintenance_notes?: string | null
          name: string
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          updated_at?: string | null
          venue: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          is_available?: boolean | null
          maintenance_notes?: string | null
          name?: string
          operating_hours_end?: string | null
          operating_hours_start?: string | null
          updated_at?: string | null
          venue?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string
          delivery_method: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          recipient: string
          sent_at: string
          status: string
        }
        Insert: {
          created_at?: string
          delivery_method: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          recipient: string
          sent_at?: string
          status: string
        }
        Update: {
          created_at?: string
          delivery_method?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          recipient?: string
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          cron_job_name: string | null
          enabled: boolean
          id: string
          last_sent_at: string | null
          notification_type: string
          recipient_emails: string[]
          schedule_day_of_week: number | null
          schedule_hour_awst: number | null
          updated_at: string
          whatsapp_numbers: string[]
        }
        Insert: {
          created_at?: string
          cron_job_name?: string | null
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          notification_type: string
          recipient_emails?: string[]
          schedule_day_of_week?: number | null
          schedule_hour_awst?: number | null
          updated_at?: string
          whatsapp_numbers?: string[]
        }
        Update: {
          created_at?: string
          cron_job_name?: string | null
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          notification_type?: string
          recipient_emails?: string[]
          schedule_day_of_week?: number | null
          schedule_hour_awst?: number | null
          updated_at?: string
          whatsapp_numbers?: string[]
        }
        Relationships: []
      }
      orders: {
        Row: {
          door_ticket_qty: number | null
          line_items: Json | null
          location_id: string | null
          order_created_at: string | null
          order_id: string
          order_updated_at: string | null
          payment_id: string | null
          status: string | null
          synced_at: string | null
          total_money_cents: number | null
          venue: string | null
        }
        Insert: {
          door_ticket_qty?: number | null
          line_items?: Json | null
          location_id?: string | null
          order_created_at?: string | null
          order_id: string
          order_updated_at?: string | null
          payment_id?: string | null
          status?: string | null
          synced_at?: string | null
          total_money_cents?: number | null
          venue?: string | null
        }
        Update: {
          door_ticket_qty?: number | null
          line_items?: Json | null
          location_id?: string | null
          order_created_at?: string | null
          order_id?: string
          order_updated_at?: string | null
          payment_id?: string | null
          status?: string | null
          synced_at?: string | null
          total_money_cents?: number | null
          venue?: string | null
        }
        Relationships: []
      }
      photo_album_images: {
        Row: {
          album_id: string
          archived: boolean
          created_at: string | null
          display_order: number
          id: string
          storage_path: string
        }
        Insert: {
          album_id: string
          archived?: boolean
          created_at?: string | null
          display_order?: number
          id?: string
          storage_path: string
        }
        Update: {
          album_id?: string
          archived?: boolean
          created_at?: string | null
          display_order?: number
          id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_album_images_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "photo_albums"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_albums: {
        Row: {
          archived: boolean
          created_at: string | null
          event_date: string
          id: string
          updated_at: string | null
          venue: string
        }
        Insert: {
          archived?: boolean
          created_at?: string | null
          event_date: string
          id?: string
          updated_at?: string | null
          venue: string
        }
        Update: {
          archived?: boolean
          created_at?: string | null
          event_date?: string
          id?: string
          updated_at?: string | null
          venue?: string
        }
        Relationships: []
      }
      revenue_events: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          payment_date: string
          payment_day_of_week: number
          payment_hour: number
          processed_at: string
          revenue_type: string
          square_payment_id: string
          status: string
          updated_at: string
          venue: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          payment_date: string
          payment_day_of_week: number
          payment_hour: number
          processed_at?: string
          revenue_type: string
          square_payment_id: string
          status?: string
          updated_at?: string
          venue: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          payment_date?: string
          payment_day_of_week?: number
          payment_hour?: number
          processed_at?: string
          revenue_type?: string
          square_payment_id?: string
          status?: string
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_square_payment_id_fkey"
            columns: ["square_payment_id"]
            isOneToOne: true
            referencedRelation: "square_payments_raw"
            referencedColumns: ["square_payment_id"]
          },
        ]
      }
      square_location_sync_status: {
        Row: {
          errors: string | null
          in_progress: boolean | null
          last_heartbeat: string | null
          last_order_updated_at_seen: string | null
          last_payment_created_at_seen: string | null
          last_successful_sync_at: string | null
          location_id: string
          orders_fetched: number | null
          orders_upserted: number | null
          payments_fetched: number | null
          payments_upserted: number | null
          updated_at: string | null
        }
        Insert: {
          errors?: string | null
          in_progress?: boolean | null
          last_heartbeat?: string | null
          last_order_updated_at_seen?: string | null
          last_payment_created_at_seen?: string | null
          last_successful_sync_at?: string | null
          location_id: string
          orders_fetched?: number | null
          orders_upserted?: number | null
          payments_fetched?: number | null
          payments_upserted?: number | null
          updated_at?: string | null
        }
        Update: {
          errors?: string | null
          in_progress?: boolean | null
          last_heartbeat?: string | null
          last_order_updated_at_seen?: string | null
          last_payment_created_at_seen?: string | null
          last_successful_sync_at?: string | null
          location_id?: string
          orders_fetched?: number | null
          orders_upserted?: number | null
          payments_fetched?: number | null
          payments_upserted?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "square_location_sync_status_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "square_locations"
            referencedColumns: ["square_location_id"]
          },
        ]
      }
      square_locations: {
        Row: {
          address: string | null
          business_name: string | null
          country: string | null
          created_at: string
          currency: string | null
          environment: string
          id: string
          is_active: boolean
          location_name: string
          square_location_id: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          location_name: string
          square_location_id: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          environment?: string
          id?: string
          is_active?: boolean
          location_name?: string
          square_location_id?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      square_orders_raw: {
        Row: {
          location_id: string | null
          order_id: string
          raw_response: Json
          synced_at: string | null
        }
        Insert: {
          location_id?: string | null
          order_id: string
          raw_response: Json
          synced_at?: string | null
        }
        Update: {
          location_id?: string | null
          order_id?: string
          raw_response?: Json
          synced_at?: string | null
        }
        Relationships: []
      }
      square_payments_raw: {
        Row: {
          id: string
          raw_response: Json
          square_payment_id: string
          synced_at: string
        }
        Insert: {
          id?: string
          raw_response: Json
          square_payment_id: string
          synced_at?: string
        }
        Update: {
          id?: string
          raw_response?: Json
          square_payment_id?: string
          synced_at?: string
        }
        Relationships: []
      }
      staff_profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
        }
        Relationships: []
      }
      venue_area_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: number
          open_time: string
          venue_area_id: number
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: never
          open_time: string
          venue_area_id: number
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: never
          open_time?: string
          venue_area_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_area_hours_venue_area_id_fkey"
            columns: ["venue_area_id"]
            isOneToOne: false
            referencedRelation: "venue_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_areas: {
        Row: {
          capacity_max: number | null
          capacity_min: number | null
          code: string
          created_at: string
          description: string | null
          id: number
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number | null
          venue: string
          weekly_hours: Json
        }
        Insert: {
          capacity_max?: number | null
          capacity_min?: number | null
          code: string
          created_at?: string
          description?: string | null
          id?: never
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number | null
          venue: string
          weekly_hours: Json
        }
        Update: {
          capacity_max?: number | null
          capacity_min?: number | null
          code?: string
          created_at?: string
          description?: string | null
          id?: never
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number | null
          venue?: string
          weekly_hours?: Json
        }
        Relationships: []
      }
      xero_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token_enc: string
          scopes: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token_enc: string
          scopes?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token_enc?: string
          scopes?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _upsert_revenue_event: { Args: { p_raw: Json }; Returns: undefined }
      add_missing_locations_from_payments: { Args: Record<PropertyKey, never>; Returns: Json }
      get_attendance_sum: {
        Args: { end_date: string; start_date: string; venue_filter?: string }
        Returns: number
      }
      get_available_karaoke_booths: {
        Args: {
          p_booking_date: string
          p_end_time: string
          p_min_capacity: number
          p_start_time: string
          p_venue: string
        }
        Returns: {
          capacity: number
          hourly_rate: number
          id: string
          name: string
        }[]
      }
      get_available_weeks: {
        Args: Record<PropertyKey, never>
        Returns: {
          week_label: string
          week_start: string
        }[]
      }
      get_bar_revenue_sum: {
        Args: { end_date: string; start_date: string; venue_filter?: string }
        Returns: number
      }
      get_booking_guests: {
        Args: { p_booking_id: string; p_token?: string }
        Returns: {
          guests: Json
          max_guests: number
        }[]
      }
      get_cron_expression: {
        Args: { day_of_week: number; hour_awst: number }
        Returns: string
      }
      get_door_revenue_sum: {
        Args: { end_date: string; start_date: string; venue_filter?: string }
        Returns: number
      }
      get_karaoke_booth_availability:
        | {
            Args: {
              booking_date: string
              booth_id: string
              end_time: string
              start_time: string
            }
            Returns: boolean
          }
        | {
            Args: {
              booking_date: string
              booth_id: string
              end_time: string
              exclude_booking_id?: string
              start_time: string
            }
            Returns: boolean
          }
      get_monthly_revenue_summary: {
        Args: { month_date?: string; venue_filter?: string }
        Returns: {
          bar_revenue_cents: number
          bar_transactions: number
          door_revenue_cents: number
          door_transactions: number
          month: string
          total_revenue_cents: number
          total_transactions: number
        }[]
      }
      get_revenue_sum: {
        Args: { end_date: string; start_date: string; venue_filter?: string }
        Returns: number
      }
      get_weekly_attendance_summary: {
        Args: { venue_filter?: string; week_date?: string }
        Returns: {
          total_attendance: number
          week_start: string
        }[]
      }
      get_weekly_revenue_summary: {
        Args: { venue_filter?: string; week_date?: string }
        Returns: {
          bar_revenue_cents: number
          bar_transactions: number
          door_revenue_cents: number
          door_transactions: number
          total_revenue_cents: number
          total_transactions: number
          week_start: string
        }[]
      }
      get_yearly_revenue_summary: {
        Args: { venue_filter?: string; year_date?: string }
        Returns: {
          bar_revenue_cents: number
          bar_transactions: number
          door_revenue_cents: number
          door_transactions: number
          total_revenue_cents: number
          total_transactions: number
          year_start: string
        }[]
      }
      karaoke_expire_due_holds: { Args: Record<PropertyKey, never>; Returns: number }
      process_payments_batch: {
        Args: { days_back?: number; payment_ids?: string[] }
        Returns: {
          error_count: number
          processed_count: number
          total_payments: number
        }[]
      }
      reprocess_venues_batch: { Args: { days_back?: number }; Returns: Json }
      reset_stuck_sync_states: { Args: Record<PropertyKey, never>; Returns: undefined }
      sync_square_locations: { Args: Record<PropertyKey, never>; Returns: Json }
      test_map_100_transactions: { Args: Record<PropertyKey, never>; Returns: Json }
      test_map_1000_transactions: { Args: Record<PropertyKey, never>; Returns: Json }
      test_map_all_transactions: { Args: Record<PropertyKey, never>; Returns: Json }
      transform_backfill_transactions: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      transform_orders_window: {
        Args: { p_end_ts: string; p_start_ts: string }
        Returns: number
      }
      transform_payments_window: {
        Args: { end_ts: string; start_ts: string }
        Returns: Json
      }
      transform_recent_synced_transactions: {
        Args: { minutes_back?: number }
        Returns: Json
      }
      upsert_booking_guests: {
        Args: { p_booking_id: string; p_guests: Json; p_token?: string }
        Returns: {
          guests: Json
          max_guests: number
        }[]
      }
      validate_guest_list_token: {
        Args: { p_booking_id: string; p_token: string }
        Returns: undefined
      }
    }
    Enums: {
      staff_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      staff_role: ["admin", "user"],
    },
  },
} as const
