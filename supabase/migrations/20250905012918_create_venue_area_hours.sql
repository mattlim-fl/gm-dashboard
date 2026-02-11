create table if not exists public.venue_area_hours (
  id bigint generated always as identity primary key,
  venue_area_id bigint not null references public.venue_areas(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Sunday
  open_time time not null,
  close_time time not null,
  unique (venue_area_id, day_of_week)
);

-- Seed weekly hours for Manor areas
-- Monday (1) to Friday (5): 18:00 to 05:00 (overnight)
insert into public.venue_area_hours (venue_area_id, day_of_week, open_time, close_time)
select va.id, d.day_of_week, time '18:00', time '05:00'
from public.venue_areas va
join (select unnest(array[1,2,3,4,5]) as day_of_week) d on true
where va.venue = 'manor' and va.code in ('downstairs','upstairs','full_venue')
on conflict (venue_area_id, day_of_week) do nothing;

-- Saturday (6): 18:00 to 23:00
insert into public.venue_area_hours (venue_area_id, day_of_week, open_time, close_time)
select va.id, 6, time '18:00', time '23:00'
from public.venue_areas va
where va.venue = 'manor' and va.code in ('downstairs','upstairs','full_venue')
on conflict (venue_area_id, day_of_week) do nothing;

-- Sunday (0): 20:00 to 02:00 (overnight)
insert into public.venue_area_hours (venue_area_id, day_of_week, open_time, close_time)
select va.id, 0, time '20:00', time '02:00'
from public.venue_areas va
where va.venue = 'manor' and va.code in ('downstairs','upstairs','full_venue')
on conflict (venue_area_id, day_of_week) do nothing;;
