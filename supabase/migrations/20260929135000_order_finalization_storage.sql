begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'order-finalization-evidence',
  'order-finalization-evidence',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy order_finalization_storage_read
on storage.objects
for select to authenticated
using (
  bucket_id='order-finalization-evidence'
  and split_part(name,'/',1)=erp_private.current_org_id()::text
  and (
    erp_private.can_access_module('billing','read')
    or erp_private.can_access_module('shipping','read')
    or erp_private.can_access_module('sales','read')
    or erp_private.can_access_module('audit','read')
  )
);

create policy order_finalization_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id='order-finalization-evidence'
  and split_part(name,'/',1)=erp_private.current_org_id()::text
  and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists(
    select 1
    from erp_supply.orders o
    where o.id=split_part(name,'/',2)::uuid
      and o.organization_id=erp_private.current_org_id()
  )
  and (
    erp_private.can_access_module('billing','create')
    or erp_private.can_access_module('shipping','update')
  )
);

commit;
