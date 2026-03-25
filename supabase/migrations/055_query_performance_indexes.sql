-- Performance indexes for frequent read patterns (frontend + admin panel)
-- Safe to run multiple times due IF NOT EXISTS.

-- Orders: common filters by user/status with sorting by recency.
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON public.orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON public.orders(status, created_at DESC);

-- User inventory: user pages filter by user_id + status and sort by created_at.
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_status_created_at
  ON public.user_inventory(user_id, status, created_at DESC);

-- Shipments: user pages filter by user_id and sort by created_at.
CREATE INDEX IF NOT EXISTS idx_shipments_user_created_at
  ON public.shipments(user_id, created_at DESC);

-- Cart: cart queries filter by user_id and sort by created_at.
CREATE INDEX IF NOT EXISTS idx_cart_items_user_created_at
  ON public.cart_items(user_id, created_at DESC);

-- Payments: list ordered by created_at and relation lookup via order_id.
CREATE INDEX IF NOT EXISTS idx_payments_order_created_at
  ON public.payments(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_created_at
  ON public.payments(created_at DESC);
