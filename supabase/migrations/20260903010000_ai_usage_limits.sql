create table if not exists public.ai_request_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_hash text not null,
  input_characters integer not null check (input_characters >= 0),
  input_tokens integer,
  output_tokens integer,
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'failed')),
  requested_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists ai_request_usage_user_requested
on public.ai_request_usage (user_id, requested_at desc);

create index if not exists ai_request_usage_active
on public.ai_request_usage (user_id, status, requested_at desc);

alter table public.ai_request_usage enable row level security;
revoke all on table public.ai_request_usage from anon, authenticated;
grant all on table public.ai_request_usage to service_role;

create or replace function public.reserve_ai_request(
  p_request_hash text,
  p_input_characters integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_time timestamptz := timezone('utc', now());
  minute_count integer;
  daily_count integer;
  monthly_count integer;
  reservation_id uuid;
begin
  if current_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 90421)
  );

  if not public.has_active_premium(current_user_id) then
    return jsonb_build_object('allowed', false, 'reason', 'premium_required');
  end if;

  if exists (
    select 1 from public.ai_request_usage
    where user_id = current_user_id
      and status = 'reserved'
      and requested_at > current_time - interval '5 minutes'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'request_in_progress');
  end if;

  if exists (
    select 1 from public.ai_request_usage
    where user_id = current_user_id
      and request_hash = p_request_hash
      and requested_at > current_time - interval '60 seconds'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'duplicate_request');
  end if;

  select count(*) into minute_count from public.ai_request_usage
  where user_id = current_user_id
    and requested_at > current_time - interval '1 minute';
  select count(*) into daily_count from public.ai_request_usage
  where user_id = current_user_id
    and requested_at >= date_trunc('day', current_time);
  select count(*) into monthly_count from public.ai_request_usage
  where user_id = current_user_id
    and requested_at >= date_trunc('month', current_time);

  if minute_count >= 5 then
    return jsonb_build_object('allowed', false, 'reason', 'minute_limit');
  end if;
  if daily_count >= 30 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;
  if monthly_count >= 200 then
    return jsonb_build_object('allowed', false, 'reason', 'monthly_limit');
  end if;

  insert into public.ai_request_usage (
    user_id, request_hash, input_characters, requested_at
  ) values (
    current_user_id, p_request_hash, p_input_characters, current_time
  ) returning id into reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'request_id', reservation_id,
    'monthly_remaining', 199 - monthly_count,
    'daily_remaining', 29 - daily_count
  );
end;
$$;

create or replace function public.finish_ai_request(
  p_request_id uuid,
  p_succeeded boolean,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_request_usage
  set status = case when p_succeeded then 'completed' else 'failed' end,
      input_tokens = greatest(p_input_tokens, 0),
      output_tokens = greatest(p_output_tokens, 0),
      finished_at = timezone('utc', now())
  where id = p_request_id
    and user_id = (select auth.uid())
    and status = 'reserved';
$$;

revoke all on function public.reserve_ai_request(text, integer) from public;
revoke all on function public.finish_ai_request(uuid, boolean, integer, integer) from public;
grant execute on function public.reserve_ai_request(text, integer) to authenticated;
grant execute on function public.finish_ai_request(uuid, boolean, integer, integer) to authenticated;
