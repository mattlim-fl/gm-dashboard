create table if not exists public.venue_areas (
  id bigint generated always as identity primary key,
  venue text not null check (venue in ('manor','hippie')),
  code text not null,
  name text not null,
  description text,
  capacity_min integer,
  capacity_max integer,
  is_active boolean not null default true,
  sort_order integer,
  image_url text,
  created_at timestamptz not null default now(),
  unique (venue, code)
);

create index if not exists venue_areas_venue_active_idx on public.venue_areas(venue, is_active, sort_order);

-- seed initial areas for Manor if not existing
insert into public.venue_areas (venue, code, name, description, capacity_min, capacity_max, sort_order)
select * from (values
  ('manor','downstairs','Downstairs','Main floor with bar and dance floor', 10, 120, 1),
  ('manor','upstairs','Upstairs','Lounge bar with karaoke booth', 10, 70, 2),
  ('manor','full_venue','Full Venue','Exclusive hire of entire venue', 50, 250, 3)
) as v(venue, code, name, description, capacity_min, capacity_max, sort_order)
on conflict (venue, code) do nothing;;
