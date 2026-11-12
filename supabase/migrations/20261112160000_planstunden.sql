-- Geplante Stunden je Auftrag (Soll-Ist) – 12.11.2026
alter table public.orders add column if not exists planned_hours numeric(8, 2);
alter table public.orders drop constraint if exists orders_planned_hours_check;
alter table public.orders add constraint orders_planned_hours_check check (planned_hours is null or (planned_hours >= 0 and planned_hours <= 100000));

-- Lohnanteil: es wird der vorhandene Wert company_settings.labor_share_percent (Einstellungen) verwendet.

-- Geplante Stunden darf nur der Inhaber/Admin ändern (Projektleiter bearbeiten Aufträge, aber nicht die Kalkulation)
create or replace function public.orders_protect_planned_hours()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and coalesce(public.current_role_id(), 0) <> 2 then
    if tg_op = 'INSERT' then
      new.planned_hours := null;
    elsif new.planned_hours is distinct from old.planned_hours then
      new.planned_hours := old.planned_hours;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_protect_planned_hours on public.orders;
create trigger orders_protect_planned_hours before insert or update on public.orders
  for each row execute function public.orders_protect_planned_hours();
