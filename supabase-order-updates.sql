alter table public.orders
add column if not exists scheduled_for timestamptz;

alter table public.orders
add column if not exists is_scheduled boolean not null default false;

notify pgrst, 'reload schema';

drop function if exists public.get_order_status(uuid, text);
drop function if exists public.get_orders_by_phone(text);
drop function if exists public.cancel_order(uuid, text);

create or replace function public.get_order_status(p_order_id uuid, p_phone text)
returns table (
  id uuid,
  created_at timestamptz,
  scheduled_for timestamptz,
  is_scheduled boolean,
  items jsonb,
  total numeric,
  status text
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.created_at, o.scheduled_for, o.is_scheduled, o.items, o.total, o.status
  from public.orders o
  where o.id = p_order_id
    and regexp_replace(o.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
  limit 1;
$$;

create or replace function public.get_orders_by_phone(p_phone text)
returns table (
  id uuid,
  created_at timestamptz,
  scheduled_for timestamptz,
  is_scheduled boolean,
  items jsonb,
  total numeric,
  status text
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.created_at, o.scheduled_for, o.is_scheduled, o.items, o.total, o.status
  from public.orders o
  where regexp_replace(o.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
    and o.created_at >= now() - interval '2 days'
  order by o.created_at desc
  limit 10;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_phone text)
returns table (
  id uuid,
  created_at timestamptz,
  scheduled_for timestamptz,
  is_scheduled boolean,
  items jsonb,
  total numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.orders o
    set status = 'otkazana'
    where o.id = p_order_id
      and regexp_replace(o.phone, '[^0-9+]', '', 'g') = regexp_replace(p_phone, '[^0-9+]', '', 'g')
      and o.status in ('novo', 'prihvacena', 'priprema')
    returning o.id, o.created_at, o.scheduled_for, o.is_scheduled, o.items, o.total, o.status;
end;
$$;

revoke all on function public.get_order_status(uuid, text) from public;
revoke all on function public.get_orders_by_phone(text) from public;
revoke all on function public.cancel_order(uuid, text) from public;

grant execute on function public.get_order_status(uuid, text) to anon, authenticated;
grant execute on function public.get_orders_by_phone(text) to anon, authenticated;
grant execute on function public.cancel_order(uuid, text) to anon, authenticated;

grant insert on table public.orders to anon, authenticated;
grant select (id, created_at, scheduled_for, is_scheduled, items, total, status) on table public.orders to anon;
grant select, update, delete on table public.orders to authenticated;

drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can receive order status realtime" on public.orders;
create policy "Public can receive order status realtime"
on public.orders
for select
to anon
using (true);

-- Automatsko brisanje svaki dan u 03:00. Ne briše zakazane/rezervirane narudžbe.
-- Ako Supabase javlja da pg_cron nije omogućen, uključi ga u Database > Extensions.
create extension if not exists pg_cron;

select cron.unschedule('delete-old-buldog-orders')
where exists (
  select 1 from cron.job where jobname = 'delete-old-buldog-orders'
);

select cron.schedule(
  'delete-old-buldog-orders',
  '0 3 * * *',
  $$
    delete from public.orders
    where coalesce(is_scheduled, false) = false
      and scheduled_for is null
      and created_at < date_trunc('day', now());
  $$
);
