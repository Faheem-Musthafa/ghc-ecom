create or replace function public.audit_order_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if new.status in ('confirmed', 'cancelled') then
    insert into public.audit_logs (
      actor_id, action, entity_type, entity_id, metadata
    ) values (
      null,
      case
        when new.status = 'confirmed' then 'payment.order_confirmed'
        else 'order.cancelled'
      end,
      'order',
      new.id::text,
      jsonb_build_object(
        'from', old.status,
        'to', new.status,
        'razorpayOrderId', new.razorpay_order_id
      )
    );
  end if;
  return new;
end;
$$;

create trigger orders_audit_lifecycle
after update of status on public.orders
for each row execute function public.audit_order_lifecycle();

create or replace function public.audit_refund_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, metadata
  ) values (
    null,
    'refund.status_changed',
    'refund',
    new.id::text,
    jsonb_build_object(
      'from', old.status,
      'to', new.status,
      'razorpayRefundId', new.razorpay_refund_id,
      'amountPaise', new.amount_paise
    )
  );
  return new;
end;
$$;

create trigger refunds_audit_lifecycle
after update of status on public.refunds
for each row execute function public.audit_refund_lifecycle();
