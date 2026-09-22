-- Live Rips rollout smoke-check
-- Execute in Supabase SQL editor after running migrations 140/141.

-- 1) Schema baseline
select to_regclass('public.live_events') as live_events;
select to_regclass('public.live_rip_products') as live_rip_products;
select to_regclass('public.live_rip_reservations') as live_rip_reservations;
select to_regclass('public.live_rip_pulls') as live_rip_pulls;

-- 2) RPC availability
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'service_live_rips_reserve',
    'service_live_rips_my_reservation',
    'service_live_rips_public_queue',
    'service_live_rips_public_pulls',
    'service_live_rips_pay_with_wallet',
    'service_live_rips_my_pulls',
    'admin_live_rips_list_events',
    'admin_live_rips_list_products',
    'admin_live_rips_list_reservations',
    'admin_live_rips_set_reservation_status',
    'admin_live_rips_add_pull',
    'admin_live_rips_adjust_stock',
    'admin_live_rips_finalize_to_inventory'
  )
order by proname;

-- 3) Realtime publication
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('live_events', 'live_rip_products', 'live_rip_reservations', 'live_rip_pulls')
order by tablename;

-- 4) Operational data
select id, slug, title, status, starts_at
from public.live_events
order by created_at desc
limit 5;

select id, name_en, available_rips, is_active
from public.live_rip_products
order by created_at desc
limit 10;
