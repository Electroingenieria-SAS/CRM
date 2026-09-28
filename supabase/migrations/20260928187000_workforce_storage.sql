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
);

commit;
