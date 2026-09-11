-- timezone('utc', now()) returns timestamp without time zone. The usage table
-- stores timestamptz values, so comparisons against that expression fail at
-- runtime. Keep the quota window value as timestamptz.
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
  current_time timestamptz := now();
  minute_count integer;
  daily_count integer;
  monthly_count integer;
  reservation_id uuid;
begin
  if current_user_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthorized');
  end if;
  if p_request_hash !~ '^[0-9a-f]{64}$'
    or p_input_characters < 1
    or p_input_characters > 122000 then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_request');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 90421)
  );

  if not private.has_active_premium() then
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

revoke all on function public.reserve_ai_request(text, integer) from public;
revoke execute on function public.reserve_ai_request(text, integer) from anon;
grant execute on function public.reserve_ai_request(text, integer) to authenticated;
