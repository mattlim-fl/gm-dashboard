-- Buy Boxes
create table buy_boxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Buy Box Rules (typed)
create table buy_box_rules (
  id uuid primary key default gen_random_uuid(),
  buy_box_id uuid references buy_boxes(id) on delete cascade,
  rule_type text not null check (rule_type in ('MIN_THRESHOLD', 'MAX_THRESHOLD', 'BOOLEAN', 'ENUM', 'INCLUDE_LIST', 'EXCLUDE_LIST')),
  metric text not null,
  value jsonb not null,
  classification text not null check (classification in ('HARD_STOP', 'SOFT_PREFERENCE')),
  created_at timestamptz not null default now()
);

-- System Assumptions
create table system_assumptions (
  id uuid primary key default gen_random_uuid(),
  buy_box_id uuid references buy_boxes(id) on delete cascade,
  gm_salary numeric not null default 80000,
  interest_rate numeric not null default 0.10,
  loan_term_years integer not null default 10,
  sba_guarantee_fee numeric not null default 0.03,
  created_at timestamptz not null default now()
);

-- Prospects
create table prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text not null check (stage in ('TEASER', 'CIM', 'PRE_LOI', 'POST_LOI')),
  notes text,
  created_at timestamptz not null default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- Extracted Data (Phase 1 output)
create table extracted_data (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  status text not null check (status in ('COMPLETE', 'PARTIAL', 'FAILED')),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  data_json jsonb not null,
  missing_fields text[] not null default '{}',
  extraction_notes text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- IC Evaluations (Phase 2 output)
create table ic_evaluations (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete cascade,
  buy_box_id uuid references buy_boxes(id),
  buy_box_version integer not null,
  extracted_data_id uuid references extracted_data(id),
  status text not null check (status in ('COMPLETE', 'PARTIAL', 'FAILED')),
  fit_score numeric,
  verdict text check (verdict in ('REJECT', 'CONDITIONAL_ADVANCE', 'ADVANCE')),
  output_json jsonb not null,
  created_at timestamptz not null default now()
);;
