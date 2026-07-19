-- Optional LaunchBoard V4.2 discovery performance indexes
-- Safe to run more than once.

create index if not exists products_category_idx on public.products(category);
create index if not exists products_product_type_idx on public.products(product_type);
create index if not exists products_premium_idx on public.products(is_premium, created_at desc);
create index if not exists products_views_idx on public.products(views desc);
create index if not exists products_clicks_idx on public.products(clicks desc);
create index if not exists profiles_verified_idx on public.profiles(is_verified, created_at desc);
