begin;
set local role postgres;

drop function if exists public.delete_luar_category(uuid, uuid);
drop function if exists public.save_luar_category(uuid, uuid, text, text, text, text, boolean);
drop trigger if exists prepare_luar_category_row_trigger on public.luar_categories;
drop function if exists public.prepare_luar_category_row();
drop function if exists public.normalize_luar_category_name(text);
drop table if exists public.luar_categories;

commit;
