alter table public.venue_areas
add column if not exists weekly_hours jsonb;

-- backfill weekly_hours from venue_area_hours if present
update public.venue_areas va
set weekly_hours = sub.hours
from (
  select
    h.venue_area_id,
    jsonb_object_agg(h.day_of_week::text, jsonb_build_object(
      'open', to_char(h.open_time, 'HH24:MI'),
      'close', to_char(h.close_time, 'HH24:MI')
    )) as hours
  from public.venue_area_hours h
  group by h.venue_area_id
) sub
where sub.venue_area_id = va.id
  and (va.weekly_hours is null or jsonb_typeof(va.weekly_hours) is distinct from 'object');

-- set default for rows without hours: empty object
update public.venue_areas va
set weekly_hours = coalesce(va.weekly_hours, '{}'::jsonb);

-- optional: enforce not null
alter table public.venue_areas
alter column weekly_hours set not null;;
