-- Add covering indexes for foreign keys flagged by advisors
create index if not exists idx_bookings_created_by on public.bookings (created_by);
create index if not exists idx_email_events_booking_id on public.email_events (booking_id);
create index if not exists idx_karaoke_booth_holds_booking_id on public.karaoke_booth_holds (booking_id);;
