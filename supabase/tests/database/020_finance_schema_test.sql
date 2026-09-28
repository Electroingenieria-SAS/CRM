begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select has_table('erp_supply','credit_requests','credit requests exist');
select has_table('erp_supply','financial_validations','financial validations exist');
select has_table('erp_supply','financial_holds','financial holds exist');
select has_table('erp_supply','financial_approval_requests','financial approvals exist');
select has_table('erp_supply','financial_supports','payment support references exist');
select has_table('erp_supply','financial_events','append-only financial ledger exists');

select hasnt_column(
  'erp_supply','financial_validations','amount',
  'financial validations cannot become the source of paid money'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='erp_supply' and c.relname='financial_holds'),
  'financial holds have RLS'
);

select ok(
  not has_function_privilege('anon','public.erp_x_finance_register_invoice(uuid,jsonb,text)','EXECUTE'),
  'anon cannot register invoices'
);

select ok(
  has_function_privilege('authenticated','public.erp_x_finance_register_invoice(uuid,jsonb,text)','EXECUTE'),
  'authenticated can invoke guarded invoice registration'
);

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='erp_x_finance_register_invoice'),
  false,
  'invoice API is SECURITY INVOKER'
);

select is(
  erp_private.finance_round_money(100.005::numeric),
  100.01::numeric,
  'COP rounding is centralized in PostgreSQL'
);

select is(
  erp_private.finance_round_money(100.004::numeric),
  100.00::numeric,
  'COP rounding is deterministic to two decimals'
);

select is(
  erp_private.finance_invoice_effective_paid(100000,0,'REGISTERED'),
  100000::numeric,
  'registered invoice is fully effective paid value'
);

select is(
  erp_private.finance_invoice_effective_paid(100000,30000,'PARTIALLY_REVERSED'),
  70000::numeric,
  'partial reversal reduces effective paid value'
);

select is(
  erp_private.finance_invoice_effective_paid(100000,100000,'REVERSED'),
  0::numeric,
  'full reversal contributes zero'
);

select is(
  erp_private.finance_invoice_effective_paid(100000,0,'VOID'),
  0::numeric,
  'void invoice contributes zero'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.financial_events','UPDATE'),
  'financial event ledger cannot be updated'
);

select ok(
  not has_table_privilege('authenticated','erp_supply.financial_events','DELETE'),
  'financial event ledger cannot be deleted'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='uq_financial_validation_idempotency'),
  'validation idempotency index exists'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='uq_active_financial_hold'),
  'active hold uniqueness index exists'
);

select ok(
  exists(select 1 from pg_indexes
    where schemaname='erp_supply' and indexname='idx_credit_requests_queue'),
  'credit queue index exists'
);

select throws_ok(
  $$insert into erp_supply.invoices(
      organization_id,order_id,invoice_number,amount,currency,status
    ) values(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
      'NEGATIVE',-1,'COP','REGISTERED'
    )$$,
  '23514',
  null,
  'negative invoice money is rejected'
);

select throws_ok(
  $$insert into erp_supply.credit_requests(
      organization_id,customer_id,request_number,requested_amount,
      requested_term_days,requested_by
    ) values(
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
      'NEGATIVE',-1,30,
      '00000000-0000-0000-0000-000000000002'
    )$$,
  '23514',
  null,
  'negative requested credit amount is rejected'
);

select * from finish();
rollback;
