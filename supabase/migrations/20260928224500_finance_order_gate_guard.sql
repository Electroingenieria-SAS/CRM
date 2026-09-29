begin;

create or replace function erp_private.finance_order_task_completion_guard()
returns trigger
language plpgsql
security invoker
set search_path=pg_catalog,public,erp_supply,erp_private
as $$
declare
  v_gate jsonb;
  v_decision text;
begin
  if old.status is distinct from 'COMPLETED'
     and new.status='COMPLETED'
     and new.step_code in ('CARTERA','CAJA','CAJA_FACTURACION') then
    v_gate:=public.erp_x_financial_gate(new.order_id);
    v_decision:=coalesce(v_gate->>'decision','REQUIRES_REVIEW');

    if v_decision not in ('APPROVED','RELEASED') then
      raise exception 'La etapa financiera no puede completarse: %',
        coalesce(v_gate->>'reason','validación financiera pendiente')
        using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function erp_private.finance_order_task_completion_guard()
from public,anon;
grant execute on function erp_private.finance_order_task_completion_guard()
to authenticated;

create trigger trg_finance_guard_order_task_completion
before update of status
on erp_supply.order_tasks
for each row
execute function erp_private.finance_order_task_completion_guard();

comment on function erp_private.finance_order_task_completion_guard()
is 'Finance-owned veto boundary: Orders remains workflow owner but cannot complete CARTERA/CAJA tasks until the financial gate is released.';

commit;
