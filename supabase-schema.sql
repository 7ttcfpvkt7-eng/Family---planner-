-- ============================================================
-- Family Homeschool Planner — Database Setup
-- Copy this ENTIRE file and paste it into the Supabase SQL Editor,
-- then click "Run". See DEPLOYMENT_GUIDE.md step 2 for details.
-- ============================================================

-- Table: students
-- One row per child. "preset_key" links to the built-in curriculum
-- data (Penelope/Aubrey) already bundled in the app. New children
-- added later have preset_key = NULL until a curriculum is added.
create table if not exists students (
  id text primary key,
  name text not null,
  grade text,
  color text not null,
  preset_key text,
  created_at timestamptz default now()
);

-- Table: completions
-- One row per checked/unchecked item (a subject on a given day).
-- item_key format: "YYYY-MM-DD|SUBJECTCODE" e.g. "2026-08-13|ELA"
create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  student_id text references students(id) on delete cascade,
  item_key text not null,
  done boolean not null default true,
  updated_at timestamptz default now(),
  unique (student_id, item_key)
);

-- Table: notes
-- Free-text notes attached to a specific day for a student.
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  student_id text references students(id) on delete cascade,
  date text not null,
  body text not null default '',
  updated_at timestamptz default now(),
  unique (student_id, date)
);

-- ============================================================
-- Row Level Security: only signed-in family members can read/write.
-- Since this app uses one shared family login, any authenticated
-- user has full access to all rows.
-- ============================================================
alter table students enable row level security;
alter table completions enable row level security;
alter table notes enable row level security;

create policy "Family members can view students"
  on students for select
  using (auth.role() = 'authenticated');

create policy "Family members can manage students"
  on students for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Family members can view completions"
  on completions for select
  using (auth.role() = 'authenticated');

create policy "Family members can manage completions"
  on completions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Family members can view notes"
  on notes for select
  using (auth.role() = 'authenticated');

create policy "Family members can manage notes"
  on notes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- Enable realtime sync (so changes on one device show up on others
-- within a second or two, without needing to refresh)
-- ============================================================
alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table students;
alter publication supabase_realtime add table notes;

-- ============================================================
-- Seed the two children already set up (Penelope & Aubrey).
-- Safe to run more than once — it won't create duplicates.
-- ============================================================
insert into students (id, name, grade, color, preset_key) values
  ('penelope', 'Penelope', '4th Grade', '#3D6E99', 'penelope'),
  ('aubrey', 'Aubrey', '1st Grade', '#4C7A5B', 'aubrey')
on conflict (id) do nothing;
