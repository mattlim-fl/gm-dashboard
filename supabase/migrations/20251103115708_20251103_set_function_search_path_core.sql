-- Set fixed search_path for core public functions
alter function public.get_revenue_sum(start_date timestamp with time zone, end_date timestamp with time zone, venue_filter text)
  set search_path = public, extensions, pg_temp;
alter function public.get_weekly_revenue_summary(venue_filter text, week_date timestamp with time zone)
  set search_path = public, extensions, pg_temp;
alter function public.get_monthly_revenue_summary(venue_filter text, month_date timestamp with time zone)
  set search_path = public, extensions, pg_temp;
alter function public.get_yearly_revenue_summary(venue_filter text, year_date timestamp with time zone)
  set search_path = public, extensions, pg_temp;
alter function public.transform_orders_window(p_start_ts timestamp with time zone, p_end_ts timestamp with time zone)
  set search_path = public, extensions, pg_temp;
alter function public.transform_payments_window(start_ts timestamp with time zone, end_ts timestamp with time zone)
  set search_path = public, extensions, pg_temp;;
