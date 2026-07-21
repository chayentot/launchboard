-- LaunchBoard V8.1.9 review repair
-- Run once in Supabase SQL Editor.

alter table public.product_reviews
  add column if not exists created_at timestamptz not null default now();

-- Upsert requires one review per user per product.
create unique index if not exists product_reviews_product_author_unique
  on public.product_reviews(product_id, author_id);

alter table public.product_reviews enable row level security;

drop policy if exists "Reviews publicly readable" on public.product_reviews;
create policy "Reviews publicly readable"
on public.product_reviews for select
using (true);

drop policy if exists "Members create reviews" on public.product_reviews;
create policy "Members create reviews"
on public.product_reviews for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists "Members update reviews" on public.product_reviews;
create policy "Members update reviews"
on public.product_reviews for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());
