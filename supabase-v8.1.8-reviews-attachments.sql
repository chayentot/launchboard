-- LaunchBoard V8.1.8: review reliability and message attachments
-- Run once in Supabase SQL Editor before uploading the patch files.

alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint;

alter table public.messages drop constraint if exists messages_attachment_size_check;
alter table public.messages add constraint messages_attachment_size_check
  check (attachment_size is null or (attachment_size > 0 and attachment_size <= 15728640));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  true,
  15728640,
  array[
    'image/jpeg','image/png','image/webp','application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'
  ]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Members upload message attachments" on storage.objects;
create policy "Members upload message attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id='message-attachments'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Message attachments publicly readable" on storage.objects;
create policy "Message attachments publicly readable"
on storage.objects for select
using (bucket_id='message-attachments');

drop policy if exists "Members delete own message attachments" on storage.objects;
create policy "Members delete own message attachments"
on storage.objects for delete to authenticated
using (
  bucket_id='message-attachments'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- Re-assert review policies in case an older database missed them.
alter table public.product_reviews enable row level security;
drop policy if exists "Reviews publicly readable" on public.product_reviews;
create policy "Reviews publicly readable" on public.product_reviews for select using(true);
drop policy if exists "Members create reviews" on public.product_reviews;
create policy "Members create reviews" on public.product_reviews
for insert to authenticated with check(author_id=auth.uid());
drop policy if exists "Members update reviews" on public.product_reviews;
create policy "Members update reviews" on public.product_reviews
for update to authenticated using(author_id=auth.uid()) with check(author_id=auth.uid());
