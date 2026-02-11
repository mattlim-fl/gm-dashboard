-- Drop single-parameter revenue summary functions to fix overloading ambiguity
-- Keep only the two-parameter versions which handle NULL dates for current period

DROP FUNCTION IF EXISTS public.get_weekly_revenue_summary(venue_filter text);
DROP FUNCTION IF EXISTS public.get_monthly_revenue_summary(venue_filter text);
DROP FUNCTION IF EXISTS public.get_yearly_revenue_summary(venue_filter text);;
