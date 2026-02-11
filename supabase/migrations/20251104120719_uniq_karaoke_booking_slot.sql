create unique index if not exists uq_karaoke_booking_slot
  on public.bookings (karaoke_booth_id, booking_date, start_time, end_time)
  where booking_type = 'karaoke_booking' and status = 'confirmed';;
