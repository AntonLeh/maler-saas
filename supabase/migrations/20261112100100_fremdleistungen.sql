-- 2) Fremdleistungen: Rechnungen von Subunternehmern je Auftrag (Kosten in der Nachkalkulation) – 12.11.2026
create table if not exists public.order_external_costs (
  id bigserial primary key,
  tenant_id bigint not null,
  order_id bigint not null references public.orders (id) on delete cascade,
  sub_user_id bigint references public.app_users (id) on delete set null,
  description text,
  amount_net numeric(12, 2) not null check (amount_net >= 0),
  invoice_no text,
  invoice_date date,
  reverse_charge boolean not null default false,
  created_by bigint references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_external_costs_order_idx on public.order_external_costs (order_id);
create index if not exists order_external_costs_tenant_idx on public.order_external_costs (tenant_id, invoice_date);

alter table public.order_external_costs enable row level security;

drop policy if exists oec_select on public.order_external_costs;
create policy oec_select on public.order_external_costs for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.current_role_id() = 2 or (public.current_role_id() = 3 and public.pm_can_manage_order(order_id))));

drop policy if exists oec_insert on public.order_external_costs;
create policy oec_insert on public.order_external_costs for insert to authenticated
  with check (tenant_id = public.current_tenant_id()
              and created_by = public.current_app_user_id()
              and exists (select 1 from public.orders o where o.id = order_id and o.tenant_id = public.current_tenant_id())
              and (public.current_role_id() = 2 or (public.current_role_id() = 3 and public.pm_can_manage_order(order_id))));

drop policy if exists oec_delete on public.order_external_costs;
create policy oec_delete on public.order_external_costs for delete to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.current_role_id() = 2 or (public.current_role_id() = 3 and created_by = public.current_app_user_id())));
