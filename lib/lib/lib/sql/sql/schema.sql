create extension if not exists "uuid-ossp";

create table if not exists slots (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('personal_training','group_training','academy')),
  slot_date date not null,
  slot_time text not null,
  capacity int not null default 1,
  booked_count int not null default 0,
  location text,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  slot_id uuid references slots(id),
  parent_booking_id uuid references bookings(id),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  service_type text not null,
  fee_total numeric not null,
  deposit_amount numeric,
  balance_amount numeric,
  payment_status text not null default 'pending',
  stripe_customer_id text,
  stripe_payment_method_id text,
  stripe_checkout_session_id text,
  no_show boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  category text not null check (category in ('personal_training','group_training','academy','content')),
  label text not null,
  fee numeric not null,
  mode text not null check (mode in ('deposit','full','subscription')),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

insert into services (key, category, label, fee, mode, sort_order) values
  ('one2one',        'personal_training', '1-to-1',                  45,  'deposit', 1),
  ('two2one',        'personal_training', '2-to-1',                  55,  'deposit', 2),
  ('block4',         'personal_training', '4-Week Block (1/week)',   160, 'deposit', 3),
  ('fourtoone',      'group_training',    '4-1 Small Group',         25,  'full',    1),
  ('academy_monthly','academy',           '4-Week Membership',       50,  'subscription', 1),
  ('academy_dropin', 'academy',           'Pay As You Go',           10,  'full',    2)
on conflict (key) do nothing;

create index if not exists idx_bookings_session on bookings (stripe_checkout_session_id);
create index if not exists idx_slots_category_date on slots (category, slot_date);

insert into slots (category, slot_date, slot_time, capacity)
select 'personal_training', d::date, t, 1
from generate_series(0,3) as w,
     unnest(array[
       current_date + (7 - extract(dow from current_date)::int + 6) % 7 + (w*7),
       current_date + (7 - extract(dow from current_date)::int + 7) % 7 + (w*7)
     ]) as d,
     unnest(array['9:00am','10:30am','12:00pm','1:30pm','3:00pm']) as t;

insert into slots (category, slot_date, slot_time, capacity)
select 'group_training', d::date, '11:00am', 4
from generate_series(0,3) as w,
     unnest(array[current_date + (7 - extract(dow from current_date)::int + 6) % 7 + (w*7)]) as d;

insert into slots (category, slot_date, slot_time, capacity, location) values
  ('academy', current_date + ((2 - extract(dow from current_date)::int + 7) % 7), 'Tue 6:30pm', 12, 'All Walks Academy Training Hall'),
  ('academy', current_date + ((4 - extract(dow from current_date)::int + 7) % 7), 'Thu 6:30pm', 12, 'All Walks Academy Training Hall');
