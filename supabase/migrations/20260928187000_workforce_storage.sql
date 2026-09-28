begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'workforce-evidence',
  'workforce-evidence',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy workforce_storage_read
on storage.objects
for select to authenticated
using (
  bucket_id='workforce-evidence'
  and split_part(name,'/',1)=erp_private.current_org_id()::text
);

create policy workforce_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id='workforce-evidence'
  and split_part(name,'/',1)=erp_private.current_org_id()::text
  and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}

commit;

  and erp_private.can_access_module('workforce','create')
  and exists(
    select 1
    from erp_supply.workforce_activities a
    where a.id=split_part(name,'/',2)::uuid
      and a.organization_id=erp_private.current_org_id()
      and a.status not in('COMPLETED','CANCELLED')
      and erp_private.workforce_can_manage_profile(a.assignee_profile_id)
  )
);

commit;
