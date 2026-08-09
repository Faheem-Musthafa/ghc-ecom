create index orders_cart_status_payment_expiry_idx
  on public.orders (cart_id, status, payment_expires_at);
