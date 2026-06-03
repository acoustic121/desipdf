-- ══════════════════════════════════════════════════════════
-- DesiPDF – Supabase Database Setup
-- Run this in Supabase → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 2. Subscriptions table
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  plan text default 'premium',           -- 'premium'
  status text default 'active',          -- 'active' | 'cancelled' | 'expired'
  billing_period text,                   -- 'monthly' | 'yearly'
  amount integer,                        -- in paise (5000 = ₹50, 59900 = ₹599)
  expires_at timestamp with time zone not null,
  payment_id text,                       -- Razorpay payment ID
  order_id text,                         -- Razorpay order ID
  created_at timestamp with time zone default timezone('utc', now())
);

-- 3. Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;

-- 4. RLS Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- 5. RLS Policies for subscriptions
create policy "Users can view own subscriptions"
  on public.subscriptions for select using (auth.uid() = user_id);

-- Service role can insert (used by payment verify API)
-- No insert policy needed — service role bypasses RLS

-- 6. Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ══════════════════════════════════════════════════════════
-- After running this, go to:
-- Authentication → Providers → Enable Google (optional)
-- Authentication → URL Configuration → add your site URL
-- ══════════════════════════════════════════════════════════
